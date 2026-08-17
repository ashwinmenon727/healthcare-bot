/**
 * MINDORA - AI Mental Wellbeing Companion
 * Frontend Application - handles auth, dashboard, chat, and wellness tools.
 */

// ═══════════ STATE ═══════════
let sessionId = localStorage.getItem('mindora_session_id') || null;
let authToken = localStorage.getItem('mindora_token') || null;
let currentUser = null;
let isSending = false;
let currentView = 'dashboard';

const moodHistory = JSON.parse(localStorage.getItem('mindora_moods') || '[]');
const journalHistory = JSON.parse(localStorage.getItem('mindora_journals') || '[]');

// ═══════════ DOM REFERENCES ═══════════
const authView = document.getElementById('authView');
const appView = document.getElementById('appView');
const dashboardView = document.getElementById('dashboardView');
const chatView = document.getElementById('chatView');

const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const quickPrompts = document.getElementById('quickPrompts');

const breathingModal = document.getElementById('breathingModal');
const journalingModal = document.getElementById('journalingModal');
const moodModal = document.getElementById('moodModal');
const sosModal = document.getElementById('sosModal');

const moodSlider = document.getElementById('moodSlider');
const moodNumber = document.getElementById('moodNumber');
const moodEmoji = document.getElementById('moodEmoji');

// ═══════════ EMOJI MAPS ═══════════
const EMOTION_EMOJIS = {
  joy: '😊',
  sadness: '😔',
  anxiety: '😰',
  anger: '😠',
  hopelessness: '🖤',
  neutral: '😐'
};

const MOOD_EMOJIS = ['😞', '😟', '😕', '😐', '🙂', '😊', '😄', '🤩'];

function moodEmojiFor(value) {
  return MOOD_EMOJIS[Math.min(Math.floor(((value - 1) / 10) * 8), 7)];
}

function moodLabelFor(value) {
  if (value <= 2) return 'Very Low';
  if (value <= 4) return 'Low';
  if (value <= 6) return 'Neutral';
  if (value <= 8) return 'Good';
  return 'Great';
}

// ═══════════ ESCAPE HELPERS ═══════════
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatMessage(text) {
  if (!text) return '';
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?![*])(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

// ═══════════ TOOLTIP ═══════════
function showTooltip(text) {
  let tip = document.getElementById('copyTooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'copyTooltip';
    tip.className = 'tooltip';
    document.body.appendChild(tip);
  }
  tip.textContent = text;
  tip.classList.add('show');
  setTimeout(() => tip.classList.remove('show'), 1500);
}

// ═══════════ AUTH ═══════════

function showAuth() {
  authView.classList.remove('hidden');
  appView.classList.add('hidden');
}

function showApp() {
  authView.classList.add('hidden');
  appView.classList.remove('hidden');
  loadUserData();
  showView('dashboard');
}

function showView(view) {
  currentView = view;
  if (view === 'dashboard') {
    dashboardView.classList.remove('hidden');
    chatView.classList.add('hidden');
    document.querySelectorAll('[data-nav]').forEach(b => b.classList.remove('active'));
    document.getElementById('navDashboard').classList.add('active');
    renderDashboard();
  } else {
    dashboardView.classList.add('hidden');
    chatView.classList.remove('hidden');
    document.querySelectorAll('[data-nav]').forEach(b => b.classList.remove('active'));
    document.getElementById('navChat').classList.add('active');
    if (messagesArea.children.length <= 1) initWelcome();
    toggleQuickPrompts();
    messageInput.focus();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const feedback = document.getElementById('loginFeedback');

  feedback.textContent = 'Signing in...';
  feedback.className = 'auth-feedback';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!data.success) {
      feedback.textContent = data.message;
      feedback.className = 'auth-feedback error';
      return;
    }
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('mindora_token', authToken);
    showApp();
  } catch (err) {
    feedback.textContent = 'Something went wrong. Please try again.';
    feedback.className = 'auth-feedback error';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;
  const feedback = document.getElementById('registerFeedback');

  feedback.textContent = 'Creating account...';
  feedback.className = 'auth-feedback';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!data.success) {
      feedback.textContent = data.message;
      feedback.className = 'auth-feedback error';
      return;
    }
    // Auto-login after registration
    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const loginData = await loginRes.json();
    if (loginData.success) {
      authToken = loginData.token;
      currentUser = loginData.user;
      localStorage.setItem('mindora_token', authToken);
      showApp();
    }
  } catch (err) {
    feedback.textContent = 'Something went wrong. Please try again.';
    feedback.className = 'auth-feedback error';
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
  } catch (err) { }
  authToken = null;
  currentUser = null;
  localStorage.removeItem('mindora_token');
  localStorage.removeItem('mindora_session_id');
  showAuth();
}

async function loadUserData() {
  if (!authToken) return;
  try {
    const res = await fetch('/api/user/data', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.data;
      document.getElementById('dashboardUserName').textContent = currentUser.username ? ', ' + currentUser.username : '';
      renderDashboard();
    }
  } catch (err) {
    console.error('Error loading user data:', err);
  }
}

// ═══════════ DASHBOARD ═══════════

async function saveMoodFromDashboard(value) {
  if (!authToken) return;
  const feedback = document.getElementById('moodFeedback');
  feedback.textContent = 'Saving your mood...';

  try {
    const res = await fetch('/api/mood', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      },
      body: JSON.stringify({ value })
    });
    const data = await res.json();
    if (data.success) {
      feedback.textContent = "Thanks for sharing. You're feeling " + moodLabelFor(value) + " today.";
      feedback.className = 'mood-feedback success';
      loadUserData();
      renderDashboard();
    } else {
      feedback.textContent = data.message || 'Could not save mood.';
      feedback.className = 'mood-feedback error';
    }
  } catch (err) {
    feedback.textContent = 'Something went wrong. Please try again.';
    feedback.className = 'mood-feedback error';
  }
}

function renderDashboard() {
  if (!currentUser) return;

  // Today's mood
  const moods = currentUser.moodHistory || [];
  const today = new Date().toDateString();
  const todayMoods = moods.filter(m => new Date(m.timestamp).toDateString() === today);
  const todayMood = todayMoods.length > 0 ? todayMoods[todayMoods.length - 1].value : null;
  document.getElementById('todayMood').textContent = todayMood ? moodEmojiFor(todayMood) + ' ' + moodLabelFor(todayMood) : '—';

  // Recent trend
  const last7 = moods.slice(-7);
  if (last7.length >= 2) {
    const avg = last7.reduce((sum, m) => sum + m.value, 0) / last7.length;
    const trend = avg >= 7 ? 'Positive' : avg >= 5 ? 'Steady' : avg >= 3 ? 'Challenging' : 'Difficult';
    document.getElementById('moodTrend').textContent = trend;
  } else {
    document.getElementById('moodTrend').textContent = 'Keep tracking';
  }

  // Journal count
  const journals = currentUser.journalEntries || [];
  document.getElementById('journalCount').textContent = journals.length;

  // Recent journal
  const recentList = document.getElementById('recentJournalList');
  if (journals.length === 0) {
    recentList.innerHTML = '<p class="empty-state">Your journal is waiting for your first reflection.</p>';
  } else {
    recentList.innerHTML = '';
    journals.slice(0, 3).forEach(entry => {
      const div = document.createElement('div');
      div.className = 'journal-preview';
      const date = new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const text = entry.text.length > 100 ? entry.text.slice(0, 100) + '...' : entry.text;
      div.innerHTML = '<span class="journal-date">' + date + '</span><p>' + escapeHtml(text) + '</p>';
      recentList.appendChild(div);
    });
  }
}

// ═══════════ MESSAGE RENDERING ═══════════

function addMessage(content, role, meta = {}) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ' + role;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = formatMessage(content);
  messageDiv.appendChild(bubble);

  // Message actions (copy, retry, delete)
  if (role === 'bot') {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    actions.innerHTML = '<button class="action-btn copy-btn" title="Copy" aria-label="Copy response">&#128203;</button>';
    if (meta.crisis && meta.crisis.level && (meta.crisis.level === 'high' || meta.crisis.level === 'severe')) {
      actions.innerHTML += '<button class="action-btn retry-btn" title="Get a different response" aria-label="Retry">&#x1f504;</button>';
    }
    messageDiv.appendChild(actions);
  }

  if (role === 'user') {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn delete-btn';
    delBtn.title = 'Delete message';
    delBtn.setAttribute('aria-label', 'Delete message');
    delBtn.innerHTML = '&#x9425;';
    delBtn.addEventListener('click', () => {
      messageDiv.remove();
    });
    actions.appendChild(delBtn);
    messageDiv.appendChild(actions);
  }

  if (role === 'user' && meta.sentiment) {
    const metaDiv = document.createElement('div');
    metaDiv.className = 'message-meta';

    if (meta.emotion) {
      const emotionChip = document.createElement('span');
      emotionChip.className = 'emotion-chip';
      emotionChip.textContent = (EMOTION_EMOJIS[meta.emotion] || '😐') + ' ' + meta.emotion;
      metaDiv.appendChild(emotionChip);
    }

    const sentimentBadge = document.createElement('span');
    sentimentBadge.className = 'sentiment-badge sentiment-' + (meta.sentiment || 'neutral');
    sentimentBadge.textContent = meta.sentiment || 'neutral';
    metaDiv.appendChild(sentimentBadge);

    if (meta.risk && meta.risk.level && meta.risk.level !== 'low') {
      const riskBadge = document.createElement('span');
      riskBadge.className = 'risk-badge risk-' + meta.risk.level;
      riskBadge.textContent = 'Risk: ' + meta.risk.score + '/100';
      metaDiv.appendChild(riskBadge);
    }

    messageDiv.appendChild(metaDiv);
  }

  if (role === 'bot' && meta.crisis && meta.crisis.level && (meta.crisis.level === 'high' || meta.crisis.level === 'severe')) {
    const banner = document.createElement('div');
    banner.className = 'crisis-banner';

    const title = document.createElement('h4');
    title.textContent = ' Crisis resources';

    const list = document.createElement('ul');
    (meta.crisis.resources || []).forEach(r => {
      const li = document.createElement('li');
      li.innerHTML = '<strong>' + escapeHtml(r.name || '') + '</strong>: ' + escapeHtml(r.detail || '');
      list.appendChild(li);
    });

    banner.appendChild(title);
    banner.appendChild(list);
    messageDiv.appendChild(banner);
  }

  // Add event listener for copy button
  const copyBtn = messageDiv.querySelector('.copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const textToCopy = bubble.textContent || bubble.innerText;
      navigator.clipboard.writeText(textToCopy).then(() => {
        showTooltip('Copied!');
      }).catch(() => {
        showTooltip('Could not copy');
      });
    });
  }

  messagesArea.appendChild(messageDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
  return messageDiv;
}

function addBotMessage(content, meta = {}) {
  addMessage(content, 'bot', meta);
}

function showTyping() {
  const typing = document.createElement('div');
  typing.className = 'message bot';
  typing.id = 'typingIndicator';
  typing.innerHTML = '<div class="message-bubble typing-indicator"><span></span><span></span><span></span></div>';
  messagesArea.appendChild(typing);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function removeTypingIndicator() {
  const typing = document.getElementById('typingIndicator');
  if (typing) typing.remove();
}

// ═══════════ QUICK PROMPTS ═══════════

function toggleQuickPrompts() {
  if (!quickPrompts) return;
  const messageCount = messagesArea.querySelectorAll('.message').length;
  // Show quick prompts when there is only the welcome message (or no messages)
  if (messageCount <= 1) {
    quickPrompts.classList.remove('hidden');
  } else {
    quickPrompts.classList.add('hidden');
  }
}

// ═══════════ WELCOME / RESET ═══════════

function initWelcome() {
  addBotMessage(
    "Hello! I'm **MINDORA**, your AI mental wellbeing companion.\n\nI'm here to listen without judgment, help you understand difficult feelings, and teach you practical tools like breathing, grounding, and journaling.\n\n**How are you feeling today?**"
  );
  toggleQuickPrompts();
}

function startNewChat() {
  sessionId = null;
  localStorage.removeItem('mindora_session_id');
  messagesArea.innerHTML = '';
  messageInput.value = '';
  initWelcome();
}

// ═══════════ CHAT LOGIC ═══════════

// Store last user message for retry
let lastUserMessage = '';
let lastSessionId = null;
let messageSentCount = 0;

/**
 * Resend the last user message (retry).
 */
async function retryLastMessage() {
  if (!lastUserMessage) return;
  messageInput.value = lastUserMessage;
  await sendMessage();
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || isSending) return;

  messageInput.value = '';
  messageInput.focus();

  // Track last message for retry
  lastUserMessage = text;
  lastSessionId = sessionId;

  addMessage(text, 'user', {});
  toggleQuickPrompts();

  messageSentCount++;
  isSending = true;
  sendBtn.disabled = true;
  showTyping();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, sessionId })
    });

    if (!response.ok) throw new Error('Server error');

    const data = await response.json();
    sessionId = data.sessionId;
    lastSessionId = sessionId;
    localStorage.setItem('mindora_session_id', sessionId);

    // Annotate last user message with sentiment/emotion
    const userDivs = messagesArea.querySelectorAll('.message.user');
    if (userDivs.length) {
      const lastUserDiv = userDivs[userDivs.length - 1];
      lastUserDiv.querySelectorAll('.message-meta').forEach(el => el.remove());

      const metaDiv = document.createElement('div');
      metaDiv.className = 'message-meta';

      if (data.emotion) {
        const emotionChip = document.createElement('span');
        emotionChip.className = 'emotion-chip';
        emotionChip.textContent = (EMOTION_EMOJIS[data.emotion] || '😐') + ' ' + data.emotion;
        metaDiv.appendChild(emotionChip);
      }

      const sentimentBadge = document.createElement('span');
      sentimentBadge.className = 'sentiment-badge sentiment-' + (data.sentiment || 'neutral');
      sentimentBadge.textContent = data.sentiment || 'neutral';
      metaDiv.appendChild(sentimentBadge);

      if (data.risk && data.risk.level && data.risk.level !== 'low') {
        const riskBadge = document.createElement('span');
        riskBadge.className = 'risk-badge risk-' + data.risk.level;
        riskBadge.textContent = 'Risk: ' + data.risk.score + '/100';
        metaDiv.appendChild(riskBadge);
      }

      lastUserDiv.appendChild(metaDiv);
    }

    removeTypingIndicator();

    addBotMessage(data.reply, {
      crisis: data.crisis,
      risk: data.risk
    });

  } catch (err) {
    removeTypingIndicator();
    addBotMessage('I had trouble reaching my support service. Please try again in a moment. If this continues, please reach out to a trusted person or crisis resource.');
    console.error('Chat error:', err);
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

// ═══════════ MODAL HELPERS ═══════════

function openModal(modal) {
  if (modal) modal.classList.add('active');
}

function closeModal(modal) {
  if (modal) modal.classList.remove('active');
}

// ═══════════ BREATHING EXERCISE ═══════════

let breathingTimer = null;
let breathingRunning = false;
let phaseInterval = null;

const BREATHING_PHASES = [
  { label: 'Breathe In', durationMs: 4000 },
  { label: 'Hold', durationMs: 4000 },
  { label: 'Breathe Out', durationMs: 4000 },
  { label: 'Hold', durationMs: 4000 }
];

function startBreathing() {
  if (breathingRunning) return;
  breathingRunning = true;

  document.getElementById('startBreathingBtn').disabled = true;
  document.getElementById('pauseBreathingBtn').disabled = false;

  const circle = document.getElementById('breathingCircle');
  const phaseEl = document.getElementById('breathingPhase');
  const countEl = document.getElementById('breathingCount');

  let phaseIndex = 0;

  function runPhase() {
    if (!breathingRunning) return;
    const phase = BREATHING_PHASES[phaseIndex % BREATHING_PHASES.length];

    circle.style.transform = phaseIndex % 4 === 0 ? 'scale(1.15)' : phaseIndex % 4 === 2 ? 'scale(1)' : 'scale(1.15)';
    circle.style.boxShadow = phaseIndex % 4 === 1 ? '0 12px 48px rgba(74,124,247,0.45)' : '0 8px 40px rgba(74,124,247,0.3)';

    phaseEl.textContent = phase.label;

    const totalSeconds = phase.durationMs / 1000;
    countEl.textContent = String(totalSeconds);
    let remaining = totalSeconds;

    if (phaseInterval) clearInterval(phaseInterval);
    phaseInterval = setInterval(() => {
      remaining -= 1;
      countEl.textContent = remaining > 0 ? String(remaining) : '0';
    }, 1000);

    breathingTimer = setTimeout(() => {
      clearInterval(phaseInterval);
      phaseIndex++;
      runPhase();
    }, phase.durationMs);
  }

  runPhase();
}

function pauseBreathing() {
  breathingRunning = false;
  clearTimeout(breathingTimer);
  clearInterval(phaseInterval);
  document.getElementById('startBreathingBtn').disabled = false;
  document.getElementById('pauseBreathingBtn').disabled = true;
  document.getElementById('breathingPhase').textContent = 'Paused';
  document.getElementById('breathingCount').textContent = '💙';
  document.getElementById('breathingCircle').style.transform = 'scale(1)';
  document.getElementById('breathingCircle').style.boxShadow = '0 8px 40px rgba(74,124,247,0.3)';
}

// ═══════════ JOURNALING ═══════════

const JOURNAL_PROMPTS = [
  '"My mind is feeling ___, and what I need right now is ___."',
  '"Today I noticed ___ in my body, and I think it connects to ___."',
  '"If my feelings could speak, they would say ___."',
  '"One small thing I did well today was ___."',
  '"The part of me that is hurting needs ___."',
  '"This week, I want to let go of ___ and hold onto ___."',
  '"When I look at my emotions right now, I see ___."',
  '"I forgive myself for ___."',
  '"One way I can be kind to myself today is ___."'
];

let currentPromptIndex = 0;

function showRandomJournalPrompt() {
  currentPromptIndex = Math.floor(Math.random() * JOURNAL_PROMPTS.length);
  document.getElementById('journalPrompt').textContent = JOURNAL_PROMPTS[currentPromptIndex];
  document.getElementById('journalText').value = '';
  document.getElementById('journalFeedback').textContent = '';
}

async function saveJournal() {
  const text = document.getElementById('journalText').value.trim();
  if (!text) {
    document.getElementById('journalFeedback').textContent = 'Write a few words first — no pressure.';
    return;
  }

  if (authToken) {
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + authToken
        },
        body: JSON.stringify({
          text: text,
          prompt: JOURNAL_PROMPTS[currentPromptIndex]
        })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('journalFeedback').textContent = 'Saved! Would you like to write another?';
        document.getElementById('journalText').value = '';
        loadUserData();
      } else {
        document.getElementById('journalFeedback').textContent = data.message || 'Could not save.';
      }
    } catch (err) {
      document.getElementById('journalFeedback').textContent = 'Could not save. Please try again.';
    }
  } else {
    journalHistory.unshift({
      prompt: JOURNAL_PROMPTS[currentPromptIndex],
      text: text,
      date: new Date().toISOString()
    });
    localStorage.setItem('mindora_journals', JSON.stringify(journalHistory.slice(0, 20)));
    document.getElementById('journalFeedback').textContent = 'Saved! Would you like to write another?';
    document.getElementById('journalText').value = '';
  }
}

// ═══════════ MOOD TRACKER ═══════════

function updateMoodDisplay() {
  const value = parseInt(moodSlider.value, 10);
  moodNumber.textContent = value;
  moodEmoji.textContent = moodEmojiFor(value);
}

function renderMoodHistory() {
  const list = document.getElementById('moodHistoryList');
  list.innerHTML = '';

  if (moodHistory.length === 0) {
    list.innerHTML = '<p style="color: var(--text-light); font-size: 13px;">No moods tracked yet.</p>';
    return;
  }

  const recent = [...moodHistory].slice(-5).reverse();
  recent.forEach(m => {
    const entry = document.createElement('div');
    entry.className = 'mood-entry';
    const d = new Date(m.time);
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    entry.innerHTML = '<span>' + moodEmojiFor(m.value) + ' ' + m.value + '/10</span><span>' + time + '</span>';
    list.appendChild(entry);
  });
}

async function saveMood() {
  const value = parseInt(moodSlider.value, 10);
  moodHistory.push({ value: value, time: new Date().toISOString() });
  localStorage.setItem('mindora_moods', JSON.stringify(moodHistory));
  renderMoodHistory();

  if (authToken) {
    try {
      await fetch('/api/mood', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + authToken
        },
        body: JSON.stringify({ value: value })
      });
      loadUserData();
    } catch (err) {
      // Ignore - local save already happened
    }
  }

  messageInput.value = "I'm feeling " + value + "/10 right now.";
  await sendMessage();
}

// ═══════════ TOOL HANDLER ═══════════

function handleTool(tool) {
  if (tool === 'sos') {
    openModal(sosModal);
    return;
  }
  if (tool === 'breathing') {
    openModal(breathingModal);
    return;
  }
  if (tool === 'journaling') {
    showRandomJournalPrompt();
    openModal(journalingModal);
    return;
  }
  if (tool === 'mood') {
    updateMoodDisplay();
    renderMoodHistory();
    openModal(moodModal);
    return;
  }
  if (tool === 'grounding') {
    addBotMessage(
      "5-4-3-2-1 Grounding Exercise\n\nLook around and name:\n\u2022 5 things you can see\n\u2022 4 things you can touch\n\u2022 3 things you can hear\n\u2022 2 things you can smell\n\u2022 1 thing you can taste\n\nTake your time with each one. What did you notice?"
    );
    if (currentView !== 'chat') showView('chat');
    return;
  }
  if (tool === 'gratitude') {
    addBotMessage(
      "Let's try a gratitude check-in. Name three things \u2014 however small \u2014 you're grateful for today.\n\n1. ...\n2. ...\n3. ...\n\nWhat's one of yours?"
    );
    if (currentView !== 'chat') showView('chat');
    return;
  }
}

// ═══════════ EVENT LISTENERS ═══════════

// Auth
document.getElementById('loginForm').addEventListener('submit', handleLogin);
document.getElementById('registerForm').addEventListener('submit', handleRegister);
document.getElementById('loginTab').addEventListener('click', function() {
  document.getElementById('loginTab').classList.add('active');
  document.getElementById('registerTab').classList.remove('active');
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('registerForm').classList.add('hidden');
});
document.getElementById('registerTab').addEventListener('click', function() {
  document.getElementById('registerTab').classList.add('active');
  document.getElementById('loginTab').classList.remove('active');
  document.getElementById('registerForm').classList.remove('hidden');
  document.getElementById('loginForm').classList.add('hidden');
});
document.getElementById('logoutBtn').addEventListener('click', handleLogout);

// Navigation
document.querySelectorAll('[data-nav]').forEach(function(btn) {
  btn.addEventListener('click', function() { showView(btn.dataset.nav); });
});
document.getElementById('dashboardChatBtn').addEventListener('click', function() { showView('chat'); });

// Mood selector on dashboard
document.querySelectorAll('.mood-option').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.mood-option').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    saveMoodFromDashboard(parseInt(btn.dataset.mood, 10));
  });
});

// Chat
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') sendMessage();
});
resetBtn.addEventListener('click', startNewChat);

// Quick prompts
if (quickPrompts) {
  quickPrompts.addEventListener('click', function(e) {
    const btn = e.target.closest('.quick-prompt-btn');
    if (btn && btn.dataset.prompt) {
      messageInput.value = btn.dataset.prompt;
      sendMessage();
    }
  });
}

// Quick action & sidebar tool buttons
document.querySelectorAll('[data-tool]').forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    handleTool(btn.dataset.tool);
  });
});

// Modal close buttons
document.querySelectorAll('[data-close]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    closeModal(document.getElementById(btn.dataset.close));
  });
});

// Click outside modal closes it
document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeModal(overlay);
  });
});

// Breathing controls
document.getElementById('startBreathingBtn').addEventListener('click', startBreathing);
document.getElementById('pauseBreathingBtn').addEventListener('click', pauseBreathing);

// Journal
document.getElementById('newPromptBtn').addEventListener('click', showRandomJournalPrompt);
document.getElementById('saveJournalBtn').addEventListener('click', saveJournal);

// Mood
moodSlider.addEventListener('input', updateMoodDisplay);
document.getElementById('saveMoodBtn').addEventListener('click', saveMood);

// ESC closes modals
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(function(overlay) {
      closeModal(overlay);
    });
  }
});

// Stop breathing when closing the breathing modal
breathingModal.addEventListener('click', function(e) {
  if (e.target === breathingModal || e.target.dataset && e.target.dataset.close === 'breathingModal') {
    pauseBreathing();
  }
});

// Copy button retry handler (for retry buttons on bot messages)
document.addEventListener('click', function(e) {
  if (e.target.classList && e.target.classList.contains('retry-btn')) {
    retryLastMessage();
  }
});

// ═══════════ INIT ═══════════

function init() {
  if (authToken) {
    fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + authToken }
    }).then(function(res) {
      if (res.ok) {
        showApp();
      } else {
        authToken = null;
        localStorage.removeItem('mindora_token');
        showAuth();
      }
    }).catch(function() { showAuth(); });
  } else {
    showAuth();
  }
  initWelcome();
}

init();
