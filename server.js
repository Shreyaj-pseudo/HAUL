require('dotenv').config();

const express = require('express');
const cors = require('cors');

const fetch = (...args) => import('node-fetch').then(({ default: fetchFn }) => fetchFn(...args));

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} ${durationMs.toFixed(1)}ms`);
  });
  next();
});

const sessions = {};
const sessionMeta = {};

const tiredWords = ['tired', 'sleepy', 'exhausted', 'drowsy', 'zoning', 'heavy', 'struggling', 'drifting'];

function getWordCount(transcript) {
  const cleaned = (transcript || '').trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).length;
}

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

  const wordCount = getWordCount(transcript);
  if (wordCount < 4) score += 1;

  if ((transcript || '') === '') score += 4;

  return Math.min(10, score);
}

function getFatigueLevel(score) {
  if (score >= 8) return 'CRITICAL';
  if (score >= 5) return 'WARNING';
  if (score >= 3) return 'CAUTION';
  return 'NORMAL';
}

function analyzeTrend(sessionId) {
  const history = sessions[sessionId] || [];
  if (history.length < 3) {
    return { trend: 'insufficient_data', bonus: 0 };
  }

  const last3 = history.slice(-3);
  const scores = last3.map((checkIn) => Number(checkIn.score) || 0);
  const avgLatency = last3.reduce((sum, checkIn) => sum + (Number(checkIn.latencyMs) || 0), 0) / 3;
  const allShort = last3.every((checkIn) => {
    const count = Number.isFinite(checkIn.wordCount) ? checkIn.wordCount : getWordCount(checkIn.transcript);
    return count < 5;
  });
  const escalating = scores[2] > scores[1] && scores[1] > scores[0];
  const plateau = scores.every((score) => score >= 5);

  if (allShort && avgLatency > 2000) {
    return {
      trend: 'behavioral_pattern',
      bonus: 2,
      message: 'Consistent short delayed responses detected'
    };
  }

  if (escalating) {
    return {
      trend: 'escalating',
      bonus: 2,
      message: 'Fatigue score increasing across last 3 check-ins'
    };
  }

  if (plateau) {
    return {
      trend: 'sustained_high',
      bonus: 1,
      message: 'Sustained elevated fatigue for 3 check-ins'
    };
  }

  return { trend: 'stable', bonus: 0 };
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

  const fallbackAnalysis = {
    fatigueIndicators: ['API unavailable'],
    coherenceScore: 5,
    recommendBreak: false,
    reasoning: 'LLM analysis unavailable — using heuristic score only'
  };

  if (!groqApiKey || groqApiKey === 'your_key_here') {
    return fallbackAnalysis;
  }

  try {
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
      throw new Error(`Groq API request failed with status ${response.status}`);
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
  } catch (error) {
    console.error('Groq call failed:', error.message || error);
    return fallbackAnalysis;
  }
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

    const numericLatencyMs = Number(latencyMs);
    const numericHoursOnRoad = Number(hoursOnRoad);
    const wordCount = getWordCount(transcript);

    const baseScore = calculateFatigueScore(transcript, numericLatencyMs, numericHoursOnRoad);
    const trend = analyzeTrend(sessionId);
    const score = Math.min(10, baseScore + (Number(trend.bonus) || 0));
    const level = getFatigueLevel(score);

    const llmAnalysis = await analyzeWithGroq(transcript, numericLatencyMs, numericHoursOnRoad);

    const checkInId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const checkIn = {
      checkInId,
      sessionId,
      checkInNumber,
      transcript,
      latencyMs: numericLatencyMs,
      hoursOnRoad: numericHoursOnRoad,
      wordCount,
      baseScore,
      score,
      level,
      trend,
      llmAnalysis,
      timestamp: new Date().toISOString()
    };

    sessions[sessionId].push(checkIn);

    return res.json({
      score,
      level,
      trend,
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

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    sessionCount: Object.keys(sessions).length
  });
});

app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (!sessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  return res.json(sessions[sessionId]);
});

app.get('/api/sessions/:sessionId/summary', (req, res) => {
  const { sessionId } = req.params;
  const history = sessions[sessionId];

  if (!history) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  const totalCheckIns = history.length;
  const totalScore = history.reduce((sum, checkIn) => sum + (Number(checkIn.score) || 0), 0);
  const averageScore = totalCheckIns ? Number((totalScore / totalCheckIns).toFixed(2)) : 0;

  const peakScore = totalCheckIns
    ? history.reduce((max, checkIn) => Math.max(max, Number(checkIn.score) || 0), 0)
    : 0;

  const peakEntry = totalCheckIns
    ? history.find((checkIn) => (Number(checkIn.score) || 0) === peakScore)
    : null;

  const totalHighAlerts = history.filter((checkIn) => (Number(checkIn.score) || 0) >= 5).length;
  const totalCriticalAlerts = history.filter((checkIn) => (Number(checkIn.score) || 0) >= 8).length;

  const trendHistory = history.map((checkIn) => ({
    checkInId: checkIn.checkInId,
    checkInNumber: checkIn.checkInNumber,
    trend: checkIn.trend?.trend || 'unknown',
    bonus: Number(checkIn.trend?.bonus) || 0,
    message: checkIn.trend?.message || '',
    timestamp: checkIn.timestamp
  }));

  const meta = sessionMeta[sessionId] || {};
  const startedAtMs = meta.startedAt ? new Date(meta.startedAt).getTime() : null;
  const fallbackStartMs = history[0]?.timestamp ? new Date(history[0].timestamp).getTime() : null;
  const shiftStartMs = Number.isFinite(startedAtMs) ? startedAtMs : fallbackStartMs;

  const shiftDuration = shiftStartMs
    ? Math.max(0, Math.round((Date.now() - shiftStartMs) / 60000))
    : 0;

  return res.json({
    totalCheckIns,
    averageScore,
    peakScore,
    peakScoreTime: peakEntry?.timestamp || null,
    totalHighAlerts,
    totalCriticalAlerts,
    trendHistory,
    driverName: meta.driverName || '',
    truckId: meta.truckId || '',
    shiftDuration
  });
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
