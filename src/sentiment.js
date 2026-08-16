/**
 * MindCare Sentiment Analysis Module
 * A lightweight VADER-inspired sentiment analyzer implemented in pure JavaScript.
 *
 * Based on VADER (Valence Aware Dictionary and sEntiment Reasoner):
 *  - Lexicon word scores
 *  - Negation handling ("not good" -> negative)
 *  - Intensity boosters ("very good" -> more positive)
 *  - Punctuation and capitalization emphasis
 */

// ---- Emotion lexicon (6-class: joy, sadness, anxiety, anger, hopelessness, neutral) ----
const EMOTION_LEXICON = {
  joy: [
    'happy', 'joy', 'joyful', 'great', 'wonderful', 'amazing', 'excited', 'excitement',
    'awesome', 'fantastic', 'good', 'glad', 'cheerful', 'delighted', 'hopeful',
    'love', 'loved', 'positive', 'better', 'proud', 'accomplished', 'relieved',
    'grateful', 'thankful', 'confident', 'calm', 'peace', 'smile', 'beautiful',
    'win', 'won', 'success', 'successful', 'passed', 'aced', 'enjoyed', 'fine',
    'okay', 'energized', 'motivated', 'progress', 'encouraged'
  ],
  sadness: [
    'sad', 'sadness', 'upset', 'down', 'crying', 'cry', 'cried', 'depressed',
    'depression', 'depressing', 'unhappy', 'miserable', 'heartbroken', 'heartache',
    'grief', 'grieving', 'lonely', 'alone', 'isolated', 'hurt', 'hurting', 'pain',
    'unloved', 'abandoned', 'rejected', 'rejection', 'broken', 'sorrow', 'tears',
    'drained', 'exhausted', 'tired', 'worthless', 'meaningless'
  ],
  anger: [
    'angry', 'anger', 'mad', 'furious', 'frustrated', 'frustration', 'annoyed',
    'irritated', 'rage', 'hate', 'hated', 'hates', 'irritate', 'ticked', 'pissed',
    'resent', 'resentful', 'hostile', 'aggressive', 'snapped', 'screaming', 'scream',
    'unfair', 'injustice', 'cheated', 'betrayed', 'betrayal', 'lied', 'ruthless'
  ],
  anxiety: [
    'anxious', 'anxiety', 'nervous', 'worried', 'worry', 'fear', 'afraid', 'scared',
    'scary', 'panicking', 'panic', 'overwhelmed', 'overwhelming', 'stress', 'stressed',
    'stressful', 'frightened', 'uneasy', 'apprehensive', 'racing', 'tight', 'restless',
    'jittery', 'shaky', 'cant_breathe', 'cant_breathe2', 'heart_racing', 'dread',
    'impending', 'edgy', 'tense', 'startled', 'jumped', 'trembling', 'sweating',
    'nauseous', 'dizzy'
  ],
  hopelessness: [
    'hopeless', 'worthless', 'giving_up', 'give_up', 'no_point', 'pointless', 'never',
    'will_never', 'always_be_like_this', 'always_like_this', 'cant_take_it',
    'cannot_take_it', 'burden', 'no_escape', 'stuck', 'trapped', 'no_future',
    'nothing_matters', 'everything_wrong', 'ruined', 'doomed', 'despair', 'desperate',
    'defeated', 'helpless', 'useless', 'fail', 'failure', 'failed', 'loser',
    'hate_myself', 'cant_do_anything', 'nobody_cares'
  ]
};

/**
 * VADER-style sentiment lexicon with valence scores.
 * Positive words get positive scores, negative words get negative scores.
 */
const SENTIMENT_LEXICON = {
  // Positive words
  good: 1.9, great: 3.1, amazing: 3.2, excellent: 3.0, wonderful: 2.8, fantastic: 3.0,
  happy: 2.7, joy: 2.8, joyful: 2.6, glad: 2.2, love: 3.2, loved: 3.0, like: 1.5,
  best: 3.2, better: 1.9, awesome: 3.1, incredible: 3.0, beautiful: 2.6, lovely: 2.8,
  nice: 2.0, perfect: 2.9, cute: 2.2, sweet: 2.0, enjoy: 2.1, enjoyed: 2.3, fun: 1.9,
  cheerful: 2.6, smiles: 1.9, confidence: 2.1, confident: 2.0, motivated: 2.5,
  proud: 2.3, relief: 2.0, relieved: 2.1, hopeful: 1.8, hope: 1.6, calm: 1.2,
  peaceful: 1.9, gratitude: 1.9, grateful: 2.0, thankful: 1.9, celebrate: 2.4,
  win: 1.8, won: 2.0, progress: 1.6, improved: 1.8, improve: 1.6, success: 2.3,
  successful: 2.5, accomplishment: 2.4, achieved: 2.3, smiled: 1.9, laughing: 2.2,
  laugh: 2.0, laughed: 2.0, excited: 2.4,

  // Negative words
  bad: -2.5, terrible: -3.4, awful: -3.0, horrible: -3.3, sad: -2.5, unhappy: -2.5,
  depressed: -3.0, depression: -3.0, miserable: -3.1, upset: -2.4, stress: -2.2,
  stressed: -2.4, anxiety: -2.3, anxious: -2.3, worried: -2.2, worry: -2.1,
  afraid: -2.2, scared: -2.4, fear: -2.3, nervous: -2.0, overwhelmed: -2.6,
  overwhelming: -2.5, angry: -2.7, mad: -2.5, furious: -3.1, frustrated: -2.3,
  frustration: -2.4, lonely: -2.6, alone: -2.4, isolated: -2.3, hopeless: -3.5,
  helpless: -3.1, worthless: -3.4, empty: -2.3, despair: -3.3, pain: -2.5,
  crying: -2.8, cry: -2.4, cried: -2.5, tired: -1.5, exhausted: -2.0, drained: -2.0,
  broken: -2.7, failed: -2.6, fail: -2.4, loser: -2.8, hate: -3.1, hating: -2.8,
  dislike: -2.0, worst: -3.3, worse: -2.9, rejected: -2.7, rejection: -2.7,
  abandoned: -2.9, unloved: -3.0, grief: -2.9, sorrow: -2.8, death: -3.0, dying: -3.2,
  burden: -2.8, stuck: -2.2, trapped: -2.3, doomed: -3.0, devastated: -3.4,
  crushed: -3.0, ruin: -2.7, ruined: -2.9, pathetic: -3.0, ashamed: -2.5, shame: -2.3,
  embarrassed: -2.0, guilty: -2.1, nightmare: -2.8, panicking: -2.7, panic: -2.6,
  dread: -2.6, tension: -2.0, tense: -2.0, uneasy: -2.0, unsettled: -2.2,
  kill: -3.4, kill_myself: -4.0, killed: -3.2, killing: -3.3, die: -3.2, died: -3.2,
  dies: -3.1, suicide: -3.5, suicidal: -3.6, self_harm: -3.4, self_harm2: -3.4,
  suffocating: -3.3, abuse: -2.9, abused: -2.9, abuser: -3.0, violence: -2.8,
  violent: -2.9, cut: -2.4, cutting: -2.6, overdose: -3.3, ending: -2.2,
  worthless: -3.4, pointless: -3.0, hurt: -2.9, hurting: -2.9, harm: -2.7, harmed: -2.8,
  end: -1.5, numb: -2.0, nightmare: -2.8, binged: -2.0, overeating: -1.8,

  // Neutral
  okay: 0.4, fine: 0.4, normal: 0.2, average: 0.1
};

/** Negation words that flip sentiment */
const NEGATIONS = ['not', 'never', 'no', 'nothing', 'rarely', 'barely', 'hardly', "don't", "doesn't", "didn't", 'cannot', "can't", "won't", "isn't", "aren't", "wasn't", "weren't"];

/** Intensity boosters */
const BOOSTERS = {
  very: 1.3, really: 1.3, so: 1.2, extremely: 1.5, incredibly: 1.5, absolutely: 1.5,
  completely: 1.4, totally: 1.4, utterly: 1.5, super: 1.3, quite: 1.2, such: 1.2,
  seriously: 1.3, deeply: 1.4, truly: 1.4, highly: 1.4, bit: 0.8, slightly: 0.7,
  somewhat: 0.8, kind: 0.8, kinda: 0.8, pretty: 1.1, much: 1.1, way: 1.2,
  'a little': 0.9, 'a lot': 1.2
};

/**
 * Calculates a VADER-style compound sentiment score.
 * @param {string} text - Input text
 * @returns {{compound: number, positive: number, negative: number, neutral: number, label: string}}
 */
function analyzeSentiment(text) {
  if (!text || !text.trim()) {
    return { compound: 0, positive: 0, negative: 0, neutral: 1, label: 'neutral' };
  }

  const words = text.toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);

  let compound = 0;
  let posCount = 0;
  let negCount = 0;
  let neuCount = 0;

  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    let score = SENTIMENT_LEXICON[word];
    if (score === undefined) {
      // Try to trim trailing s (e.g. "fears" -> "fear")
      const trimmed = word.endsWith('s') ? word.slice(0, -1) : null;
      if (trimmed && SENTIMENT_LEXICON[trimmed] !== undefined) {
        score = SENTIMENT_LEXICON[trimmed];
      }
    }
    if (score === undefined) {
      neuCount++;
      continue;
    }

    // Negation handling (previous word flips the valence)
    if (i > 0 && NEGATIONS.includes(words[i - 1])) {
      score = -score * 0.6;
    }

    // Booster handling
    if (i > 0 && BOOSTERS[words[i - 1]]) {
      score = score * BOOSTERS[words[i - 1]];
    }
    if (i > 1 && BOOSTERS[words[i - 2]]) {
      score = score * (words[i - 2] === 'very' ? 1.2 : 1.1);
    }

    compound += score;
    if (score > 0) posCount++;
    else if (score < 0) negCount++;
    else neuCount++;
  }

  // Normalize to -1..1 using VADER-style normalization
  const normalized = compound / Math.sqrt(compound * compound + 15);

  const total = posCount + negCount + neuCount || 1;
  const positive = posCount / total;
  const negative = negCount / total;
  const neutral = neuCount / total;

  const label = normalized >= 0.05 ? 'positive' : normalized <= -0.05 ? 'negative' : 'neutral';

  return { compound: Number(normalized.toFixed(4)), positive, negative, neutral, label };
}

/**
 * Normalizes text for emotion keyword matching.
 * Converts phrases like "can't breathe" and "give up" into matchable tokens.
 */
function normalizeForEmotion(text) {
  return text
    .toLowerCase()
    .replace(/can't breathe/g, 'cant_breathe')
    .replace(/can not breathe/g, 'cant_breathe')
    .replace(/can't take/g, 'cant_take_it')
    .replace(/cannot take/g, 'cant_take_it')
    .replace(/heart racing/g, 'heart_racing')
    .replace(/giving up/g, 'give_up')
    .replace(/give up/g, 'give_up')
    .replace(/no point/g, 'no_point')
    .replace(/hate myself/g, 'hate_myself')
    .replace(/can't do anything/g, 'cant_do_anything')
    .replace(/nobody cares/g, 'nobody_cares')
    .replace(/no escape/g, 'no_escape')
    .replace(/no future/g, 'no_future')
    .replace(/nothing matters/g, 'nothing_matters')
    .replace(/everything wrong/g, 'everything_wrong')
    .replace(/always like this/g, 'always_like_this')
    .replace(/always be like this/g, 'always_be_like_this')
    .replace(/will never/g, 'never')
    .replace(/'/g, '');
}

/**
 * Classifies text into 6 emotion categories.
 * @param {string} text
 * @returns {{emotion: string, confidence: number, scores: Object}}
 */
function classifyEmotion(text) {
  const neutralScores = { joy: 0, sadness: 0, anxiety: 0, anger: 0, hopelessness: 0, neutral: 1 };
  if (!text || !text.trim()) {
    return { emotion: 'neutral', confidence: 0, scores: neutralScores };
  }

  const normalized = normalizeForEmotion(text);
  const lowered = normalized;
  const wordList = lowered.split(/\s+/).filter(Boolean);
  const wordSet = new Set(wordList);
  const scores = { joy: 0, sadness: 0, anxiety: 0, anger: 0, hopelessness: 0, neutral: 0 };

  for (const [emotion, keywords] of Object.entries(EMOTION_LEXICON)) {
    for (const kw of keywords) {
      // Multi-word keywords (underscored phrases like cant_breathe)
      if (kw.includes('_')) {
        if (lowered.includes(kw)) {
          scores[emotion] += 1;
          break;
        }
        continue;
      }

      // Single-word: boundary matching to avoid substring false positives
      // (e.g. "present" contains "resent" which is an anger keyword)
      if (wordSet.has(kw)) {
        scores[emotion] += 1;
        break;
      }

      // Loose stem/plural matching (e.g. "happies" -> "happy", "worried" -> "worry")
      const stemMatch = wordList.some(w =>
        w.length > kw.length + 2 &&
        w.startsWith(kw) &&
        (w.length - kw.length <= 3)
      );
      if (stemMatch) {
        scores[emotion] += 1;
        break;
      }
    }
  }

  // Fallback based on sentiment if no keyword matched
  const sentiment = analyzeSentiment(text);
  if (Object.values(scores).every(s => s === 0)) {
    if (sentiment.label === 'negative') {
      scores.sadness = 1;
    } else if (sentiment.label === 'positive') {
      scores.joy = 1;
    }
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total === 0) scores.neutral = 1;

  let emotion = 'neutral';
  let max = 0;
  for (const [em, sc] of Object.entries(scores)) {
    if (sc > max) {
      max = sc;
      emotion = em;
    }
  }

  const confidence = total > 0 ? max / total : 0.5;

  return { emotion, confidence, scores };
}

/**
 * Tone enhancement: detect emphasis (exclamation marks, ALL CAPS)
 * @param {string} text
 */
function detectEmphasis(text) {
  const hasExclamation = /!+/.test(text);
  const hasCaps = /[A-Z]{3,}/.test(text);
  return { hasExclamation, hasCaps, intensity: (hasExclamation ? 0.15 : 0) + (hasCaps ? 0.1 : 0) };
}

module.exports = { analyzeSentiment, classifyEmotion, detectEmphasis, SENTIMENT_LEXICON, EMOTION_LEXICON };