const {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} = require('discord.js');
const { getUser, setUser, getUsers } = require('../utils/storage');
const { isExpired } = require('../utils/timeUtils');
const { syncLogin } = require('../utils/checkinSync');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('project')
    .setDescription('Cambia el proyecto en el que estás trabajando'),

  async execute(interaction) {
    const user = getUser(interaction.user.id);
    if (!user) {
      return interaction.reply({
        content: '⚠️ No tienes una sesión activa. Usa `/login` primero.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Gather all active projects
    const allUsers = getUsers();
    const activeProjects = [...new Set(
      Object.values(allUsers)
        .filter(u => !isExpired(u.until))
        .map(u => u.project)
        .filter(Boolean),
    )];

    if (activeProjects.length === 0) {
      // No active projects → jump straight to text modal
      return showProjectModal(interaction, user.project);
    }

    // Build project-selection buttons
    const rows = [];
    for (let start = 0; start < Math.min(activeProjects.length, 8); start += 4) {
      const row = new ActionRowBuilder();
      activeProjects.slice(start, start + 4).forEach((proj, i) => {
        const label = proj.length > 80 ? proj.slice(0, 77) + '…' : proj;
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`proj_pick_${start + i}`)
            .setLabel(label)
            .setStyle(ButtonStyle.Success),
        );
      });
      rows.push(row);
    }

    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('proj_newproj')
          .setLabel('✏️ Nuevo proyecto')
          .setStyle(ButtonStyle.Secondary),
      ),
    );

    await interaction.reply({
      content: `🔄 Actualmente en **"${user.project}"** — ¿a qué proyecto cambias?`,
      components: rows,
      flags: MessageFlags.Ephemeral,
    });
  },

  // Button: pick an existing project
  async handlePickButton(interaction) {
    const idx     = parseInt(interaction.customId.replace('proj_pick_', ''), 10);
    const allUsers = getUsers();
    const projects = [...new Set(
      Object.values(allUsers)
        .filter(u => !isExpired(u.until))
        .map(u => u.project)
        .filter(Boolean),
    )];

    const newProject = projects[idx];
    if (!newProject) {
      await interaction.update({ content: '⚠️ Ese proyecto ya no está activo.', components: [] });
      return;
    }

    await applyProjectChange(interaction, newProject, { fromButton: true });
  },

  // Button: open free-text modal
  async handleNewButton(interaction) {
    const user = getUser(interaction.user.id);
    return showProjectModal(interaction, user?.project ?? '');
  },

  // Modal submit: free-text project name
  async handleModalSubmit(interaction) {
    const newProject = interaction.fields.getTextInputValue('project_name').trim();
    await applyProjectChange(interaction, newProject, { fromModal: true });
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function showProjectModal(interaction, currentProject) {
  const modal = new ModalBuilder()
    .setCustomId('proj_modal')
    .setTitle('Cambiar proyecto');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('project_name')
        .setLabel('Nombre del nuevo proyecto')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(currentProject || 'Ej: API de pagos…')
        .setRequired(true)
        .setMaxLength(100),
    ),
  );

  return interaction.showModal(modal);
}

async function applyProjectChange(interaction, newProject, opts = {}) {
  const user        = getUser(interaction.user.id);
  const displayName = interaction.member?.displayName || interaction.user.username;

  if (!user) {
    const msg = { content: '⚠️ No tienes una sesión activa.', flags: MessageFlags.Ephemeral };
    return opts.fromModal ? interaction.reply(msg) : interaction.update({ ...msg, components: [] });
  }

  const oldProject = user.project;
  setUser(interaction.user.id, { ...user, project: newProject });
  syncLogin(interaction.user.id, displayName, user.until, newProject).catch(err =>
    console.error('[checkinSync] project sync error:', err.message)
  );

  const announcement = `🔄 **${displayName}** ha cambiado de proyecto: ~~${oldProject}~~ → **${newProject}**`;

  if (opts.fromModal) {
    await interaction.reply({ content: announcement });
  } else {
    await interaction.update({ content: '✅', components: [] });
    await interaction.followUp({ content: announcement });
  }
}
