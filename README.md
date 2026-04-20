# TruckGuard — AI Driver Fatigue Monitoring

## What it does
TruckGuard is a voice-first monitoring system that checks truck driver alertness during a shift using fast check-ins. The phone interface captures spoken responses and latency, then the backend combines heuristic fatigue scoring with Groq LLM behavioral analysis. A desktop fleet dashboard visualizes live session risk, trends, and AI reasoning so operators can intervene early.

## Stack
- Node/Express backend
- ElevenLabs TTS
- Groq (LLama 3 70B) for behavioral analysis
- Web Speech API for voice input
- Chart.js for dashboard visualization

## Setup
1. npm install
2. Copy .env.example to .env and add your API keys
3. node server.js
4. Open index.html in Chrome on your phone (or localhost for demo)
5. Open dashboard.html in Chrome on desktop

## Demo mode
Triple-tap the TruckGuard logo on the driver interface to activate demo mode. Then click "Check In" repeatedly to cycle through escalating fatigue scenarios.

## Architecture diagram (text)
Phone (index.html) -> POST /api/checkin -> server.js -> Groq LLM analysis
                                       ↓
Desktop (dashboard.html) <- GET /api/sessions (polling every 5s)

## What I would build with 3 more weeks
- Real GPS integration for nearest rest stop navigation
- Twilio SMS alert to dispatcher on CRITICAL
- Persistent database (PostgreSQL) replacing in-memory sessions
- Mobile app wrapper (React Native)
- Actual voice biometrics for deeper fatigue detection
