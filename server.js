require('dotenv').config();

const express = require('express');
const cors = require('cors');

const fetch = (...args) => import('node-fetch').then(({ default: fetchFn }) => fetchFn(...args));

const app = express();

app.use(cors());
app.use(express.json());

const sessions = {};
const sessionMeta = {};

const tiredWords = ['tired', 'sleepy', 'exhausted', 'drowsy', 'zoning', 'heavy', 'struggling', 'drifting'];

function calculateFatigueScore(transcript, latencyMs, hoursOnRoad) {
  let score = 0;

  if (hoursOnRoad > 2) score += 1;
  if (hoursOnRoad > 4) score += 2;

  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) score += 1;

  if (latencyMs > 1500) score += 1;
  if (latencyMs > 2500) score += 1;
  if (latencyMs > 4000) score += 1;

  const lowerTranscript = (transcript || '').toLowerCase();
  if (tiredWords.some((word) => lowerTranscript.includes(word))) score += 3;

  const wordCount = (transcript || '').trim() === '' ? 0 : (transcript || '').trim().split(/\s+/).length;
  if (wordCount < 4) score += 1;

  if ((transcript || '') === '') score += 4;

  return Math.min(10, score);
}

function getFatigueLevel(score) {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function tryParseJson(content) {
  if (!content || typeof content !== 'string') return null;

  try {
    return JSON.parse(content);
  } catch (_err) {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (_err2) {
        return null;
      }
    }
    return null;
  }
}

async function analyzeWithGroq(transcript, latencyMs, hoursOnRoad) {
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey || groqApiKey === 'your_key_here') {
    return {
      fatigueIndicators: [],
      coherenceScore: 0,
      recommendBreak: false,
      reasoning: 'GROQ_API_KEY is not configured.'
    };
  }

  const userPrompt = `Analyze this driver response for signs of fatigue, confusion, or impairment. Response: '${transcript}'. Latency was ${latencyMs}ms. They have been driving ${hoursOnRoad} hours. Return JSON only: { fatigueIndicators: string[], coherenceScore: number 0-10, recommendBreak: boolean, reasoning: string }`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages: [
        {
          role: 'system',
          content: 'You are a fatigue detection assistant analyzing truck driver responses. Be concise.'
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const parsed = tryParseJson(content);

  if (parsed) return parsed;

  return {
    fatigueIndicators: [],
    coherenceScore: 0,
    recommendBreak: false,
    reasoning: content || 'Unable to parse LLM response as JSON.'
  };
}

app.post('/api/checkin', async (req, res) => {
  try {
    const {
      transcript = '',
      latencyMs = 0,
      hoursOnRoad = 0,
      checkInNumber = null,
      sessionId
    } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    if (!sessions[sessionId]) {
      sessions[sessionId] = [];
    }

    const score = calculateFatigueScore(transcript, Number(latencyMs), Number(hoursOnRoad));
    const level = getFatigueLevel(score);

    const llmAnalysis = await analyzeWithGroq(transcript, Number(latencyMs), Number(hoursOnRoad));

    const checkInId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const checkIn = {
      checkInId,
      sessionId,
      checkInNumber,
      transcript,
      latencyMs,
      hoursOnRoad,
      score,
      level,
      llmAnalysis,
      timestamp: new Date().toISOString()
    };

    sessions[sessionId].push(checkIn);

    return res.json({
      score,
      level,
      llmAnalysis,
      sessionId,
      checkInId
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to process check-in.' });
  }
});

app.post('/api/speak', async (req, res) => {
  try {
    const { text, voiceId } = req.body || {};

    if (!text || !voiceId) {
      return res.status(400).json({ error: 'text and voiceId are required.' });
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey || elevenLabsApiKey === 'your_key_here') {
      return res.status(500).json({ error: 'ELEVENLABS_API_KEY is not configured.' });
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText || 'Failed to generate speech.' });
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);

    if (!response.body) {
      return res.status(500).json({ error: 'No audio stream received from ElevenLabs.' });
    }

    response.body.pipe(res);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to call ElevenLabs API.' });
  }
});

app.get('/api/sessions', (_req, res) => {
  res.json(sessions);
});

app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (!sessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  return res.json(sessions[sessionId]);
});

app.post('/api/sessions/start', (req, res) => {
  const { driverName = '', truckId = '' } = req.body || {};

  const sessionId = `${Date.now()}`;
  sessions[sessionId] = [];
  sessionMeta[sessionId] = {
    driverName,
    truckId,
    startedAt: new Date().toISOString()
  };

  return res.json({ sessionId });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TruckGuard server running on port ${PORT}`);
});
