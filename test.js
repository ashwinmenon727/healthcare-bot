/**
 * MindCare Integration Test - verifies core modules work end-to-end.
 */
const { analyzeSentiment, classifyEmotion, detectEmphasis } = require('./src/sentiment');
const { calculateRiskScore, crisisResources, quickCrisisCheck } = require('./src/crisis');
const { generateResponse } = require('./src/engine');

let pass = 0;
let fail = 0;

function check(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`✅ ${name}`);
  } else {
    fail++;
    console.log(`❌ ${name} ${detail ? '- ' + detail : ''}`);
  }
}

console.log('=== 1. SENTIMENT ANALYSIS ===');
check('sad sentence => negative', analyzeSentiment('I am feeling very sad and hopeless today').label === 'negative');
check('happy sentence => positive', analyzeSentiment('I am so happy and excited today!').label === 'positive');
check('negation "not good" => negative/neutral', analyzeSentiment('this is not good').label !== 'positive');
check('booster "very good" > "good"', analyzeSentiment('very good').compound > analyzeSentiment('good').compound);

console.log('=== 2. EMOTION CLASSIFICATION ===');
check('anxiety detected', classifyEmotion('I feel so anxious about my presentation').emotion === 'anxiety');
check('no false positive on "presentation" (mentions resent)', classifyEmotion('I feel so anxious about my presentation').scores.anger === 0);
check('anger detected', classifyEmotion('I am really angry at my boss').emotion === 'anger');
check('joy detected', classifyEmotion('I am so happy and excited!').emotion === 'joy');
check('sadness detected', classifyEmotion('I feel so sad and lonely').emotion === 'sadness');
check('hopelessness detected', classifyEmotion('I feel hopeless and nothing ever changes').emotion === 'hopelessness');

console.log('=== 3. CRISIS DETECTION ===');
const severe = calculateRiskScore('I want to kill myself tonight');
check('suicidal + plan => severe (95)', severe.level === 'severe', JSON.stringify(severe));
check('severe score >= 86', severe.score >= 86, `got ${severe.score}`);

const high = calculateRiskScore('I am going to cut myself');
check('self-harm intent => high+', high.level === 'high' || high.level === 'severe', `got ${high.level}`);

const moderate = calculateRiskScore('I feel completely hopeless and stuck forever');
check('hopelessness => moderate/high', moderate.level === 'moderate' || moderate.level === 'high', `got ${moderate.level}`);

const low = calculateRiskScore('I had a nice day at work');
check('normal day => low', low.level === 'low');

const moderate2 = calculateRiskScore('I want to end it all right now');
check('end it all + now => high/severe', moderate2.level === 'high' || moderate2.level === 'severe', `got ${moderate2.level}`);

check('quickCrisisCheck finds suicide', quickCrisisCheck('I want to kill myself tonight').length > 0);
check('resources: severe shows 3', crisisResources(100).shown.length === 3);
check('resources: low shows 1', crisisResources(10).shown.length === 1);

console.log('=== 4. RESPONSE ENGINE ===');
const anxiety = generateResponse('I feel anxious about my presentation tomorrow');
check('anxiety => anxiety-specific reply', anxiety.reply.includes('racing') || anxiety.reply.includes('alarm'), anxiety.reply);
check('anxiety => anxiety label', anxiety.emotion === 'anxiety');

const crisisResp = generateResponse('I want to kill myself tonight');
check('crisis => has crisis flag', crisisResp.crisis && crisisResp.crisis.escalated === true);
check('crisis => reply present', typeof crisisResp.reply === 'string' && crisisResp.reply.length > 20);
check('crisis => includes 911', crisisResp.reply.includes('911'));

const greeting = generateResponse('hi there');
check('greeting returns hello', greeting.reply.includes('Hello'));
check('greeting emotion', greeting.emotion === 'neutral');

const joy = generateResponse('I aced my exam and I am so happy!');
check('joy => joy reply', joy.emotion === 'joy');

console.log('=== 5. SERVER ENDPOINTS ===');
const express = require('express');
const app = express();
app.use(express.json());

// Replicate server logic minimally
    check('resources high (65) => 2', crisisResources(65).shown.length === 2);

console.log(`\n===== RESULTS: ${pass} passed, ${fail} failed =====`);
process.exit(fail > 0 ? 1 : 0);