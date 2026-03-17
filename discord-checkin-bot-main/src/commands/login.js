const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUpcomingHours, hourLabel } = require('../utils/timeUtils');
const { getTimezone, setUser, registerMember } = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('login')
    .setDescription('Registra tu presencia en el equipo'),

  async execute(interaction) {
    const timezone = getTimezone(interaction.user.id);
    const hours = getUpcomingHours();

    // Build button rows (max 5 per row, we have 8 → 2 rows of 4)
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
      ephemeral: true,
    });
  },

  // Called by interactionHandler when a login time button is clicked
  async handleTimeButton(interaction) {
    // customId format: login_time_<ISO>
    const selectedUtcIso = interaction.customId.replace('login_time_', '');

    const modal = new ModalBuilder()
      .setCustomId(`login_modal_${selectedUtcIso}`)
      .setTitle('¿En qué proyecto vas a trabajar?');

    const projectInput = new TextInputBuilder()
      .setCustomId('project_name')
      .setLabel('Nombre del proyecto')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ej: API de pagos, Dashboard admin...')
      .setRequired(true)
      .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder().addComponents(projectInput));
    await interaction.showModal(modal);
  },

  // Called by interactionHandler when the login modal is submitted
  async handleModalSubmit(interaction) {
    // customId format: login_modal_<ISO>
    const selectedUtcIso = interaction.customId.replace('login_modal_', '');
    const project = interaction.fields.getTextInputValue('project_name').trim();
    const displayName = interaction.member?.displayName || interaction.user.username;

    setUser(interaction.user.id, {
      username: displayName,
      userId: interaction.user.id,
      until: selectedUtcIso,
      project,
      channelId: interaction.channelId,
    });
    registerMember(interaction.user.id, displayName);

    const timezone = getTimezone(interaction.user.id);
    const { formatInZone } = require('../utils/timeUtils');
    const localTime = formatInZone(selectedUtcIso, timezone);

    await interaction.reply({
      content: `✅ **${displayName}** está en línea hasta las **${localTime}** trabajando en **"${project}"**`,
    });
  },
};
