/**
 * MindCare Chatbot - Frontend Application
 * Handles chat interaction, sentiment badges, crisis banners, and wellness tool modals.
 */

// ═══════════ STATE ═══════════
let sessionId = localStorage.getItem('mindcare_session_id') || null;
let isSending = false;

const moodHistory = JSON.parse(localStorage.getItem('mindcare_moods') || '[]');
const journalHistory = JSON.parse(localStorage.getItem('mindcare_journals') || '[]');

// ═══════════ DOM REFERENCES ═══════════
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');

const breathingModal = document.getElementById('breathingModal');
const journalingModal = document.getElementById('journalingModal');
const moodModal = document.getElementById('moodModal');
const sosModal = document.getElementById('sosModal');

const moodSlider = document.getElementById('moodSlider');
const moodNumber = document.getElementById('moodNumber');
const moodEmoji = document.getElementById('moodEmoji');

// ═══════════ EMOTION EMOJI MAP ═══════════
const EMOTION_EMOJIS = {
  joy: '😊',
  sadness: '😔',
  anxiety: '😰',
  anger: '😠',
  hopelessness: '🖤',
  neutral: '😐'
};

const MOOD_EMOJIS = ['😞', '😟', '😕', '😐', '🙂', '😊', '😄', '🤩'];

/** Map a 1-10 mood value to an emoji index 0-7 */
function moodToEmoji(value) {
  const idx = Math.min(Math.floor(((value - 1) / 10) * 8), 7);
  return MOOD_EMOJIS[idx];
}

/** ═══════════ MESSAGE RENDERING ═══════════ */
// Escape helpers using char codes to avoid parser/formatter mangling
const AMP = String.fromCharCode(38);  // &
const LT = String.fromCharCode(60);   // <
const GT = String.fromCharCode(62);   // >

function escapeHtml(str) {
  return String(str)
    .replace(new RegExp(AMP, 'g'), AMP + 'amp;')
    .replace(new RegExp(LT, 'g'), LT + '#x3c;')
    .replace(new RegExp(GT, 'g'), GT + '#x3e;');
}

function formatMessage(text) {
  if (!text) return '';
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?![*])(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

function addMessage(content, role, meta = {}) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = formatMessage(content);
  messageDiv.appendChild(bubble);

  // Sentiment / emotion meta for user messages
  if (role === 'user' && meta.sentiment) {
    const metaDiv = document.createElement('div');
    metaDiv.className = 'message-meta';

    if (meta.emotion) {
      const emotionChip = document.createElement('span');
      emotionChip.className = 'emotion-chip';
      emotionChip.textContent = `${EMOTION_EMOJIS[meta.emotion] || '😐'} ${meta.emotion}`;
      metaDiv.appendChild(emotionChip);
    }

    const sentimentBadge = document.createElement('span');
    sentimentBadge.className = `sentiment-badge sentiment-${meta.sentiment}`;
    sentimentBadge.textContent = meta.sentiment;
    metaDiv.appendChild(sentimentBadge);

    if (meta.risk && meta.risk.level && meta.risk.level !== 'low') {
      const riskBadge = document.createElement('span');
      riskBadge.className = `risk-badge risk-${meta.risk.level}`;
      riskBadge.textContent = `Risk: ${meta.risk.score}/100`;
      metaDiv.appendChild(riskBadge);
    }

    messageDiv.appendChild(metaDiv);
  }

  // Crisis banner for high/severe risk bot replies
  if (role === 'bot' && meta.crisis && meta.crisis.level && (meta.crisis.level === 'high' || meta.crisis.level === 'severe')) {
    const banner = document.createElement('div');
    banner.className = 'crisis-banner';

    const title = document.createElement('h4');
    title.textContent = '🚨 Crisis resources';

    const list = document.createElement('ul');
    (meta.crisis.resources || []).forEach(r => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${escapeHtml(r.name || '')}</strong>: ${escapeHtml(r.detail || '')}`;
      list.appendChild(li);
    });

    banner.appendChild(title);
    banner.appendChild(list);
    messageDiv.appendChild(banner);
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

/** ═══════════ WELCOME / RESET ═══════════ */
function initWelcome() {
  addBotMessage(
    "Hello! I'm **MindCare**, your mental wellness companion. 💙\n\nI'm here to listen without judgment, help you understand difficult feelings, and teach you practical tools like breathing, grounding, and journaling.\n\n**How are you feeling today?**"
  );
}

function startNewChat() {
  sessionId = null;
  localStorage.removeItem('mindcare_session_id');
  messagesArea.innerHTML = '';
  initWelcome();
}

/** ═══════════ CHAT LOGIC ═══════════ */
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || isSending) return;

  messageInput.value = '';
  messageInput.focus();

  // Add user bubble (meta will be updated after the API returns analysis)
  addMessage(text, 'user', {});

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
    localStorage.setItem('mindcare_session_id', sessionId);

    // Replace the empty user bubble meta with real sentiment analysis
    const userDivs = messagesArea.querySelectorAll('.message.user');
    if (userDivs.length) {
      const lastUserDiv = userDivs[userDivs.length - 1];

      // Remove any placeholder meta
      lastUserDiv.querySelectorAll('.message-meta').forEach(el => el.remove());

      const metaDiv = document.createElement('div');
      metaDiv.className = 'message-meta';

      if (data.emotion) {
        const emotionChip = document.createElement('span');
        emotionChip.className = 'emotion-chip';
        emotionChip.textContent = `${EMOTION_EMOJIS[data.emotion] || '😐'} ${data.emotion}`;
        metaDiv.appendChild(emotionChip);
      }

      const sentimentBadge = document.createElement('span');
      sentimentBadge.className = `sentiment-badge sentiment-${data.sentiment || 'neutral'}`;
      sentimentBadge.textContent = data.sentiment || 'neutral';
      metaDiv.appendChild(sentimentBadge);

      if (data.risk && data.risk.level && data.risk.level !== 'low') {
        const riskBadge = document.createElement('span');
        riskBadge.className = `risk-badge risk-${data.risk.level}`;
        riskBadge.textContent = `Risk: ${data.risk.score}/100`;
        metaDiv.appendChild(riskBadge);
      }

      lastUserDiv.appendChild(metaDiv);
    }

    removeTypingIndicator();

    // Bot reply (crisis banner will render automatically for high/severe)
    addBotMessage(data.reply, {
      crisis: data.crisis,
      risk: data.risk
    });

  } catch (err) {
    removeTypingIndicator();
    addBotMessage('I had trouble reaching my support service. Please try again in a moment. If this continues, please reach out to a trusted person or crisis resource. 💙');
    console.error('Chat error:', err);
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

/** ═══════════ MODAL HELPERS ═══════════ */
function openModal(modal) {
  if (modal) modal.classList.add('active');
}

function closeModal(modal) {
  if (modal) modal.classList.remove('active');
}

/** ═══════════ BREATHING EXERCISE ═══════════ */
let breathingTimer = null;
let breathingRunning = false;
let phaseInterval = null;

const BREATHING_PHASES = [
  { label: 'Breathe In', durationMs: 4000, cssClass: 'phase-in' },
  { label: 'Hold', durationMs: 4000, cssClass: 'phase-hold' },
  { label: 'Breathe Out', durationMs: 4000, cssClass: 'phase-out' },
  { label: 'Hold', durationMs: 4000, cssClass: 'phase-hold' }
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

    circle.classList.remove('phase-in', 'phase-hold', 'phase-out');
    void circle.offsetWidth; // force reflow
    circle.classList.add(phase.cssClass);

    phaseEl.textContent = phase.label;

    // Countdown display
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
  document.getElementById('breathingCircle').classList.remove('phase-in', 'phase-hold', 'phase-out');
}

/** ═══════════ JOURNALING ═══════════ */
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
  document.getElementById('journalPrompt').textContent = `${JOURNAL_PROMPTS[currentPromptIndex]}`;
  document.getElementById('journalText').value = '';
  document.getElementById('journalFeedback').textContent = '';
}

function saveJournal() {
  const text = document.getElementById('journalText').value.trim();
  if (!text) {
    document.getElementById('journalFeedback').textContent = 'Write a few words first — no pressure. 💙';
    return;
  }

  journalHistory.unshift({
    prompt: JOURNAL_PROMPTS[currentPromptIndex],
    text,
    date: new Date().toISOString()
  });

  localStorage.setItem('mindcare_journals', JSON.stringify(journalHistory.slice(0, 20)));
  document.getElementById('journalFeedback').textContent = 'Saved 💙 Would you like to write another?';
  document.getElementById('journalText').value = '';
}

/** ═══════════ MOOD TRACKER ═══════════ */
function updateMoodDisplay() {
  const value = parseInt(moodSlider.value, 10);
  moodNumber.textContent = value;
  moodEmoji.textContent = moodEmojiFor(value);
}

function moodEmojiFor(value) {
  return MOOD_EMOJIS[Math.min(Math.floor(((value - 1) / 10) * 8), 7)];
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
    entry.innerHTML = `<span>${moodEmojiFor(m.value)} ${m.value}/10</span><span>${time}</span>`;
    list.appendChild(entry);
  });
}

function saveMood() {
  const value = parseInt(moodSlider.value, 10);
  moodHistory.push({ value, time: new Date().toISOString() });
  localStorage.setItem('mindcare_moods', JSON.stringify(moodHistory));
  renderMoodHistory();

  // Send mood check-in as a chat message for engagement
  messageInput.value = `I'm feeling ${value}/10 right now.`;
  sendMessage();
}

/** ═══════════ TOOL HANDLER ═══════════ */
function handleTool(tool) {
  switch (tool) {
    case 'breathing':
      openModal(breathingModal);
      break;
    case 'journaling':
      showRandomJournalPrompt();
      openModal(journalingModal);
      break;
    case 'mood':
      updateMoodDisplay();
      renderMoodHistory();
      openModal(moodModal);
      break;
    case 'grounding':
      addBotMessage(
        "🌿 **5-4-3-2-1 Grounding Exercise**\n\nLook around and name:\n• **5** things you can see\n• **4** things you can touch\n• **3** things you can hear\n• **2** things you can smell\n• **1** thing you can taste\n\nTake your time with each one. What did you notice?"
      );
      break;
    case 'gratitude':
      addBotMessage(
        "🙏 Let's try a gratitude check-in. Name three things — however small — you're grateful for today.\n\n1. ...\n2. ...\n3. ...\n\nWhat's one of yours?"
      );
      break;
    case 'sos':
      openModal(sosModal);
      break;
    default:
      break;
  }
}

/** ═══════════ EVENT LISTENERS ═══════════ */
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

resetBtn.addEventListener('click', startNewChat);

// Quick action & sidebar tool buttons
document.querySelectorAll('[data-tool]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    handleTool(btn.dataset.tool);
  });
});

// Modal close buttons
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    closeModal(document.getElementById(btn.dataset.close));
  });
});

// Click outside modal closes it
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
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
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(overlay => closeModal(overlay));
  }
});

// Stop breathing when closing the breathing modal
breathingModal.addEventListener('click', (e) => {
  if (e.target === breathingModal || e.target.dataset?.close === 'breathingModal') {
    pauseBreathing();
  }
});

/** ═══════════ INIT ═══════════ */
initWelcome();