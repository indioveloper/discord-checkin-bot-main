const { SlashCommandBuilder } = require('discord.js');
const { getUsers, getTimezone } = require('../utils/storage');
const { formatInZone, isExpired } = require('../utils/timeUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Muestra quién está en línea, hasta cuándo y en qué proyecto'),

  async execute(interaction) {
    const users = getUsers();
    const requesterTimezone = getTimezone(interaction.user.id);

    // Filter out expired users (expiry checker may not have run yet)
    const active = Object.values(users).filter(u => !isExpired(u.until));

    if (active.length === 0) {
      return interaction.reply({
        content: '😴 No hay nadie en línea ahora mismo.',
        ephemeral: true,
      });
    }

    // Sort by until time ascending
    active.sort((a, b) => (a.until > b.until ? 1 : -1));

    const lines = active.map(u => {
      const localTime = formatInZone(u.until, requesterTimezone);
      return `• **${u.username}** — hasta las **${localTime}** — 🔧 ${u.project}`;
    });

    const header = `👥 **Equipo en línea** *(horas en tu zona: ${requesterTimezone})*\n`;
    await interaction.reply({
      content: header + lines.join('\n'),
      ephemeral: true,
    });
  },
};
