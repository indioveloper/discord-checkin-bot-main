const { SlashCommandBuilder } = require('discord.js');
const { getUser, setUser } = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('project')
    .setDescription('Cambia el proyecto en el que estás trabajando')
    .addStringOption(option =>
      option
        .setName('nombre')
        .setDescription('Nombre del nuevo proyecto')
        .setRequired(true)
        .setMaxLength(100)
    ),

  async execute(interaction) {
    const user = getUser(interaction.user.id);
    const displayName = interaction.member?.displayName || interaction.user.username;

    if (!user) {
      return interaction.reply({
        content: '⚠️ No tienes una sesión activa. Usa `/login` primero.',
        ephemeral: true,
      });
    }

    const newProject = interaction.options.getString('nombre').trim();
    const oldProject = user.project;

    setUser(interaction.user.id, { ...user, project: newProject });

    await interaction.reply({
      content: `🔄 **${displayName}** ha cambiado de proyecto: ~~${oldProject}~~ → **${newProject}**`,
    });
  },
};
