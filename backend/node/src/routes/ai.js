// =====================================================
// AI CHAT ROUTES — Node.js Backend
// =====================================================
// Modules: 7 (Text Input), 11 (Intent), 16 (Classification),
//          17 (Context), 18 (Abuse Detection), 19 (Risk),
//          20 (Multilingual)
// All voice transcription arrives here too (Module 6)
// =====================================================

const express = require('express');
const router  = express.Router();
const { supabase } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { analyzeMessage, generateResponse, contextManager } = require('../ai/groqService');

// ── helpers ──────────────────────────────────────

/**
 * Persist chat message pair to DB for history + audit
 */
async function persistChat(userId, { userMessage, analysis, aiResponse, incidentId = null }) {
  try {
    await supabase.from('chat_messages').insert([
      {
        user_id:        userId,
        incident_id:    incidentId,
        role:           'user',
        content:        userMessage,
        // AI analysis of user message
        intent:         analysis.intent,
        emergency_type: analysis.emergency_type,
        risk_score:     analysis.risk_score,
        emotion:        analysis.emotion.primary,
        emotion_intensity: analysis.emotion.intensity,
        is_emergency:   analysis.is_emergency,
        is_abuse:       analysis.is_abuse_or_harassment,
        detected_language: analysis.detected_language,
      },
      {
        user_id:     userId,
        incident_id: incidentId,
        role:        'assistant',
        content:     aiResponse.response,
        content_en:  aiResponse.response_en,
      },
    ]);
  } catch (err) {
    // Non-fatal — log but don't break response
    console.error('persistChat error:', err.message);
  }
}

/**
 * Auto-trigger SOS if AI detects critical emergency and none is active
 */
async function autoTriggerSOSIfNeeded(userId, analysis, userMessage) {
  if (!analysis.needs_immediate_help || analysis.risk_score < 8) return null;

  try {
    // Check if already has active incident
    const { data: existing } = await supabase
      .from('sos_incidents')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['triggered', 'active'])
      .limit(1)
      .maybeSingle();

    if (existing) return existing.id;

    // Auto-create incident
    const { data: incident } = await supabase
      .from('sos_incidents')
      .insert([{
        user_id:        userId,
        status:         'triggered',
        trigger_type:   'auto',
        description:    userMessage,
        emergency_type: analysis.emergency_type,
        risk_score:     analysis.risk_score,
        panic_mode:     analysis.risk_score >= 9,
        auto_message:   `AUTO-DETECTED EMERGENCY: ${analysis.auto_message_hint}`,
      }])
      .select()
      .single();

    return incident?.id || null;
  } catch (err) {
    console.error('autoTriggerSOS error:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────
// POST /api/ai/chat
// Main entry point for text + voice input
// Body: { message, source: "text"|"voice", language? }
// ─────────────────────────────────────────────────
router.post('/chat', authenticateUser, async (req, res) => {
  const { message, source = 'text', language } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  const userId = req.userId;

  // Sync language preference to context
  if (language) contextManager.setLanguage(userId, language);
  const targetLang = language || contextManager.getLanguage(userId);

  try {
    // ── 1. Analyze message (intent + emotion + risk + abuse) ──
    const history  = contextManager.getHistory(userId);
    const analysis = await analyzeMessage(message, {
      conversationHistory: history,
      userLanguage: targetLang,
    });

    // Sync detected language if not provided
    if (!language && analysis.detected_language !== 'unknown') {
      contextManager.setLanguage(userId, analysis.detected_language);
    }

    // ── 2. Generate multilingual response ──
    const aiResponse = await generateResponse(message, analysis, {
      targetLanguage:    targetLang,
      conversationHistory: history,
    });

    // ── 3. Update conversation context ──
    contextManager.addTurn(userId, message, aiResponse.response);

    // ── 4. Auto-trigger SOS if critical (Module 12) ──
    let autoIncidentId = null;
    if (analysis.is_emergency) {
      autoIncidentId = await autoTriggerSOSIfNeeded(userId, analysis, message);
    }

    // ── 5. Persist to DB (async, non-blocking) ──
    persistChat(userId, {
      userMessage: message,
      analysis,
      aiResponse,
      incidentId: autoIncidentId,
    });

    // ── 6. Audit log ──
    if (analysis.risk_score >= 7 || analysis.is_abuse_or_harassment) {
      supabase.from('audit_logs').insert([{
        user_id:       userId,
        action:        'high_risk_message_detected',
        resource_type: 'chat_message',
        metadata: {
          risk_score:    analysis.risk_score,
          intent:        analysis.intent,
          emergency_type:analysis.emergency_type,
          is_abuse:      analysis.is_abuse_or_harassment,
          source,
        },
      }]).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      data: {
        // AI response
        response:     aiResponse.response,
        response_en:  aiResponse.response_en,
        action_items: aiResponse.action_items,
        tone:         aiResponse.tone,
        // Analysis (Module 16, 18, 19, 8)
        analysis: {
          intent:                 analysis.intent,
          emergency_type:         analysis.emergency_type,
          is_emergency:           analysis.is_emergency,
          is_abuse_or_harassment: analysis.is_abuse_or_harassment,
          emotion:                analysis.emotion,
          risk_score:             analysis.risk_score,
          risk_factors:           analysis.risk_factors,
          needs_immediate_help:   analysis.needs_immediate_help,
          suggested_helplines:    analysis.suggested_helplines,
          detected_language:      analysis.detected_language,
          confidence:             analysis.confidence,
        },
        // Auto-triggered SOS
        auto_sos_triggered: !!autoIncidentId,
        auto_incident_id:   autoIncidentId,
        // Source info
        source,
      },
    });

  } catch (err) {
    console.error('AI chat error:', err);
    return res.status(500).json({ success: false, error: 'AI processing failed' });
  }
});

// ─────────────────────────────────────────────────
// POST /api/ai/analyze
// Lightweight: analyze text only, no response generated
// Used by SOS trigger to re-score with Groq
// ─────────────────────────────────────────────────
router.post('/analyze', authenticateUser, async (req, res) => {
  const { message, language } = req.body;
  if (!message?.trim()) return res.status(400).json({ success: false, error: 'message required' });

  try {
    const analysis = await analyzeMessage(message, {
      conversationHistory: [],
      userLanguage: language || 'en',
    });

    return res.status(200).json({ success: true, data: { analysis } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

// ─────────────────────────────────────────────────
// GET /api/ai/history?page=1&limit=20
// Fetch chat history for current user (Module 9)
// ─────────────────────────────────────────────────
router.get('/history', authenticateUser, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const { data, error, count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: {
        messages: data,
        pagination: { page: Number(page), limit: Number(limit), total: count },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// ─────────────────────────────────────────────────
// DELETE /api/ai/context
// Clear conversation context for fresh session
// ─────────────────────────────────────────────────
router.delete('/context', authenticateUser, (req, res) => {
  contextManager.clearSession(req.userId);
  return res.status(200).json({ success: true, message: 'Conversation context cleared' });
});

module.exports = router;