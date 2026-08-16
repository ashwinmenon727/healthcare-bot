/**
 * MindCare Response Engine
 *
 * Generates empathetic, evidence-based responses following the MindCare System Prompt:
 *  - Validates emotions
 *  - Uses CBT, DBT, Motivational Interviewing techniques
 *  - Calibrates responses by sentiment & emotion
 *  - Follows crisis protocol for high-risk messages
 *  - Maintains conversation continuity
 *  - Suggests wellness tools contextually
 */

const { analyzeSentiment, classifyEmotion, detectEmphasis } = require('./sentiment');
const { calculateRiskScore, crisisResources } = require('./crisis');

/** Wellness tools offered contextually */
const WELLNESS_TOOLS = {
  breathing: '🫁 Would a 5-minute breathing exercise help right now? Try box breathing: breathe in for 4, hold for 4, out for 4, hold for 4.',
  grounding: `🌿 Let's try a grounding technique. Look around and name: 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste.`,
  journaling: '📔 Would journaling help you sort through your thoughts? A good prompt: "What was one small win today, even if it feels tiny?"',
  mood: '📊 Would you like to track your mood? On a scale of 1-10, how are you feeling right now?',
  movement: '🚶 A gentle walk or stretching might help shift your energy. Would a 10-minute movement break work for you?',
  gratitude: '🙏 Sometimes naming three things you appreciate, however small, can lift the weight. Want to try that together?'
};

/** =====================================================
 *  Small-talk / general conversation handling
 * ===================================================== */
function handleGeneralConversation(text, context = {}) {
  const lowered = text.toLowerCase().trim();
  const name = context.userName ? ` ${context.userName}` : '';

  // Greetings
  if (/^(hi|hello|hey|yo|good\s(morning|afternoon|evening))\b/.test(lowered) ||
      /^(hi|hello|hey)[\s!,.]*$/.test(lowered)) {
    return `Hello${name}! I'm MindCare, your mental wellness companion. 💙 How are you feeling today?`;
  }

  if (/how are you/.test(lowered)) {
    return "I'm here and ready to support you — that's what matters most. 💙 More importantly, how are *you* doing today?";
  }

  // Thanks
  if (/thank(s| you)?\b/.test(lowered) || /appreciate it/.test(lowered)) {
    return "You're very welcome. It means a lot that you're taking care of yourself. 💙 Is there anything else on your mind?";
  }

  // Bye
  if (/^(bye|goodbye|see you|good night|gtg)\b/.test(lowered)) {
    return "Take care of yourself, okay? I'm always here when you need someone to talk to. Remember to be kind to yourself. 💙";
  }

  // Who are you
  if (/who are you|what are you|your name/.test(lowered)) {
    return `I'm MindCare — an empathetic AI mental health support companion. 💙 I'm designed to listen without judgment, help you explore difficult feelings, teach wellness tools, and connect you with professional help when needed. I'm not a replacement for therapy, but I'm here whenever you need to talk.`;
  }

  // Help options
  if (/what can you (do|help)|help me|how do you work/.test(lowered)) {
    return `I can:
• 💬 Listen and talk through anything on your mind
• 😔 Help you understand and manage emotions like stress, anxiety, or sadness
• 🌿 Teach you breathing, grounding, and journaling exercises
• 📊 Track your mood over time
• 🆘 Connect you with crisis resources when you need them most

What would be most helpful for you right now?`;
  }

  // Feeling check-in
  if (/i('m| am) (fine|okay|ok|good|better|alright|doing (well|alright|okay))/i.test(lowered)) {
    return `I'm glad to hear that${name}. 💙 Even "okay" is worth honoring. Is there anything you want to build on, or maybe talk about before it passes?`;
  }

  return null;
}

/** ====================================================
 *  Intent detection for wellness tools & features
 * ==================================================== */
function detectToolIntent(text) {
  const lowered = text.toLowerCase();

  if (/(breath|breathe|breathing|box breathing)/.test(lowered)) {
    return {
      tool: 'breathing',
      response: `Let's practice box breathing together 🫁\n\n**1.** Breathe in for **4 seconds**\n**2.** Hold for **4 seconds**\n**3.** Breathe out for **4 seconds**\n**4.** Hold for **4 seconds**\n\nRepeat for 5 minutes. Follow with me — in... hold... out... hold...\n\nHow do you feel after a few rounds?`
    };
  }

  if (/(ground|grounding|5-4-3-2-1|senses|sensory)/.test(lowered)) {
    return {
      tool: 'grounding',
      response: `🌿 **5-4-3-2-1 Grounding Exercise**\n\nLook around and name:\n• **5** things you can see\n• **4** things you can touch\n• **3** things you can hear\n• **2** things you can smell\n• **1** thing you can taste\n\nTake your time with each one. This brings your mind back to the present moment. What did you notice?`
    };
  }

  if (/(journal|journaling|write|prompt)/.test(lowered)) {
    return {
      tool: 'journaling',
      response: `📔 **Journaling Prompt**\n\nHere's a gentle prompt to start:\n\n"My mind is feeling ___, and what I need right now is ___."\n\nWrite a few sentences — there's no right or wrong way. What came up for you?`
    };
  }

  if (/(mood|rating|track my mood|check[- ]?in)/.test(lowered)) {
    return {
      tool: 'mood',
      response: `📊 On a scale of 1-10, how are you feeling right now?\n\n(1 = in a very dark place, 10 = amazing)\n\nJust a number is fine — we'll track your pattern over time.`
    };
  }

  if (/(movement|exercise|walk|stretch|yoga)/.test(lowered)) {
    return {
      tool: 'movement',
      response: `🚶 Even a gentle 5-minute walk or a few shoulder rolls can shift your energy. Would a 10-minute movement break work for you?`
    };
  }

  if (/(grateful|gratitude|thankful)/.test(lowered)) {
    return {
      tool: 'gratitude',
      response: `🙏 Let's try a gratitude check-in. Name three things — however small — you're grateful for today.\n\n1. ...\n2. ...\n3. ...\n\nWhat's one of yours?`
    };
  }

  if (/(meditat|mindful|calm|relax)/.test(lowered)) {
    return {
      tool: 'meditation',
      response: `🧘 Let's do a short mindfulness exercise together.\n\nClose your eyes (or soften your gaze) and take three slow breaths. For each one, notice the air filling you and then leaving.\n\nNow notice: what's one sound you can hear that you didn't notice before?\n\nStay here for 30 more seconds, then tell me what you noticed.`
    };
  }

  if (/(sos|emergency|danger|help me now)/.test(lowered)) {
    return {
      tool: 'sos',
      response: `🚨 If you are in immediate danger, please call **911** (or your local emergency number) right now.\n\nYou can also text **HOME** to **741741** (Crisis Text Line) — a trained crisis counselor responds within minutes.\n\nI'm going to stay with you. Are you safe at this moment?`
    };
  }

  return null;
}

/** =====================================================
 *  Crisis Response Generation (MindCare Crisis Protocol)
 * ===================================================== */
function buildCrisisResponse(risk, analysis, context = {}) {
  const { score, level } = risk;
  const name = context.userName ? context.userName : '';
  const resources = crisisResources(score);

  const validateLine = `I'm really glad you chose to tell me this${name ? ', ' + name : ''}. It takes a lot of courage to put words to that level of pain.`;

  if (level === 'severe') {
    const resourceList = resources.shown.map(r => `• **${r.name}**: ${r.detail}`).join('\n');
    return {
      reply: `${validateLine} 💙\n\nI'm deeply concerned about your safety right now.\n\n${resourceList}\n\nIf you are in immediate danger or have a plan, please call ***911*** right now. Crisis counselors are trained for exactly this moment — they will not judge you, and they can keep you safe.\n\nI'm staying with you as long as you need. Are you physically in a safe place this moment?`,
      message: `${validateLine} 💙\n\nI'm deeply concerned about your safety right now.\n\n${resourceList}\n\nIf you are in immediate danger or have a plan, please call ***911*** right now. Crisis counselors are trained for exactly this moment — they will not judge you, and they can keep you safe.\n\nI'm staying with you as long as you need. Are you physically in a safe place this moment?`,
      crisis: { score, level, resources: resources.shown, escalated: true }
    };
  }

  if (level === 'high') {
    const resourceList = resources.shown.map(r => `• **${r.name}**: ${r.detail}`).join('\n');
    const highReply = `${validateLine} 💙\n\nI'm hearing how much pain you're in. This is beyond what I can safely support alone, and that's okay. Please reach out to one of these crisis services right now:\n\n${resourceList}\n\nYou don't have to face this alone. Even one call or text changes the next hour. Can you reach out to one of these right now — and I'll stay here while you do?`;
    return {
      reply: highReply,
      message: highReply,
      crisis: { score, level, message: highReply, resources: resources.shown, escalated: true }
    };
  }

  // Moderate or low
  const resourceList = resources.shown.map(r => `• **${r.name}**: ${r.detail}`).join('\n');
  return {
    message: `I'm hearing how much weight you're carrying. 💙\n\nHere are some resources that might help:\n\n${resourceList}\n\nWould you like to tell me more about what's bringing you to this place?`,
    reply: `I'm hearing how much weight you're carrying. 💙\n\nHere are some resources that might help:\n\n${resourceList}\n\nWould you like to tell me more about what's bringing you to this place?`,
    crisis: { score, level, resources: resources.shown, escalated: false }
  };
}

/** =====================================================
 *  Emotion-Specific Empathetic Responses
 * ===================================================== */
function buildEmotionResponse(userText, analysis, context = {}) {
  const { sentiment, emotion } = analysis;
  const name = context.userName ? ` ${context.userName}` : '';

  switch (emotion) {
    case 'hopelessness':
      return `I hear that you're in real pain${name}. That feeling of being trapped and seeing no way out is incredibly heavy to carry — and I'm glad you chose to share it with me instead of holding it alone. 💙

These feelings insist they're permanent, but they aren't facts. They shift — sometimes slowly, sometimes suddenly. I'm so sorry it hurts this much right now.

Can I ask — have you been thinking of hurting yourself? And what would you say about the thought "nothing ever changes"? Take your time. I'm not going anywhere.`;

    case 'sadness':
      return `That sounds really heavy${name}. It's completely natural to feel sadness — it's a signal that something matters deeply to you. And that's actually the opposite of weakness. 🥲

Would you be willing to tell me a little more about what's pulling you down? I'm here — no rush at all.`;

    case 'anxiety':
      return `I can feel how much your mind is racing right now${name}, and I understand. Anxiety is a very loud alarm system — it's trying to protect you, but sometimes it goes off when there's no real danger. 🫁

Let's slow this down, just for a moment. Tell me what specific worry feels the biggest right now — let's look at it together.`;

    case 'anger':
      return `I hear how angry this situation has made you${name}, and your frustration is completely valid. Anger often hides something deeper underneath — hurt, shame, pain, or unfairness. 💢

What's the thing about this that feels the most disrespectful or unfair on the inside?`;

    case 'joy':
      return `That's wonderful to hear${name}! ✨ Moments of joy matter — they build the foundation for resilience and hope.

What made you feel this way? I'd love to hear about it, so you can hold onto this feeling longer.`;

    case 'neutral':
    default:
      if (sentiment.label === 'positive') {
        return `I love hearing that${name}! Tell me more — what's going well? It's worth letting yourself fully absorb these good moments.`;
      }
      if (sentiment.label === 'negative') {
        return `I'm sorry you're feeling this way${name}. Can you tell me a little more about what's been weighing on you? I'm listening deeply.`;
      }
      return `Thanks for sharing that${name}. Have you been feeling okay overall, or is something on your mind you'd like to pause on?`;
  }
}

/** =====================================================
 *  CBT-Based Cognitive Distortion Detection & Response
 * ===================================================== */
const DISTORTION_PATTERNS = [
  {
    id: 'all-or-nothing',
    label: 'all-or-nothing thinking',
    pattern: /\b(always|never|everyone|nobody|everything|nothing)\b/i,
    response: (name) => `I notice you used a very absolute word like "always" or "never" there${name}. Things are rarely 100% one way or the other. Can you think of a small exception — even a tiny one — to that pattern?`
  },
  {
    id: 'catastrophizing',
    label: 'catastrophizing',
    pattern: /\b(catastroph|disaster|worst|ruined|awful|horrible|nightmare)\b/i,
    response: (name) => `Your mind may be showing you the worst-case scenario right now${name}. What's the *most likely* outcome here? And how might you be able to cope if the worst case did happen — which is more likely than you think?`
  },
  {
    id: 'labeling',
    label: 'labeling',
    pattern: /\bi('?m| am) (a |just )?(failure|loser|useless|worthless|stupid|disappointment)\b/i,
    response: (name) => `I hear you labeling yourself in a really harsh way${name}. But you are not your setbacks. Let's separate the situation from your identity. What happened, and what does that actually say about you as a person?`
  },
  {
    id: 'mind-reading',
    label: 'mind reading',
    pattern: /\b(they think|everyone thinks|she thinks|he thinks|they'll|they will)\b/i,
    response: (name) => `Sounds like you're doing some mind-reading there${name}. I know it's tempting to assume what others think. What would happen if you checked the evidence before believing that thought?`
  },
  {
    id: 'should',
    label: 'should statements',
    pattern: /\b(i should|i must|i have to|i need to)\b/i,
    response: (name) => `The word "should" is heavy to carry${name}. What would you *prefer* to do — free of guilt or obligation? That distinction can feel really different.`
  },
  {
    id: 'filtering',
    label: 'mental filtering',
    pattern: /\b(i('| m| am)? (can't|cannot).*|nothing (works|helps)|everything is bad)\b/i,
    response: (name) => `Sometimes when we're struggling, we filter out everything that's gone okay and only see the hard parts. What's one thing—no matter how small—that went right or you handled okay today${name}?`
  }
];

function detectCognitiveDistortion(userText) {
  const found = [];
  for (const d of DISTORTION_PATTERNS) {
    if (d.pattern.test(userText)) {
      found.push(d);
    }
  }
  return found;
}

function buildCBTResponse(userText, context = {}) {
  const distortions = detectCognitiveDistortion(userText);
  if (distortions.length === 0) return null;

  const name = context.userName ? ` ${context.userName}` : '';
  const d = distortions[0];
  return d.response(name);
}

/** =====================================================
 *  Main Response Generation Entry Point
 * ===================================================== */
function generateResponse(userMessage, context = {}) {
  if (!userMessage || !userMessage.trim()) {
    return {
      reply: "I'm here when you're ready 💙. What's on your mind today?",
      sentiment: 'neutral',
      emotion: 'neutral',
      risk: { score: 0, level: 'low' }
    };
  }

  // context = { userName, conversationHistory: [], preferences: {} }
  const history = Array.isArray(context.conversationHistory) ? context.conversationHistory : [];

  // --- 1. Analyze user input ---
  const sentiment = analyzeSentiment(userMessage);
  const emotionResult = classifyEmotion(userMessage);
  const emotion = emotionResult.emotion; // extract the emotion label string
  const emotionConfidence = emotionResult.confidence;
  const emphasis = detectEmphasis(userMessage);
  const analysis = { sentiment, emotion, emphasis, emotionConfidence };

  // --- 2. Check crisis risk ---
  const risk = calculateRiskScore(userMessage, history.map(h => h.content || h));
  const resources = crisisResources(risk.score);

  // --- 3. Crisis escalation (high/severe risk) ---
  if (risk.level === 'severe' || risk.level === 'high') {
    return {
      ...buildCrisisResponse(risk, analysis, context),
      sentiment: sentiment.label,
      emotion,
      risk
    };
  }

  // Risk may still be moderate or low with crisis indicators — offer resources gently
  const moderateCrisis = (risk.level === 'moderate' && risk.score >= 35)
    ? buildCrisisResponse(risk, analysis, context)
    : null;
  if (moderateCrisis) {
    return { ...moderateCrisis, sentiment: sentiment.label, emotion, risk };
  }

  // --- 4. Intent detection (wellness tool requests) ---
  const toolIntent = detectToolIntent(userMessage);
  if (toolIntent) {
    return {
      reply: toolIntent.response,
      tool: toolIntent.tool,
      sentiment: sentiment.label,
      emotion,
      risk
    };
  }

  // --- 5. General conversation ---
  const general = handleGeneralConversation(userMessage, context);
  if (general) {
    return {
      reply: general,
      sentiment: sentiment.label,
      emotion,
      risk
    };
  }

  // --- 6. CBT distortion response ---
  const cbtReply = buildCBTResponse(userMessage, context);
  if (cbtReply) {
    return {
      reply: cbtReply,
      sentiment: sentiment.label,
      emotion,
      risk,
      technique: 'cbt'
    };
  }

  // --- 7. Emotion-specific empathetic response ---
  const emotionReply = buildEmotionResponse(userMessage, analysis, context);
  return {
    reply: emotionReply,
    sentiment: sentiment.label,
    emotion,
    risk
  };
}

module.exports = { generateResponse };