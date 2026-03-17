require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
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

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: /${command.data.name}`);
  }
}

client.once('ready', () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  startExpiryChecker(client);
});

client.on('interactionCreate', interaction => interactionHandler(interaction, client));

client.on('error', err => console.error('Discord client error:', err));

client.login(process.env.DISCORD_TOKEN);
