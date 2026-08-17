/**
 * MINDORA Authentication Service
 * Handles user registration, login, and session management.
 * Uses bcrypt for password hashing and a JSON file store for persistence.
 */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load users from file or initialize empty
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading users:', err.message);
  }
  return {};
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error saving users:', err.message);
  }
}

const users = loadUsers();

// In-memory session store: token -> userId
const sessions = new Map();

/**
 * Register a new user.
 * @param {string} username - Unique username
 * @param {string} password - Plain password (will be hashed)
 * @returns {Promise<{success: boolean, message: string, user?: Object}>}
 */
async function registerUser(username, password) {
  const name = (username || '').trim().toLowerCase();
  if (!name || name.length < 3) {
    return { success: false, message: 'Username must be at least 3 characters.' };
  }
  if (!password || password.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters.' };
  }
  if (users[name]) {
    return { success: false, message: 'That username is already taken.' };
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users[name] = {
    username: name,
    passwordHash: hashedPassword,
    createdAt: new Date().toISOString(),
    preferences: {
      name: name,
      theme: 'light'
    },
    moodHistory: [],
    journalEntries: [],
    conversations: []
  };
  saveUsers(users);

  return { success: true, message: 'Account created.', user: { username: name } };
}

/**
 * Login a user and create a session token.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{success: boolean, message: string, token?: string, user?: Object}>}
 */
async function loginUser(username, password) {
  const name = (username || '').trim().toLowerCase();
  const user = users[name];
  if (!user) {
    return { success: false, message: 'Invalid username or password.' };
  }

  const valid = await bcrypt.compare(password || '', user.passwordHash);
  if (!valid) {
    return { success: false, message: 'Invalid username or password.' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, name);

  return {
    success: true,
    message: 'Welcome back.',
    token,
    user: { username: name, preferences: user.preferences }
  };
}

/**
 * Logout a user by invalidating their session token.
 * @param {string} token
 */
function logoutUser(token) {
  sessions.delete(token);
}

/**
 * Get the current user from a session token.
 * @param {string} token
 * @returns {Object|null} User object or null if invalid
 */
function getUserFromToken(token) {
  if (!token) return null;
  const username = sessions.get(token);
  if (!username) return null;
  const user = users[username];
  if (!user) return null;
  return { ...user, passwordHash: undefined };
}

/**
 * Update user preferences.
 * @param {string} username
 * @param {Object} prefs
 */
function updatePreferences(username, prefs) {
  const user = users[username];
  if (!user) return { success: false, message: 'User not found.' };
  user.preferences = { ...user.preferences, ...prefs };
  saveUsers(users);
  return { success: true, preferences: user.preferences };
}

/**
 * Save a mood entry for a user.
 * @param {string} username
 * @param {Object} moodEntry
 */
function saveMoodEntry(username, moodEntry) {
  const user = users[username];
  if (!user) return { success: false, message: 'User not found.' };
  user.moodHistory = user.moodHistory || [];
  user.moodHistory.push({
    ...moodEntry,
    timestamp: new Date().toISOString()
  });
  saveUsers(users);
  return { success: true, moodHistory: user.moodHistory };
}

/**
 * Save a journal entry for a user.
 * @param {string} username
 * @param {Object} entry
 */
function saveJournalEntry(username, entry) {
  const user = users[username];
  if (!user) return { success: false, message: 'User not found.' };
  user.journalEntries = user.journalEntries || [];
  user.journalEntries.unshift({
    ...entry,
    id: crypto.randomBytes(8).toString('hex'),
    createdAt: new Date().toISOString()
  });
  saveUsers(users);
  return { success: true, journalEntries: user.journalEntries };
}

/**
 * Delete a journal entry.
 * @param {string} username
 * @param {string} entryId
 */
function deleteJournalEntry(username, entryId) {
  const user = users[username];
  if (!user) return { success: false, message: 'User not found.' };
  user.journalEntries = (user.journalEntries || []).filter(e => e.id !== entryId);
  saveUsers(users);
  return { success: true, journalEntries: user.journalEntries };
}

/**
 * Save a conversation for a user.
 * @param {string} username
 * @param {Object} conversation
 */
function saveConversation(username, conversation) {
  const user = users[username];
  if (!user) return { success: false, message: 'User not found.' };
  user.conversations = user.conversations || [];
  user.conversations.unshift(conversation);
  saveUsers(users);
  return { success: true, conversations: user.conversations };
}

/**
 * Delete a conversation.
 * @param {string} username
 * @param {string} conversationId
 */
function deleteConversation(username, conversationId) {
  const user = users[username];
  if (!user) return { success: false, message: 'User not found.' };
  user.conversations = (user.conversations || []).filter(c => c.id !== conversationId);
  saveUsers(users);
  return { success: true, conversations: user.conversations };
}

/**
 * Delete a user account and all their data.
 * @param {string} username
 */
function deleteAccount(username) {
  if (users[username]) {
    delete users[username];
    saveUsers(users);
  }
  // Remove all sessions for this user
  for (const [token, uname] of sessions.entries()) {
    if (uname === username) sessions.delete(token);
  }
  return { success: true, message: 'Account deleted.' };
}

/**
 * Export all user data.
 * @param {string} username
 */
function exportUserData(username) {
  const user = users[username];
  if (!user) return { success: false, message: 'User not found.' };
  return {
    success: true,
    data: {
      username: user.username,
      preferences: user.preferences,
      moodHistory: user.moodHistory || [],
      journalEntries: user.journalEntries || [],
      conversations: user.conversations || [],
      createdAt: user.createdAt
    }
  };
}

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getUserFromToken,
  updatePreferences,
  saveMoodEntry,
  saveJournalEntry,
  deleteJournalEntry,
  saveConversation,
  deleteConversation,
  deleteAccount,
  exportUserData
};