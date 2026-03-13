// =====================================================
// AI ROUTES — Groq API direct (no Python/FastAPI)
// =====================================================
// CHANGE: This file no longer proxies to the FastAPI
//         Python backend. It calls the Groq API directly
//         using GROQ_API_KEY from .env.
//
// Endpoints:
//   POST /api/ai/chat     — main chat with context memory
//   POST /api/ai/analyze  — analyze a single message (intent/risk)
//   GET  /api/ai/history  — fetch past chat_messages from DB
//   DELETE /api/ai/context — clear in-memory conversation context
// =====================================================

const express  = require('express');
const router   = express.Router();
const { supabase } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');

// ── Groq client (simple fetch wrapper, no SDK needed) ──
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama3-70b-8192';  // fast, high quality; swap to mixtral-8x7b if preferred

if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️  GROQ_API_KEY is not set — /api/ai endpoints will fail');
}

async function callGroq(messages, { temperature = 0.7, maxTokens = 1000 } = {}) {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      messages,
      temperature,
      max_tokens:  maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ── System prompt for the safety app ─────────────────
function buildSystemPrompt(userContext = {}) {
  return `You are a compassionate AI safety assistant for a women's safety app in India.
Your role is to:
- Provide emotional support and practical safety advice
- Detect signs of danger, abuse, or distress
- Guide users to relevant helplines (Police: 100, Ambulance: 108, Women's Helpline: 1091, Domestic Violence: 181, Child Helpline: 1098, Emergency: 112)
- Help users make safety plans
- Respond in the user's preferred language when possible (default: English)

IMPORTANT RULES:
- Never dismiss safety concerns; always take threats seriously
- If risk is detected, clearly recommend calling 112 or triggering the SOS
- Be warm, non-judgmental, and trauma-informed
- Keep responses concise (2-4 sentences) unless the user needs detailed guidance
- Do NOT provide legal advice, medical diagnosis, or make promises about outcomes

${userContext.name ? `User's name: ${userContext.name}` : ''}
${userContext.language ? `Preferred language: ${userContext.language}` : ''}`;
}

// ── In-memory conversation context per user ───────────
// Format: { [userId]: [ {role, content}, ... ] }
// This resets on server restart. For persistent history, use the DB.
const conversationContext = {};

const MAX_CONTEXT_MESSAGES = 20; // keep last 10 turns (20 messages)

function getContext(userId) {
  return conversationContext[userId] || [];
}

function addToContext(userId, role, content) {
  if (!conversationContext[userId]) conversationContext[userId] = [];
  conversationContext[userId].push({ role, content });
  // Trim to keep context window manageable
  if (conversationContext[userId].length > MAX_CONTEXT_MESSAGES) {
    conversationContext[userId] = conversationContext[userId].slice(-MAX_CONTEXT_MESSAGES);
  }
}

// ── Risk / intent analysis (lightweight, separate call) ─
async function analyzeMessage(text) {
  const prompt = `Analyze this message for safety context. Respond ONLY with a JSON object, no markdown.

Message: "${text}"

Return exactly this structure:
{
  "intent": "greeting|question|distress|emergency|abuse_disclosure|general",
  "emergency_type": "physical_violence|stalking|harassment|medical|fire|null",
  "risk_score": <integer 1-10>,
  "emotion": "calm|anxious|fearful|distressed|panicked|null",
  "emotion_intensity": <integer 1-10>,
  "is_emergency": <boolean>,
  "is_abuse": <boolean>,
  "detected_language": "<ISO 639-1 code e.g. en, hi, ta>"
}`;

  try {
    const raw = await callGroq(
      [{ role: 'user', content: prompt }],
      { temperature: 0.1, maxTokens: 200 }
    );
    // Strip any markdown fences just in case
    const clean = raw.replace(/```json|```/gi, '').trim();
    return JSON.parse(clean);
  } catch {
    // Return safe defaults if analysis fails
    return {
      intent: 'general',
      emergency_type: null,
      risk_score: 1,
      emotion: null,
      emotion_intensity: 1,
      is_emergency: false,
      is_abuse: false,
      detected_language: 'en',
    };
  }
}

// ── POST /api/ai/chat ─────────────────────────────────
router.post('/chat', authenticateUser, async (req, res) => {
  try {
    const { message, language, incident_id, input_source = 'text' } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }

    // 1. Fetch user profile for personalisation
    const { data: userData } = await supabase
      .from('users')
      .select('full_name')
      .eq('user_id', req.userId)
      .single();

    const { data: prefData } = await supabase
      .from('user_preferences')
      .select('language_name, language_code')
      .eq('user_id', req.userId)
      .single();

    const userContext = {
      name: userData?.full_name || null,
      language: language || prefData?.language_name || 'English',
    };

    // 2. Run risk analysis in parallel with building the reply
    const analysisPromise = analyzeMessage(message);

    // 3. Build message array for Groq
    const history = getContext(req.userId);
    const groqMessages = [
      { role: 'system', content: buildSystemPrompt(userContext) },
      ...history,
      { role: 'user', content: message },
    ];

    // 4. Get reply from Groq
    const [reply, analysis] = await Promise.all([
      callGroq(groqMessages, { temperature: 0.7, maxTokens: 500 }),
      analysisPromise,
    ]);

    // 5. Update in-memory context
    addToContext(req.userId, 'user',      message);
    addToContext(req.userId, 'assistant', reply);

    // 6. Persist to chat_messages table
    const msgRow = {
      user_id:           req.userId,
      role:              'user',
      content:           message,
      intent:            analysis.intent,
      emergency_type:    analysis.emergency_type,
      risk_score:        analysis.risk_score,
      emotion:           analysis.emotion,
      emotion_intensity: analysis.emotion_intensity,
      is_emergency:      analysis.is_emergency,
      is_abuse:          analysis.is_abuse,
      detected_language: analysis.detected_language,
      input_source,
      ...(incident_id ? { incident_id } : {}),
    };

    const assistantRow = {
      user_id:           req.userId,
      role:              'assistant',
      content:           reply,
      detected_language: 'en',
      input_source:      'text',
      ...(incident_id ? { incident_id } : {}),
    };

    await supabase.from('chat_messages').insert([msgRow, assistantRow]);

    // 7. If emergency detected, log audit entry
    if (analysis.is_emergency || analysis.risk_score >= 7) {
      await supabase.from('audit_logs').insert([{
        user_id:       req.userId,
        action:        'ai_emergency_detected',
        resource_type: 'chat_message',
        metadata: {
          risk_score:     analysis.risk_score,
          is_emergency:   analysis.is_emergency,
          emergency_type: analysis.emergency_type,
        },
      }]);
    }

    return res.status(200).json({
      success: true,
      data: {
        reply,
        analysis,
        emergency_detected: analysis.is_emergency || analysis.risk_score >= 7,
      },
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return res.status(500).json({ success: false, error: 'AI service unavailable' });
  }
});

// ── POST /api/ai/analyze ──────────────────────────────
// Analyze a single message without sending a reply
router.post('/analyze', authenticateUser, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message is required' });

    const analysis = await analyzeMessage(message);
    return res.status(200).json({ success: true, data: { analysis } });
  } catch (error) {
    console.error('AI analyze error:', error);
    return res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

// ── GET /api/ai/history ───────────────────────────────
router.get('/history', authenticateUser, async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit  || '50', 10);
    const offset = parseInt(req.query.offset || '0',  10);

    const { data, error, count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(400).json({ success: false, error: error.message });

    return res.status(200).json({
      success: true,
      data: { messages: data, total: count, limit, offset },
    });
  } catch (error) {
    console.error('AI history error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// ── DELETE /api/ai/context ────────────────────────────
// Clear in-memory conversation context for this user
router.delete('/context', authenticateUser, async (req, res) => {
  delete conversationContext[req.userId];
  return res.status(200).json({ success: true, message: 'Conversation context cleared' });
});

module.exports = router;