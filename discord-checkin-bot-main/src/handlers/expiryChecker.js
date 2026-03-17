const { getUsers, removeUser } = require('../utils/storage');
const { isExpired } = require('../utils/timeUtils');

const CHECK_INTERVAL_MS = 60 * 1000; // every 60 seconds

/**
 * Starts the expiry checker loop.
 * Every minute it checks for users whose "until" time has passed,
 * removes them from the active list, and posts a notification in their channel.
 */
function startExpiryChecker(client) {
  setInterval(async () => {
    const users = getUsers();

    for (const [userId, userData] of Object.entries(users)) {
      if (!isExpired(userData.until)) continue;

      // Remove from active list first to avoid duplicate notifications
      removeUser(userId);

      // Post notification in the channel where the user logged in
      try {
        const channel = await client.channels.fetch(userData.channelId);
        if (!channel || !channel.isTextBased()) continue;

        const unixTs = Math.floor(new Date(userData.until).getTime() / 1000);

        await channel.send(
          `⏰ **${userData.username}** ha salido del equipo (tiempo estimado de <t:${unixTs}:t> alcanzado).`
        );
      } catch (err) {
        console.error(`Failed to notify expiry for user ${userData.username}:`, err.message);
      }
    }
  }, CHECK_INTERVAL_MS);

  console.log('Expiry checker started (interval: 60s)');
}

module.exports = { startExpiryChecker };
