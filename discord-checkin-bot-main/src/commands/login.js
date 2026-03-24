const {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} = require('discord.js');
const { DateTime } = require('luxon');
const { getUpcomingHours, hourLabel, formatInZone, isExpired } = require('../utils/timeUtils');
const { getTimezone, setUser, registerMember, getUsers, getRoster } = require('../utils/storage');
const { syncLogin } = require('../utils/checkinSync');
const { getLinearProjects } = require('../utils/linearClient');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('login')
    .setDescription('Registra tu presencia en el equipo'),

  async execute(interaction) {
    const timezone = getTimezone(interaction.user.id);
    const hours = getUpcomingHours();

    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();
    const row3 = new ActionRowBuilder();

    hours.slice(0, 4).forEach(dt => {
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId(`login_time_${dt.toISO()}`)
          .setLabel(hourLabel(dt.toISO(), timezone))
          .setStyle(ButtonStyle.Primary)
      );
    });

    hours.slice(4, 8).forEach(dt => {
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId(`login_time_${dt.toISO()}`)
          .setLabel(hourLabel(dt.toISO(), timezone))
          .setStyle(ButtonStyle.Secondary)
      );
    });

    row3.addComponents(
      new ButtonBuilder()
        .setCustomId('login_exacttime')
        .setLabel('⏰ Hora exacta')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('login_indefinite')
        .setLabel('♾️ Indefinidamente')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: `👋 Hola **${interaction.member?.displayName || interaction.user.username}**!\n\n**¿Hasta qué hora vas a estar por aquí?**`,
      components: [row1, row2, row3],
      flags: MessageFlags.Ephemeral,
    });
  },

  // Called when user picks an hour slot button
  async handleTimeButton(interaction) {
    const selectedUtcIso = interaction.customId.replace('login_time_', '');
    const sessionProjects = getSessionProjects();
    const linearEnabled = !!process.env.LINEAR_API_KEY;

    // Fast path: sin Linear y sin sesiones → modal inmediato (sin defer)
    if (!linearEnabled && sessionProjects.length === 0) {
      return showProjectModal(interaction, selectedUtcIso);
    }

    await interaction.deferUpdate();
    const activeProjects = linearEnabled ? await getMergedProjects() : sessionProjects;

    if (activeProjects.length === 0) {
      return interaction.editReply({
        content: `⏱️ Hasta las **${formatInZone(selectedUtcIso, getTimezone(interaction.user.id))}** — ¿a qué proyecto te unes?`,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`login_newproject_${selectedUtcIso}`).setLabel('✏️ Nuevo proyecto').setStyle(ButtonStyle.Secondary),
        )],
      });
    }

    const localTime = formatInZone(selectedUtcIso, getTimezone(interaction.user.id));
    await interaction.editReply({
      content: `⏱️ Hasta las **${localTime}** — ¿a qué proyecto te unes?`,
      components: buildProjectRows(activeProjects, selectedUtcIso),
    });
  },

  // Called when user clicks "♾️ Indefinidamente"
  async handleIndefiniteButton(interaction) {
    const sessionProjects = getSessionProjects();
    const linearEnabled = !!process.env.LINEAR_API_KEY;

    if (!linearEnabled && sessionProjects.length === 0) {
      return showProjectModal(interaction, 'indefinidamente');
    }

    await interaction.deferUpdate();
    const activeProjects = linearEnabled ? await getMergedProjects() : sessionProjects;

    if (activeProjects.length === 0) {
      return interaction.editReply({
        content: `♾️ Sin límite de tiempo — ¿a qué proyecto te unes?`,
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('login_newproject_indefinidamente').setLabel('✏️ Nuevo proyecto').setStyle(ButtonStyle.Secondary),
        )],
      });
    }

    await interaction.editReply({
      content: `♾️ Sin límite de tiempo — ¿a qué proyecto te unes?`,
      components: buildProjectRows(activeProjects, 'indefinidamente'),
    });
  },

  // Called when user clicks "⏰ Hora exacta"
  async handleExactTimeButton(interaction) {
    const sessionProjects = getSessionProjects();
    const projectPlaceholder = sessionProjects.length > 0
      ? `Activos: ${sessionProjects.slice(0, 3).join(', ')}`
      : '';

    const modal = new ModalBuilder()
      .setCustomId('login_exacttime_modal')
      .setTitle('Check-in con hora exacta');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('exact_time')
          .setLabel('Hora de salida (HH:MM)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('13:45')
          .setRequired(true)
          .setMaxLength(5),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('project_name')
          .setLabel('Proyecto')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(projectPlaceholder)
          .setRequired(true)
          .setMaxLength(100),
      ),
    );

    return interaction.showModal(modal);
  },

  // Called when user picks an existing project button
  async handleProjectButton(interaction) {
    await interaction.deferUpdate();

    const withoutPrefix = interaction.customId.slice('login_proj_'.length);
    const lastUs = withoutPrefix.lastIndexOf('_');
    const utcIso = withoutPrefix.slice(0, lastUs);
    const idx    = parseInt(withoutPrefix.slice(lastUs + 1), 10);

    const activeProjects = await getMergedProjects();
    const projectRaw = activeProjects[idx];

    if (!projectRaw) {
      // No se puede abrir modal después de deferUpdate
      return interaction.editReply({
        content: '¿A qué proyecto te unes?',
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`login_newproject_${utcIso}`).setLabel('✏️ Nuevo proyecto').setStyle(ButtonStyle.Secondary),
        )],
      });
    }

    // Quitar prefijo 📋 (proyectos de Linear) antes de guardar
    const project = projectRaw.startsWith('📋 ') ? projectRaw.slice(3) : projectRaw;
    await saveSession(interaction, utcIso, project, { deferred: true });
  },

  // Called when user clicks "✏️ Nuevo proyecto"
  async handleNewProjectButton(interaction) {
    const utcIso = interaction.customId.replace('login_newproject_', '');
    return showProjectModal(interaction, utcIso);
  },

  // Called when the project-name modal is submitted (from hour slot flow)
  async handleModalSubmit(interaction) {
    const utcIso  = interaction.customId.replace('login_modal_', '');
    const project = interaction.fields.getTextInputValue('project_name').trim();
    await saveSession(interaction, utcIso, project, { fromModal: true });
  },

  // Called when the exact-time modal is submitted
  async handleExactTimeModalSubmit(interaction) {
    const timeStr = interaction.fields.getTextInputValue('exact_time').trim();
    const project = interaction.fields.getTextInputValue('project_name').trim();

    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return interaction.reply({
        content: '⚠️ Formato de hora inválido. Usa HH:MM (ej: `13:45`).',
        flags: MessageFlags.Ephemeral,
      });
    }

    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);

    if (h > 23 || m > 59) {
      return interaction.reply({
        content: '⚠️ Hora inválida. Escribe una hora entre 00:00 y 23:59.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const tz = getTimezone(interaction.user.id);
    let dt = DateTime.now().setZone(tz).set({ hour: h, minute: m, second: 0, millisecond: 0 });

    // Si la hora ya pasó hace más de 2 minutos, asumir que es mañana
    if (dt.toMillis() < Date.now() - 2 * 60_000) {
      dt = dt.plus({ days: 1 });
    }

    const utcIso = dt.toUTC().toISO();
    await saveSession(interaction, utcIso, project, { fromModal: true });
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

// Síncrono: solo proyectos de sesiones activas en memoria
function getSessionProjects() {
  const users = getUsers();
  return [...new Set(
    Object.values(users)
      .filter(u => !isExpired(u.until))
      .map(u => u.project)
      .filter(Boolean),
  )];
}

// Asíncrono: sesiones activas + proyectos de Linear (prioridad urgente/alta)
async function getMergedProjects() {
  const sessionProjects = getSessionProjects();
  const linearProjects = await getLinearProjects();
  const sessionSet = new Set(sessionProjects);
  const newFromLinear = linearProjects
    .filter(p => !sessionSet.has(p))
    .map(p => `📋 ${p}`);
  return [...sessionProjects, ...newFromLinear];
}

function buildProjectRows(projects, utcIso) {
  const rows = [];

  const capped = projects.slice(0, 8);
  for (let start = 0; start < capped.length; start += 4) {
    const row = new ActionRowBuilder();
    capped.slice(start, start + 4).forEach((proj, i) => {
      const label = proj.length > 80 ? proj.slice(0, 77) + '…' : proj;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`login_proj_${utcIso}_${start + i}`)
          .setLabel(label)
          .setStyle(ButtonStyle.Success),
      );
    });
    rows.push(row);
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`login_newproject_${utcIso}`)
        .setLabel('✏️ Nuevo proyecto')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return rows;
}

function showProjectModal(interaction, utcIso) {
  const modal = new ModalBuilder()
    .setCustomId(`login_modal_${utcIso}`)
    .setTitle('¿En qué proyecto vas a trabajar?');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('project_name')
        .setLabel('Nombre del proyecto')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('')
        .setRequired(true)
        .setMaxLength(100),
    ),
  );

  return interaction.showModal(modal);
}

async function saveSession(interaction, utcIso, project, opts = {}) {
  const displayName = interaction.member?.displayName || interaction.user.username;

  setUser(interaction.user.id, {
    username: displayName,
    userId: interaction.user.id,
    until: utcIso,
    project,
    channelId: interaction.channelId,
  });
  registerMember(interaction.user.id, displayName);
  syncLogin(interaction.user.id, displayName, utcIso, project, new Date().toISOString()).catch(err =>
    console.error('[checkinSync] login error:', err.message)
  );

  const indefinite = utcIso === 'indefinidamente';
  const unixTs   = indefinite ? null : Math.floor(new Date(utcIso).getTime() / 1000);
  const now      = Date.now();
  const allUsers = getUsers();
  const active   = Object.values(allUsers).filter(u => !isExpired(u.until));
  const others   = active.filter(u => u.username !== displayName);
  const roster   = getRoster();

  // Línea principal
  let msg = indefinite
    ? `✅ **${displayName}** está en línea indefinidamente trabajando en **"${project}"**`
    : `✅ **${displayName}** está en línea hasta las <t:${unixTs}:t> trabajando en **"${project}"**`;

  // Lista de otros conectados
  if (others.length > 0) {
    msg += '\n\n👥 **También conectados:**';
    for (const u of others) {
      const ts    = u.until !== 'indefinidamente' ? Math.floor(new Date(u.until).getTime() / 1000) : null;
      const until = ts ? `hasta las <t:${ts}:t>` : 'indefinidamente';
      const proj  = u.project ? ` · ${u.project}` : '';
      msg += `\n• **${u.username}** — ${until}${proj}`;
    }
  }

  // Resumen simultáneos
  const definiteTimes = active
    .filter(u => u.until !== 'indefinidamente')
    .map(u => new Date(u.until).getTime())
    .filter(t => t > now);

  const nextDep = definiteTimes.length > 0 ? Math.min(...definiteTimes) : null;

  if (nextDep) {
    const nextTs    = Math.floor(nextDep / 1000);
    const remainMin = Math.round((nextDep - now) / 60_000);
    const remainStr = remainMin < 60
      ? `${remainMin} min`
      : `${Math.floor(remainMin / 60)}h${remainMin % 60 > 0 ? ` ${remainMin % 60}min` : ''}`;
    msg += `\n\n📊 **${active.length} de ${roster.length}** miembros activos · simultáneos hasta las <t:${nextTs}:t> (en ${remainStr})`;
  } else {
    msg += `\n\n📊 **${active.length} de ${roster.length}** miembros activos`;
  }

  if (opts.fromModal) {
    await interaction.reply({ content: msg });
  } else if (opts.deferred) {
    await interaction.editReply({ content: '✅', components: [] });
    await interaction.followUp({ content: msg });
  } else {
    await interaction.update({ content: '✅', components: [] });
    await interaction.followUp({ content: msg });
  }
}
