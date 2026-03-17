const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getUsers, getRoster, getTimezone } = require('../utils/storage');
const { isExpired } = require('../utils/timeUtils');
const { renderTracker } = require('../utils/renderTracker');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Muestra el estado del equipo en un gráfico visual'),

  async execute(interaction) {
    await interaction.deferReply();

    const timezone   = getTimezone(interaction.user.id);
    const usersRaw   = getUsers();
    const roster     = getRoster(); // fixed ordered list [{name, colorIndex}]

    // Filter expired sessions
    const activeUsers = Object.values(usersRaw).filter(u => !isExpired(u.until));

    // Annotate each roster member with their active session (matched by name)
    const rosterMembers = roster.map(r => ({
      ...r,
      activeUser: activeUsers.find(u =>
        u.username.toLowerCase().includes(r.name.toLowerCase())
      ) || null,
    }));

    // For active users, resolve colorIndex from the roster match
    const activeWithColor = activeUsers.map(u => {
      const match = roster.find(r => u.username.toLowerCase().includes(r.name.toLowerCase()));
      return { ...u, colorIndex: match ? match.colorIndex : 0 };
    });

    const rawName = interaction.guild?.name ?? 'Dev';
    const title   = `${rawName.replace(/development\s+team/gi, 'Dev')} Tracker`;
    const buffer = renderTracker({ activeUsers: activeWithColor, rosterMembers, timezone, title });

    const attachment = new AttachmentBuilder(buffer, { name: 'tracker.png' });
    await interaction.editReply({ files: [attachment] });
  },
};
