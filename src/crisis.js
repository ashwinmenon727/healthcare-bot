/**
 * MindCare Crisis Detection & Risk Scoring Module
 * 
 * Implements:
 *  - Keyword matching for suicidal ideation, self-harm, hopelessness, panic, abuse, psychosis
 *  - Risk scoring system (0-100)
 *  - Escalation protocol & risk thresholds
 *  - Emergency resource generation
 */

const { analyzeSentiment, classifyEmotion } = require('./sentiment');

/**
 * Crisis keyword categories with associated severity weights.
 * Each keyword pattern matched adds weight to the risk score.
 */
const CRISIS_KEYWORDS = {
  SUICIDAL: {
    patterns: [
      'kill myself', 'suicide', 'suicidal', 'end it', 'end my life', 'end this',
      'not worth living', 'want to die', 'wish i was dead', 'wish i were dead',
      'better off dead', 'dont want to live', "don't want to live",
      'take my life', 'ending everything', 'blow my brains', 'hang myself',
      'jump off', 'overdose', 'no reason to live', 'want to disappear',
      'i want to die', 'i want to end', 'doom myself', 'death by',
      'kill myself tonight', 'plan to die', 'going to die', 'i will die'
    ],
    weight: 35
  },
  SELF_HARM: {
    patterns: [
      'cut myself', 'cutting myself', 'hurt myself', 'harm myself', 'self harm',
      'self-harm', 'burn myself', 'stab myself', 'scratch myself', 'hit myself',
      'banging my head', 'head against the wall', 'razor', 'cut my wrist',
      'cut my arm', 'blood', 'bleeding myself'
    ],
    weight: 30
  },
  HOPELESS: {
    patterns: [
      'no point', 'pointless', 'never get', 'never better', 'will never',
      'always be like this', 'always like this', 'cant take it', "can't take it",
      'cannot take it', 'no escape', 'nothing matters', 'everything wrong',
      'no future', 'doomed', 'despair', 'give up', 'giving up', 'stuck forever',
      'trapped', 'hopeless', 'i give up', 'i cant do this', "i can't do this",
      'im a burden', 'i am a burden', 'nobody cares', 'no one cares',
      'hate my life', 'hate myself', 'waste of space', 'useless', 'worthless'
    ],
    weight: 25
  },
  PANIC: {
    patterns: [
      'cant breathe', "can't breathe", 'cant breath', 'can not breathe',
      'heart racing', 'pounding heart', 'cant stop shaking', "can't stop shaking",
      'passing out', 'dizzy', 'dizzy for', 'numb', 'ringing', 'cold sweats',
      'choking', 'hyperventilating', 'hyperventilate', 'suffocating',
      'having a heart attack', 'dying right now'
    ],
    weight: 15
  },
  ABUSE: {
    patterns: [
      'hit me', 'punch me', 'slapped me', 'beat me', 'abusive', 'abused',
      'abuse me', 'hurt me', 'forced me', 'molested', 'raped', 'rape',
      'partner hit', 'husband hit', 'wife hit', 'dating violence',
      'domestic violence', 'my dad hits', 'my mom hits', 'my father hits',
      'my mother hits', 'threatens me', 'threatening me'
    ],
    weight: 20
  },
  PSYCHOSIS: {
    patterns: [
      'voices telling', 'voices say', 'aliens controlling', 'people tracking me',
      'they are after me', 'government spying', 'spying me', 'reading my mind',
      'controlling my mind', 'the voices', 'hearing voices', 'seeing things',
      'seeing things that', 'shadow people', 'paranoid', 'delusions',
      'im being watched', 'watchers'
    ],
    weight: 20
  }
};

/**
 * Hopelessness markers used for risk score escalation.
 */
const HOPELESSNESS_MARKERS = [
  'never', 'no point', 'worthless', 'hopeless', 'doomed', 'trapped', 'useless',
  'nothing matters', 'no future', 'no escape', 'burden', 'always be like this',
  'always like this', 'cant take it', "can't take it", 'nothing will change',
  'ill never get better', "i'll never get better", 'i will never get better'
];

/**
 * Quick check: does the text contain any crisis keyword?
 * @param {string} text
 * @returns {Array<{category: string, keyword: string, weight: number}>}
 */
function quickCrisisCheck(text) {
  if (!text || !text.trim()) return [];

  const lowered = text.toLowerCase();
  const matches = [];

  for (const [category, config] of Object.entries(CRISIS_KEYWORDS)) {
    for (const pattern of config.patterns) {
      if (lowered.includes(pattern)) {
        matches.push({ category, keyword: pattern, weight: config.weight });
        // Only one match per category to avoid stacking
        break;
      }
    }
  }

  return matches;
}

/**
 * Detects patterns of escalation across conversation history.
 * Checks for increasing negativity or repeated distress markers.
 * @param {Array<string>} history - Previous messages
 * @returns {boolean}
 */
function isEscalating(history = []) {
  if (history.length < 2) return false;

  const recents = history.slice(-5); // Check last 5 messages
  let negativeCount = 0;

  for (const msg of recents) {
    const sentiment = analyzeSentiment(msg);
    if (sentiment.label === 'negative') negativeCount++;
  }

  // Escalation if 3+ of the last 5 messages are negative AND sentiment worsening
  if (negativeCount >= 3) {
    const first = analyzeSentiment(recents[0]);
    const last = analyzeSentiment(recents[recents.length - 1]);
    if (last.compound <= first.compound) return true;
  }

  return false;
}

/**
 * Calculates a 0-100 crisis risk score from a message and conversation context.
 * @param {string} message - Current user message
 * @param {Array<string>} conversationHistory - Previous messages
 * @returns {{score: number, level: string, reasons: string[], matches: Array, flags: Object}}
 */
function calculateRiskScore(message, conversationHistory = []) {
  const reasons = [];
  let score = 0;
  const lowered = (message || '').toLowerCase();
  const matches = quickCrisisCheck(message);

  // 1. HIGH-SEVERITY OVERRIDE:
  //    Suicidal ideation or self-harm with intent-plan-language -> immediate severe escalation.
  //    A single explicit "kill myself/suicide/end it" with plan words must NEVER be under-escalated.
  const hasSuicidal = matches.some(m => m.category === 'SUICIDAL');
  const hasSelfHarm = matches.some(m => m.category === 'SELF_HARM');

  const hasPlanIntent = /\b(today|tonight|now|right now|this (weekend|evening)|later|after (work|class|school)|before sunrise|at night)\b/.test(lowered)
    || /(plan|going to|want to|will |going|intend|cannot stop thinking|cant stop thinking|about to)/.test(lowered)
    || (hasSuicidal && /\b(kill|end|done|gone|finish)\b/.test(lowered));

  // High-severity direct escalation criteria
  if (hasSuicidal) {
    score += 40; // Base: explicit suicidal ideation
    reasons.push('Suicidal ideation detected');

    if (hasPlanIntent) {
      score += 30; // Plan or intent
      reasons.push('Suicidal ideation with plan/intent — HIGH ALERT');
    }

    // "Tonight"/"after this"/time-specific = active plan
    if (/\b(today|tonight|tonight|now|later|soon|immediately)\b/.test(lowered)) {
      score += 15;
      reasons.push('Concerning time-specific threat detected');
    }

    // Additional severe words -> "kill myself tonight"
    if (matches.some(m => m.keyword.includes('kill myself') || m.keyword.includes('end it') || m.keyword.includes('end my life'))) {
      score += 10;
    }
  }

  // Self-harm explicit
  if (hasSelfHarm) {
    score += 30;
    reasons.push('Self-harm ideation detected');

    // Intent/plan language escalates immediately
    if (/\b(going to|i will|i'm about to|i am about to|planned|will |want to|intend)\b|(going to|about to|plan to|planning to)/.test(lowered)) {
      score += 35;
      reasons.push('Self-harm with intent/plan — HIGH ALERT');
    }

    if (/\b(today|tonight|now|right now|after this|after class)\b/.test(lowered)) {
      score += 20;
      reasons.push('Self-harm with time-specific threat');
    }
  }

  // (If matches exist, show reasons)
  if (matches.length > 0) {
    reasons.push(`Crisis keyword detected (${matches.map(m => m.category).join(', ')})`);
  }

  // 2. Sentiment severity
  const sentiment = analyzeSentiment(message);
  if (sentiment.compound <= -0.8) {
    score += 20;
    reasons.push('Extremely negative sentiment detected');
  } else if (sentiment.compound <= -0.5) {
    score += 10;
    reasons.push('Strongly negative sentiment detected');
  } else if (sentiment.compound <= -0.25) {
    score += 5;
    reasons.push('Negative sentiment detected');
  }

  // 3. Hopelessness markers
  let hopelessCount = 0;
  for (const marker of HOPELESSNESS_MARKERS) {
    if (lowered.includes(marker)) hopelessCount++;
  }
  if (hopelessCount >= 3) {
    score += 20;
    reasons.push('Multiple hopelessness markers detected');
  } else if (hopelessCount === 2) {
    score += 12;
    reasons.push('Multiple hopelessness markers detected');
  } else if (hopelessCount === 1) {
    score += 5;
    reasons.push('Hopelessness marker detected');
  }

  // 4. Escalation pattern in conversation
  if (isEscalating(conversationHistory)) {
    score += 15;
    reasons.push('Escalating pattern across conversation');
  }

  // 5. Hopelessness emotion boost
  const emotion = classifyEmotion(message);
  if (emotion.emotion === 'hopelessness' && score > 0) {
    score += 10;
    reasons.push('Hopelessness emotion detected');
  }

  // 6. Intensity
  if (/[A-Z]{3,}/.test(message)) {
    score += 5;
  }

  const finalScore = Math.min(score, 100);

  // Determine risk level
  let level;
  if (finalScore >= 86) {
    level = 'severe';
  } else if (finalScore >= 61) {
    level = 'high';
  } else if (finalScore >= 31) {
    level = 'moderate';
  } else {
    level = 'low';
  }

  return {
    score: finalScore,
    level,
    reasons,
    matches,
    flags: {
      hasCrisisKeywords: matches.length > 0,
      hasHopelessness: hopelessCount > 0,
      isEscalating: isEscalating(conversationHistory),
      emotion: emotion.emotion
    }
  };
}

/**
 * Determines the risk level label from a score.
 * @param {number} score 0-100
 */
function riskLevel(score) {
  if (score >= 86) return 'severe';
  if (score >= 61) return 'high';
  if (score >= 31) return 'moderate';
  return 'low';
}

/**
 * Generates crisis resources to display to the user.
 * @param {number} score - Risk score 0-100
 * @returns {Object}
 */
function crisisResources(score) {
  const resources = [
    { name: 'Crisis Text Line', detail: 'Text HOME to 741741' },
    { name: 'National Suicide Prevention Lifeline', detail: '1-800-273-8255' },
    { name: 'Emergency Services', detail: 'Call 911 (US) / 999 (UK) / 112 (EU)' }
  ];

  // Higher risk => more resources shown
  const numResources = score >= 86 ? 3 : score >= 61 ? 2 : 1;
  const shown = resources.slice(0, numResources);

  return {
    shown,
    all: resources,
    message: score >= 86
      ? 'I am very concerned about your safety right now. Please contact emergency services immediately.'
      : score >= 61
        ? 'You deserve immediate support. Please reach out to a crisis resource right now.'
        : 'I want to make sure you have support available. Here are some resources.'
  };
}

module.exports = { calculateRiskScore, quickCrisisCheck, isEscalating, crisisResources, riskLevel, CRISIS_KEYWORDS };