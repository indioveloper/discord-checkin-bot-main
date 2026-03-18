const loginCommand   = require('../commands/login');
const projectCommand = require('../commands/project');

/**
 * Central router for all Discord interactions.
 * Routes slash commands, button clicks, and modal submissions.
 */
async function interactionHandler(interaction, client) {
  try {
    // --- Slash commands ---
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    // --- Button interactions ---
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('login_time_')) {
        await loginCommand.handleTimeButton(interaction);
      } else if (interaction.customId === 'login_exacttime') {
        await loginCommand.handleExactTimeButton(interaction);
      } else if (interaction.customId.startsWith('login_proj_')) {
        await loginCommand.handleProjectButton(interaction);
      } else if (interaction.customId.startsWith('login_newproject_')) {
        await loginCommand.handleNewProjectButton(interaction);
      } else if (interaction.customId.startsWith('proj_pick_')) {
        await projectCommand.handlePickButton(interaction);
      } else if (interaction.customId === 'proj_newproj') {
        await projectCommand.handleNewButton(interaction);
      }
      return;
    }

    // --- Modal submissions ---
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('login_modal_')) {
        await loginCommand.handleModalSubmit(interaction);
      } else if (interaction.customId === 'login_exacttime_modal') {
        await loginCommand.handleExactTimeModalSubmit(interaction);
      } else if (interaction.customId === 'proj_modal') {
        await projectCommand.handleModalSubmit(interaction);
      }
      return;
    }
  } catch (error) {
    console.error('Error handling interaction:', error);

    const errorMsg = { content: '❌ Algo ha ido mal. Inténtalo de nuevo.', ephemeral: true };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMsg);
      } else {
        await interaction.reply(errorMsg);
      }
    } catch {
      // Ignore reply errors
    }
  }
}

module.exports = interactionHandler;
