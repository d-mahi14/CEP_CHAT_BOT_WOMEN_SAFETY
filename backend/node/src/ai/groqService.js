// =====================================================
// GROQ AI SERVICE
// =====================================================
// Modules: 8 (Emotion), 16 (Intent), 18 (Abuse Detection),
//          19 (Risk Scoring), 20 (Multilingual NLP)
// Model: llama-3.3-70b-versatile (fast + accurate)
// =====================================================

const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

// ── Raw Groq call ─────────────────────────────────
async function callGroq(messages, { temperature = 0.1, maxTokens = 512 } = {}) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');

  const res = await axios.post(
    GROQ_API_URL,
    {
      model: GROQ_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  const raw = res.data.choices[0]?.message?.content || '{}';
  try { return JSON.parse(raw); }
  catch { return { raw }; }
}

// ─────────────────────────────────────────────────
// MODULE 16 + 8 + 18 + 19 — FULL ANALYSIS
// Single Groq call → intent + emotion + abuse + risk
// ─────────────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are an emergency safety AI for an Indian safety app.
Analyze the user message and return ONLY valid JSON with this exact structure:

{
  "intent": "emergency|legal_help|mental_health|information|harassment|other",
  "emergency_type": "violence|medical|fire|accident|harassment|mental_health|other|none",
  "is_emergency": true|false,
  "is_abuse_or_harassment": true|false,
  "emotion": {
    "primary": "fear|panic|distress|calm|anger|sadness|neutral",
    "intensity": 1-10,
    "indicators": ["list", "of", "detected", "cues"]
  },
  "risk_score": 1-10,
  "risk_factors": ["list of reasons"],
  "needs_immediate_help": true|false,
  "suggested_helplines": ["112", "100", "1091"],
  "auto_message_hint": "brief summary for auto-alert",
  "detected_language": "en|hi|ta|te|mr|bn|gu|kn|ml|pa|unknown",
  "confidence": 0.0-1.0
}

Risk scoring guide:
1-3: No emergency (info query)
4-5: Mild concern (distress, needs support)
6-7: Moderate (harassment, fear, needs help)
8-9: Severe (violence, assault, medical emergency)
10: Critical (life-threatening, immediate danger)

Be accurate. User safety depends on your analysis.`;

/**
 * Full AI analysis of user message
 * Returns intent + emotion + abuse detection + risk score
 */
async function analyzeMessage(text, { conversationHistory = [], userLanguage = 'en' } = {}) {
  const messages = [
    { role: 'system', content: ANALYSIS_SYSTEM },
    // Include last 3 turns for context (Module 17)
    ...conversationHistory.slice(-6),
    {
      role: 'user',
      content: `User message (language hint: ${userLanguage}): "${text}"`,
    },
  ];

  try {
    const result = await callGroq(messages, { temperature: 0.05, maxTokens: 400 });

    // Normalize + validate
    return {
      intent:                result.intent || 'other',
      emergency_type:        result.emergency_type || 'none',
      is_emergency:          Boolean(result.is_emergency),
      is_abuse_or_harassment:Boolean(result.is_abuse_or_harassment),
      emotion: {
        primary:    result.emotion?.primary    || 'neutral',
        intensity:  Number(result.emotion?.intensity) || 1,
        indicators: result.emotion?.indicators || [],
      },
      risk_score:            Math.min(Math.max(Number(result.risk_score) || 1, 1), 10),
      risk_factors:          result.risk_factors || [],
      needs_immediate_help:  Boolean(result.needs_immediate_help),
      suggested_helplines:   result.suggested_helplines || [],
      auto_message_hint:     result.auto_message_hint || text.slice(0, 100),
      detected_language:     result.detected_language || userLanguage,
      confidence:            Number(result.confidence) || 0.7,
      raw_text:              text,
    };
  } catch (err) {
    console.error('Groq analyzeMessage error:', err.message);
    // Fallback — don't crash; return conservative estimate
    return {
      intent: 'other', emergency_type: 'other', is_emergency: false,
      is_abuse_or_harassment: false,
      emotion: { primary: 'neutral', intensity: 1, indicators: [] },
      risk_score: 5, risk_factors: ['AI analysis unavailable'],
      needs_immediate_help: false, suggested_helplines: ['112'],
      auto_message_hint: text.slice(0, 100),
      detected_language: userLanguage, confidence: 0,
      raw_text: text, error: err.message,
    };
  }
}

// ─────────────────────────────────────────────────
// MODULE 20 — MULTILINGUAL RESPONSE
// Responds to user in their detected language
// ─────────────────────────────────────────────────

const LANGUAGE_NAMES = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu',
  mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', kn: 'Kannada',
  ml: 'Malayalam', pa: 'Punjabi',
};

const MULTILINGUAL_SYSTEM = `You are a compassionate safety assistant for an Indian emergency app.
Respond in the user's language. Be empathetic, brief, and action-oriented.
If the situation is an emergency, be urgent and direct.

Return ONLY valid JSON:
{
  "response": "your response in the user's language",
  "response_en": "English translation of your response",
  "action_items": ["step 1", "step 2"],
  "tone": "urgent|empathetic|calm|informational"
}`;

/**
 * Generate a multilingual response to the user
 */
async function generateResponse(text, analysis, { targetLanguage = 'en', conversationHistory = [] } = {}) {
  const langName = LANGUAGE_NAMES[targetLanguage] || 'English';
  const urgency  = analysis.risk_score >= 8 ? 'URGENT EMERGENCY' : analysis.risk_score >= 5 ? 'concerning situation' : 'query';

  const systemPrompt = MULTILINGUAL_SYSTEM +
    `\n\nCurrent situation: ${urgency}. Risk level: ${analysis.risk_score}/10.` +
    `\nRespond in ${langName}. Keep response under 80 words.` +
    (analysis.is_emergency ? '\nThis is an EMERGENCY — be direct and tell them to call 112 immediately.' : '');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-4),
    { role: 'user', content: text },
  ];

  try {
    const result = await callGroq(messages, { temperature: 0.3, maxTokens: 300 });
    return {
      response:    result.response    || 'Please call 112 for immediate help.',
      response_en: result.response_en || result.response || '',
      action_items:result.action_items || [],
      tone:        result.tone        || 'calm',
    };
  } catch (err) {
    console.error('Groq generateResponse error:', err.message);
    const fallbacks = {
      en: 'Please call 112 immediately for help. Your safety is the priority.',
      hi: 'कृपया तुरंत 112 पर कॉल करें। आपकी सुरक्षा प्राथमिकता है।',
      ta: 'உடனே 112ஐ அழையுங்கள். உங்கள் பாதுகாப்பு முக்கியம்.',
    };
    return {
      response:     fallbacks[targetLanguage] || fallbacks.en,
      response_en:  fallbacks.en,
      action_items: ['Call 112', 'Move to a safe location'],
      tone: 'urgent',
    };
  }
}

// ─────────────────────────────────────────────────
// MODULE 17 — CONTEXT MANAGER
// Manages conversation history per session (in-memory)
// In production: store in Redis or Supabase
// ─────────────────────────────────────────────────

class ConversationContext {
  constructor() {
    // Map: userId → { history: [], lastActive: Date, language: str }
    this.sessions = new Map();
    // Auto-cleanup idle sessions every 30 min
    setInterval(() => this._cleanup(), 30 * 60 * 1000);
  }

  getHistory(userId) {
    return this.sessions.get(userId)?.history || [];
  }

  getLanguage(userId) {
    return this.sessions.get(userId)?.language || 'en';
  }

  addTurn(userId, userMessage, assistantResponse) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, { history: [], lastActive: new Date(), language: 'en' });
    }
    const session = this.sessions.get(userId);
    session.history.push(
      { role: 'user',      content: userMessage },
      { role: 'assistant', content: assistantResponse }
    );
    // Keep last 10 turns (20 messages)
    if (session.history.length > 20) session.history = session.history.slice(-20);
    session.lastActive = new Date();
  }

  setLanguage(userId, langCode) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, { history: [], lastActive: new Date(), language: langCode });
    } else {
      this.sessions.get(userId).language = langCode;
    }
  }

  clearSession(userId) {
    this.sessions.delete(userId);
  }

  _cleanup() {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [userId, session] of this.sessions.entries()) {
      if (session.lastActive < cutoff) this.sessions.delete(userId);
    }
  }
}

// Singleton context manager
const contextManager = new ConversationContext();

module.exports = { analyzeMessage, generateResponse, contextManager };