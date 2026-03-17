const fs = require('fs');
const path = require('path');

const USERS_PATH    = path.join(__dirname, '../../data/users.json');
const TIMEZONES_PATH = path.join(__dirname, '../../data/timezones.json');
const MEMBERS_PATH  = path.join(__dirname, '../../data/members.json');

function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getUsers() {
  return readJSON(USERS_PATH);
}

function saveUsers(users) {
  writeJSON(USERS_PATH, users);
}

function getUser(userId) {
  const users = getUsers();
  return users[userId] || null;
}

function setUser(userId, data) {
  const users = getUsers();
  users[userId] = data;
  saveUsers(users);
}

function removeUser(userId) {
  const users = getUsers();
  delete users[userId];
  saveUsers(users);
}

function getTimezone(userId) {
  const timezones = readJSON(TIMEZONES_PATH);
  return timezones[userId] || timezones.default || 'UTC';
}

// ── Member registry ──────────────────────────────────────────────────────────
// Tracks all users who have ever logged in, with their display colour slot.

function getMembers() {
  return readJSON(MEMBERS_PATH);
}

/**
 * Registers a member if not seen before; updates the username if it changed.
 * Assigns a stable colorIndex based on registration order.
 * @returns {object} the member record
 */
function registerMember(userId, username) {
  const members = getMembers();
  if (members[userId]) {
    if (members[userId].username !== username) {
      members[userId].username = username;
      writeJSON(MEMBERS_PATH, members);
    }
    return members[userId];
  }
  const colorIndex = Object.keys(members).length;
  members[userId] = { userId, username, colorIndex };
  writeJSON(MEMBERS_PATH, members);
  return members[userId];
}

module.exports = { getUsers, saveUsers, getUser, setUser, removeUser, getTimezone, getMembers, registerMember };
