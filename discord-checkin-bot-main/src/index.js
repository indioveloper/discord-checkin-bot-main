require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const interactionHandler = require('./handlers/interactionHandler');
const { startExpiryChecker } = require('./handlers/expiryChecker');

// Validate required env vars
const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Load slash commands into a Collection
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
const commandData = [];

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      commandData.push(command.data.toJSON());
      console.log(`Loaded command: /${command.data.name}`);
    }
  } catch (err) {
    console.error(`Failed to load command ${file}:`, err.message);
  }
}

// Register slash commands with Discord on startup
const rest = new REST().setToken(process.env.DISCORD_TOKEN);
rest.put(
  Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
  { body: commandData }
)
  .then(data => console.log(`✅ ${data.length} slash commands registrados`))
  .catch(err => console.error('Error registrando commands:', err.message));

client.once('ready', () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  startExpiryChecker(client);
});

client.on('interactionCreate', interaction => interactionHandler(interaction, client));

client.on('error', err => console.error('Discord client error:', err));

client.login(process.env.DISCORD_TOKEN);
