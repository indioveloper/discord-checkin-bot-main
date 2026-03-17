const {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} = require('discord.js');
const { getUpcomingHours, hourLabel, formatInZone, isExpired } = require('../utils/timeUtils');
const { getTimezone, setUser, registerMember, getUsers } = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('login')
    .setDescription('Registra tu presencia en el equipo'),

  async execute(interaction) {
    const timezone = getTimezone(interaction.user.id);
    const hours = getUpcomingHours();

    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();

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

    await interaction.reply({
      content: `👋 Hola **${interaction.member?.displayName || interaction.user.username}**!\n\n**¿Hasta qué hora vas a estar por aquí?**`,
      components: [row1, row2],
      flags: MessageFlags.Ephemeral,
    });
  },

  // Called when user picks an hour
  async handleTimeButton(interaction) {
    const selectedUtcIso = interaction.customId.replace('login_time_', '');

    // Gather active projects from current sessions
    const activeProjects = getActiveProjects();

    if (activeProjects.length === 0) {
      return showProjectModal(interaction, selectedUtcIso);
    }

    // Show project-selection buttons
    const timezone = getTimezone(interaction.user.id);
    const localTime = formatInZone(selectedUtcIso, timezone);
    const rows = buildProjectRows(activeProjects, selectedUtcIso);

    await interaction.update({
      content: `⏱️ Hasta las **${localTime}** — ¿a qué proyecto te unes?`,
      components: rows,
    });
  },

  // Called when user picks an existing project button
  async handleProjectButton(interaction) {
    // customId: login_proj_<utcIso>_<idx>
    const withoutPrefix = interaction.customId.slice('login_proj_'.length);
    const lastUs = withoutPrefix.lastIndexOf('_');
    const utcIso = withoutPrefix.slice(0, lastUs);
    const idx    = parseInt(withoutPrefix.slice(lastUs + 1), 10);

    const activeProjects = getActiveProjects();
    const project = activeProjects[idx];

    if (!project) {
      await interaction.update({
        content: '⚠️ Ese proyecto ya no está activo. Usa `/login` de nuevo.',
        components: [],
      });
      return;
    }

    await saveSession(interaction, utcIso, project);
  },

  // Called when user clicks "✏️ Nuevo proyecto"
  async handleNewProjectButton(interaction) {
    const utcIso = interaction.customId.replace('login_newproject_', '');
    return showProjectModal(interaction, utcIso);
  },

  // Called when the project-name modal is submitted
  async handleModalSubmit(interaction) {
    const utcIso  = interaction.customId.replace('login_modal_', '');
    const project = interaction.fields.getTextInputValue('project_name').trim();
    await saveSession(interaction, utcIso, project, { fromModal: true });
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getActiveProjects() {
  const users = getUsers();
  return [...new Set(
    Object.values(users)
      .filter(u => !isExpired(u.until))
      .map(u => u.project)
      .filter(Boolean),
  )];
}

function buildProjectRows(projects, utcIso) {
  const rows = [];

  // Up to 4 existing-project buttons per row (max 2 rows = 8, cap at 8)
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

  // "New project" button on its own row
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
        .setPlaceholder('Ej: API de pagos, Dashboard admin…')
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

  const timezone  = getTimezone(interaction.user.id);
  const localTime = formatInZone(utcIso, timezone);
  const msg = `✅ **${displayName}** está en línea hasta las **${localTime}** trabajando en **"${project}"**`;

  if (opts.fromModal) {
    await interaction.reply({ content: msg });
  } else {
    // Button flow: update ephemeral message then post public announcement
    await interaction.update({ content: '✅', components: [] });
    await interaction.followUp({ content: msg });
  }
}
