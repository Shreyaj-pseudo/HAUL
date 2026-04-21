<div align="center">

# 🛡 TruckGuard

### AI-powered fatigue detection and fleet monitoring for long-haul trucking

**Voice-first · Real-time · No hardware required**

---

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![ElevenLabs](https://img.shields.io/badge/Voice-ElevenLabs-000000?style=flat-square)](https://elevenlabs.io)
[![Groq](https://img.shields.io/badge/AI-Groq%20%2F%20Llama%203-F55036?style=flat-square)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

</div>

---

## The Problem

**1 in 5 truck accidents is caused by driver fatigue.**

Fatigue is invisible. A driver who is dangerously impaired often doesn't know it themselves. Current solutions — mandatory rest logs, self-reporting — rely entirely on the driver's own judgment at the exact moment that judgment is most compromised.

Fleet managers are flying blind. By the time a problem is reported, it's already a liability.

---

## What TruckGuard Does

TruckGuard runs silently in the background of any shift. Every two hours, it checks in with the driver by voice — listens to their response — and sends an AI-analyzed fatigue score to the fleet operations dashboard in real time.

No new hardware. No app install. No change to how drivers work.

```
Driver speaks  →  AI scores response  →  Fleet manager sees risk level  →  Intervention before incident
```

The entire loop — voice output, voice input, fatigue scoring, fleet visibility — takes under 30 seconds per check-in.

---

## Key Features

### 🎙 Voice-First Driver Interface
- **ElevenLabs TTS** speaks every prompt aloud — the driver never looks at a screen
- **Web Speech API** captures spoken responses hands-free
- Automatic fallback to browser speech synthesis if ElevenLabs is unavailable
- Wake word activation: say *"okay truckguard"* for on-demand assistant queries

### 🧠 Multi-Signal Fatigue Scoring
Each check-in is scored across six independent signals:

| Signal | What It Measures |
|---|---|
| Response latency | Time between question and first word spoken |
| Word count | Short responses correlate with impairment |
| Transcript semantics | Tired-word detection and coherence analysis |
| Hours on road | Cumulative shift fatigue weighting |
| Time of day | Circadian risk adjustment (late night / early morning) |
| Trend analysis | Escalating scores across last 3 check-ins |

Scores are then passed to **Groq + Llama 3** for semantic reasoning — producing natural-language fatigue assessments, not just numbers.

### 📊 Real-Time Fleet Dashboard
- Live sidebar of all active drivers with alert badges
- Per-driver fatigue trend chart with critical threshold line
- Delivery status timeline with animated progress tracking
- AI analysis feed with full reasoning per check-in
- Auto-refreshes every 5 seconds

### 🗣 On-Demand Voice Assistant
Drivers can ask questions hands-free between check-ins:
- *"What's the weather like ahead?"*
- *"Where's the nearest rest stop?"*
- *"Update status — out for delivery"*

Groq returns a concise spoken answer optimized for in-cab use (≤3 sentences).

### 📦 Delivery Status Tracking
Drivers update delivery status by voice. Status propagates to the fleet dashboard in real time with a timestamp and animated truck tracker.

Valid status milestones:
1. Loaded onto truck
2. Out for delivery
3. Delivered to safe drop
4. Delivered to access point

---

## Architecture

```
┌─────────────────────┐         ┌──────────────────────────┐
│   index.html        │         │   dashboard.html          │
│   (Driver — mobile) │         │   (Fleet Ops — desktop)   │
│                     │         │                           │
│  ElevenLabs TTS     │         │  Live session list        │
│  Web Speech STT     │         │  Fatigue trend charts     │
│  Wake word engine   │         │  AI analysis feed         │
│  Status updates     │         │  Delivery timeline        │
└────────┬────────────┘         └───────────┬───────────────┘
         │                                  │
         │         HTTP / REST              │
         ▼                                  ▼
┌─────────────────────────────────────────────────────────┐
│                     server.js (Node.js / Express)        │
│                                                         │
│  POST /api/checkin          Fatigue scoring engine      │
│  POST /api/speak            ElevenLabs TTS proxy        │
│  POST /api/assistant        Groq assistant endpoint     │
│  POST /api/status-update    Delivery status write       │
│  GET  /api/sessions/:id     Session + timeline read     │
│  POST /api/sessions/start   Session lifecycle           │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
               ▼                          ▼
        ┌──────────┐               ┌──────────────┐
        │ ElevenLabs│               │  Groq API     │
        │  TTS API  │               │  Llama 3 8B   │
        └──────────┘               └──────────────┘
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- ElevenLabs API key ([free tier works](https://elevenlabs.io))
- Groq API key ([free tier works](https://console.groq.com))
- Chrome browser (Web Speech API)

### Installation

```bash
git clone https://github.com/yourname/truckguard.git
cd truckguard
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
GROQ_API_KEY=your_groq_key_here
PORT=3000
```

> **Free tier note:** Use voice ID `pNInz6obpgDQGcFmaJgB` (Adam) on ElevenLabs free tier. Rachel (`21m00Tcm4TlvDq8ikWAM`) requires a paid plan.

### Run

```bash
node server.js
```

Then open two browser tabs in Chrome:

| Interface | URL | Who uses it |
|---|---|---|
| Driver app | `index.html` | Truck driver (mobile/tablet) |
| Fleet dashboard | `dashboard.html` | Dispatcher / fleet manager |

---

## How a Shift Works

```
1.  Driver opens index.html on their phone
2.  Taps "Start Shift" → enters name + truck ID
3.  TruckGuard speaks: "Shift started. I'll check in every two hours."
4.  Every 2 hours → automatic voice check-in
5.  Driver responds verbally → score calculated → fleet dashboard updates
6.  Any time → say "okay truckguard" for assistant or status update
7.  Fleet manager sees fatigue levels, trends, and delivery status live
```

---

## Alert Levels

| Level | Score | Visual | Action |
|---|---|---|---|
| 🟢 NORMAL | 0 – 2 | Green circle | No action needed |
| 🟡 CAUTION | 3 – 4 | Yellow circle | Suggest break at next stop |
| 🟠 WARNING | 5 – 7 | Pulsing orange | Strongly recommend rest area |
| 🔴 CRITICAL | 8 – 10 | Flashing red + vibration | Pull over immediately |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/sessions/start` | Start a new driver shift session |
| `GET` | `/api/sessions` | List all active sessions |
| `GET` | `/api/sessions/:id` | Get session check-in history |
| `GET` | `/api/sessions/:id/summary` | Aggregated fatigue summary |
| `GET` | `/api/sessions/:id/status-timeline` | Delivery status history |
| `POST` | `/api/checkin` | Submit a driver check-in |
| `POST` | `/api/speak` | Generate ElevenLabs TTS audio |
| `POST` | `/api/assistant` | Query the voice assistant |
| `POST` | `/api/status-update` | Update delivery status |
| `DELETE` | `/api/sessions/:id` | Delete a session |
| `GET` | `/api/health` | Server health + uptime |

---

## Project Structure

```
truckguard/
├── server.js          # Express backend — all API routes and scoring engine
├── index.html         # Driver interface — voice check-ins, wake word, assistant
├── dashboard.html     # Fleet dashboard — live monitoring and analytics
├── .env               # API keys (not committed)
├── package.json
└── README.md
```

---

## Roadmap

The current build is a fully working prototype. The following are scoped for the next development sprint:

- **ELD integration** — Pull real hours-of-service data from Samsara / Motive API instead of relying on self-reported shift start time
- **Wake word without touch** — Background audio context so drivers never need to tap the screen at all
- **Persistent storage** — Replace in-memory session store with PostgreSQL for data retention across restarts
- **PDF export** — One-click shift report generation for compliance and insurance documentation
- **SMS/email alerts** — Push critical fatigue alerts to dispatcher phones without requiring dashboard open
- **Multi-language support** — Spanish and French voice prompts for broader driver coverage

---

## The Business Case

> The average cost of a fatigue-related trucking accident is **$500,000** in liability, legal, and operational losses.
>
> TruckGuard requires no hardware procurement, no driver training, and no change to existing workflows.
>
> It works in a browser tab.

---

## Built With

- [Node.js](https://nodejs.org) + [Express](https://expressjs.com) — Backend API
- [ElevenLabs](https://elevenlabs.io) — Voice synthesis
- [Groq](https://groq.com) — LLM inference (Llama 3 8B)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — Browser-native speech recognition
- [Chart.js](https://chartjs.org) — Fatigue trend visualization

---

<div align="center">

**TruckGuard** — Built to keep drivers safe and fleets informed.

*Prototype · Not yet FDA/FMCSA certified for safety-critical use*

</div>