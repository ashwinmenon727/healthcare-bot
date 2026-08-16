/**
 * MindCare Chatbot - Express Server
 * Serves the frontend and provides /api endpoints for chat, analysis, and mood tracking.
 */

const express = require('express');
const path = require('path');
const { generateResponse } = require('./src/engine');
const { analyzeSentiment, classifyEmotion, detectEmphasis } = require('./src/sentiment');
const { calculateRiskScore, crisisResources } = require('./src/crisis');

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
