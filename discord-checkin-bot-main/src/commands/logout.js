const { SlashCommandBuilder } = require('discord.js');
const { getUser, removeUser } = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logout')
    .setDescription('Cancela tu presencia activa en el equipo'),

  async execute(interaction) {
    const user = getUser(interaction.user.id);
    const displayName = interaction.member?.displayName || interaction.user.username;

    if (!user) {
      return interaction.reply({
        content: '⚠️ No tienes una sesión activa. Usa `/login` para registrarte.',
        ephemeral: true,
      });
    }

    removeUser(interaction.user.id);

    await interaction.reply({
      content: `👋 **${displayName}** ha salido del equipo. ¡Hasta la próxima!`,
    });
  },
};
