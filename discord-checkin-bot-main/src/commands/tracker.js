const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getUsers, getMembers, getTimezone } = require('../utils/storage');
const { isExpired } = require('../utils/timeUtils');
const { renderTracker } = require('../utils/renderTracker');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tracker')
    .setDescription('Muestra el estado del equipo en un gráfico visual'),

  async execute(interaction) {
    await interaction.deferReply();

    const timezone   = getTimezone(interaction.user.id);
    const usersRaw   = getUsers();
    const membersRaw = getMembers();

    // Filter out already-expired sessions (expiry checker may not have run yet)
    const activeRaw = Object.values(usersRaw).filter(u => !isExpired(u.until));

    // Build a colorIndex lookup from the member registry
    const memberArr      = Object.values(membersRaw);
    const colorByUserId  = Object.fromEntries(memberArr.map(m => [m.userId, m.colorIndex ?? 0]));

    // Merge colorIndex into each active user record
    const activeUsers = activeRaw.map(u => ({
      ...u,
      colorIndex: colorByUserId[u.userId] ?? 0,
    }));

    const title  = `${interaction.guild?.name ?? 'Dev'} Tracker`;
    const buffer = renderTracker({ activeUsers, allMembers: memberArr, timezone, title });

    const attachment = new AttachmentBuilder(buffer, { name: 'tracker.png' });
    await interaction.editReply({ files: [attachment] });
  },
};
