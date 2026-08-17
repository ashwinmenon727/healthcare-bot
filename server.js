/**
 * MINDORA - AI Mental Wellbeing Companion
 * Express Server - serves frontend and provides API endpoints.
 */

const express = require('express');
const path = require('path');
const { generateResponse } = require('./src/engine');
const { analyzeSentiment, classifyEmotion, detectEmphasis } = require('./src/sentiment');
const { calculateRiskScore, crisisResources } = require('./src/crisis');
const auth = require('./src/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory conversation store: sessionId -> [{role, content, sentiment, emotion}]
const sessions = new Map();

function getSession(sessionId) {
  if (!sessionId) return null;
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { messages: [], user: {} });
  }
  return sessions.get(sessionId);
}

// ─── Auth middleware ───
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = auth.getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = user;
  req.token = token;
  next();
}

// ═══════════ AUTH ENDPOINTS ═══════════

/**
 * POST /api/auth/register
 * Body: { username, password }
 */
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  const result = await auth.registerUser(username, password);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(201).json(result);
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await auth.loginUser(username, password);
  if (!result.success) {
    return res.status(401).json(result);
  }
  res.json(result);
});

/**
 * POST /api/auth/logout
 * Header: Authorization: Bearer <token>
 */
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  auth.logoutUser(token);
  res.json({ success: true, message: 'Logged out.' });
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 */
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

/**
 * PUT /api/auth/preferences
 * Header: Authorization: Bearer <token>
 * Body: { preferences }
 */
app.put('/api/auth/preferences', requireAuth, (req, res) => {
  const result = auth.updatePreferences(req.user.username, req.body.preferences || {});
  res.json(result);
});

// ═══════════ USER DATA ENDPOINTS ═══════════

/**
 * POST /api/mood
 * Header: Authorization: Bearer <token>
 * Body: { value, energy?, stress?, sleepQuality? }
 */
app.post('/api/mood', requireAuth, (req, res) => {
  const { value, energy, stress, sleepQuality } = req.body;
  if (!value || value < 1 || value > 10) {
    return res.status(400).json({ error: 'Mood value must be 1-10' });
  }
  const result = auth.saveMoodEntry(req.user.username, { value, energy, stress, sleepQuality });
  res.json(result);
});

/**
 * POST /api/journal
 * Header: Authorization: Bearer <token>
 * Body: { text, prompt?, mood? }
 */
app.post('/api/journal', requireAuth, (req, res) => {
  const { text, prompt, mood } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Journal text is required' });
  }
  const result = auth.saveJournalEntry(req.user.username, { text, prompt, mood });
  res.json(result);
});

/**
 * DELETE /api/journal/:id
 * Header: Authorization: Bearer <token>
 */
app.delete('/api/journal/:id', requireAuth, (req, res) => {
  const result = auth.deleteJournalEntry(req.user.username, req.params.id);
  res.json(result);
});

/**
 * GET /api/user/data
 * Header: Authorization: Bearer <token>
 * Returns all user data (moods, journals, conversations)
 */
app.get('/api/user/data', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      username: req.user.username,
      preferences: req.user.preferences,
      moodHistory: req.user.moodHistory || [],
      journalEntries: req.user.journalEntries || [],
      conversations: req.user.conversations || []
    }
  });
});

/**
 * GET /api/user/export
 * Header: Authorization: Bearer <token>
 * Returns all user data for export
 */
app.get('/api/user/export', requireAuth, (req, res) => {
  const result = auth.exportUserData(req.user.username);
  res.json(result);
});

/**
 * DELETE /api/user/account
 * Header: Authorization: Bearer <token>
 * Deletes the user account and all data
 */
app.delete('/api/user/account', requireAuth, (req, res) => {
  const result = auth.deleteAccount(req.user.username);
  res.json(result);
});

// ═══════════ CHAT ENDPOINTS ═══════════

/**
 * POST /api/chat
 * Body: { message: string, sessionId?: string, userName?: string }
 * Returns: { reply, sentiment, emotion, crisis, risk, sessionId }
 */
app.post('/api/chat', (req, res) => {
  const { message, sessionId, userName } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const session = getSession(sid);
  if (userName) session.user = { ...session.user, name: userName };

  // Build context for response engine
  const context = {
    userName: userName || session.user?.name || '',
    conversationHistory: session.messages.filter(m => m.role === 'user').map(m => m.content)
  };

  // Generate response
  const result = generateResponse(message, context);
  const reply = result.reply || result.message || '';

  // Store user message
  session.messages.push({
    role: 'user',
    content: message,
    sentiment: result.sentiment || analyzeSentiment(message).label,
    emotion: result.emotion || classifyEmotion(message).emotion,
    timestamp: new Date().toISOString()
  });

  // Store bot reply
  session.messages.push({
    role: 'bot',
    content: reply,
    sentiment: analyzeSentiment(reply).label,
    timestamp: new Date().toISOString()
  });

  // Persist mood tracking entry if user provided a 1-10 rating
  const moodMatch = message.match(/\b([1-9]|10)\b\s*\/\s*10/);
  if (moodMatch) {
    session.moodHistory = session.moodHistory || [];
    session.moodHistory.push({
      value: parseInt(moodMatch[1], 10),
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    reply,
    sentiment: result.sentiment,
    emotion: result.emotion,
    crisis: result.crisis || null,
    risk: result.risk || { score: 0, level: 'low' },
    technique: result.technique || null,
    tool: result.tool || null,
    sessionId: sid
  });
});

/**
 * POST /api/analyze
 * Body: { text: string }
 * Returns raw sentiment/emotion/crisis analysis (for demo/testing).
 */
app.post('/api/analyze', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const sentiment = analyzeSentiment(text);
  const emotion = classifyEmotion(text);
  const emphasis = detectEmphasis(text);
  const risk = calculateRiskScore(text);
  const resources = crisisResources(risk.score);

  res.json({
    text,
    sentiment,
    emotion,
    emphasis,
    risk,
    resources
  });
});

/**
 * GET /api/session/:sessionId
 * Returns full conversation history for a session.
 */
app.get('/api/session/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ session });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`💙 MINDORA - AI Mental Wellbeing Companion running at http://localhost:${PORT}`);
});