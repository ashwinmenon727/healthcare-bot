# 💙 MindCare Chatbot

An **empathetic AI mental health support companion** built as a college project.
MindCare combines **real-time sentiment analysis**, **6-class emotion classification**, **crisis risk detection with escalation** (0-100 risk scoring), and **evidence-based therapeutic responses** (CBT, DBT, grounding, breathing, journaling).

> ⚠️ **Important**: MindCare is a support tool for college demonstration — **not a replacement for professional healthcare**. In an emergency, call 911 (or local emergency services).

---

## ✨ Features

### 💬 Intelligent Chat
- VADER-style **sentiment analysis** (Positive / Negative / Neutral) with negation and intensity boosters
- **6-class emotion classification**: Joy 😊 · Sadness 😔 · Anxiety 😰 · Anger 😠 · Hopelessness 🖤 · Neutral 😐
- Emotion-aware empathetic responses with CBT techniques & cognitive-distortion detection
- Conversation context & history tracking

### 🆘 Crisis Detection & Escalation
- **Keyword matching** for suicidal ideation, self-harm, hopelessness, panic, abuse, psychosis
- **Risk scoring 0-100** with thresholds:
  - `0-30` Low risk → normal support
  - `31-60` Moderate → gentle resource suggestion
  - `61-85` High → immediate crisis resources + escalation
  - `86-100` Severe → 911 + full crisis protocol
- **No false negatives** on explicit suicidal/self-harm intent with plan language
- Crisis resources displayed inline (Crisis Text Line, Suicide Prevention Lifeline, Emergency)
- Real-time risk badges on user messages

### 🧘 Wellness Tools
| Tool | Description |
|------|-------------|
| 🫁 **Box Breathing** | Guided 4-4-4-4 breathing exercise with animated circle |
| 🌿 **Grounding** | 5-4-3-2-1 sensory grounding technique |
| 📔 **Journaling** | 9 contextual writing prompts saved locally |
| 📊 **Mood Tracker** | 1-10 slider, emoji feedback, history stored locally |
| 🙏 **Gratitude** | Three-things gratitude check-in |
| 🆘 **SOS** | Emergency resources modal |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v16+
- npm

### Install & Run

```bash
# 1. Clone / enter the project
cd mindcare-chatbot

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open in browser
#    http://localhost:3000
```

### Run Tests

```bash
npm test
```

---

## 📁 Project Structure

```
mindcare-chatbot/
├── package.json          # Dependencies & scripts
├── server.js              # Express server + API endpoints
├── test.js                # 28 automated integration tests
├── src/
│   ├── sentiment.js        # VADER-style sentiment + 6-class emotion analysis
│   ├── crisis.js           # Crisis keyword detection + risk scoring (0-100)
│   └── engine.js           # Response generation engine (empathy, CBT, crisis protocol)
└── public/
    ├── index.html           # Chat UI + tool modals
    ├── styles.css           # Full UI styling (responsive)
    └── app.js               # Frontend logic (chat, breathing, journal, mood, SOS)
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Send message → `{reply, sentiment, emotion, risk, crisis, sessionId}` |
| `POST` | `/api/analyze` | Raw sentiment/emotion/crisis analysis of text |
| `GET`  | `/api/health` | Server health check |
| `GET`  | `/api/session/:id` | Full conversation history |

### Example: POST /api/chat

```json
{
  "message": "I am feeling anxious about my exam tomorrow",
  "sessionId": "session_abc123"
}
```

Response:

```json
{
  "reply": "I can feel how much your mind is racing right now...",
  "sentiment": "negative",
  "emotion": "anxiety",
  "risk": { "score": 10, "level": "low" },
  "crisis": null,
  "sessionId": "session_abc123"
}
```

---

## 🎓 Learning Goals Covered

- **Sentiment Analysis** — lexicon-based VADER approximation, negation handling, boosters
- **Emotion Classification** — keyword matching with word-boundary + phrase normalization
- **Crisis Detection** — multi-category keyword matching, weighted risk scoring, escalation protocol
- **NLP Response Generation** — pattern matching, intent detection, CBT distortion checking
- **Full-Stack Web App** — Node/Express backend, vanilla JS frontend, local persistence
- **Therapeutic Principles** — CBT (cognitive distortions), DBT (grounding, breathing), motivational interviewing

---

## 📚 Dependencies

- [`express`](https://www.npmjs.com/package/express) — HTTP server
- [`nodemon`](https://www.npmjs.com/package/nodemon) — dev auto-reload

No Python/ML frameworks needed — everything runs in pure JavaScript/Node.js for easy college demo.

---

## 🔒 Disclaimer

MindCare does **not** provide medical diagnosis, treatment, or crisis counseling
by a trained professional. If you or someone you know is in crisis, call your
local emergency number, text **HOME** to **741741** (US), or call
**1-800-273-8255** (National Suicide Prevention Lifeline).

---

**Built with 💙 for mental health awareness — college project demo.**
</｜DSML｜parameter>
</write_to_file>