// =====================================================
// AI ROUTES — Full Groq Integration
// =====================================================
// Uses groqService.js for:
//   - Full message analysis (intent, emotion, risk, abuse)
//   - Multilingual response generation
//   - Conversation context management
//
// Endpoints:
//   POST   /api/ai/chat     — main chat with context + analysis
//   POST   /api/ai/analyze  — analyze a single message
//   GET    /api/ai/history  — fetch past chat_messages from DB
//   DELETE /api/ai/context  — clear in-memory context
// =====================================================

const express = require('express');
const router  = express.Router();
const { supabase }                              = require('../config/supabase');
const { authenticateUser }                      = require('../middleware/auth');
const { analyzeMessage, generateResponse, contextManager } = require('../ai/groqService');

// ── POST /api/ai/chat ─────────────────────────────
router.post('/chat', authenticateUser, async (req, res) => {
  try {
    const { message, source = 'text', language, incident_id } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }

    // 1. Fetch user profile + preferences
    const [{ data: userData }, { data: prefData }] = await Promise.all([
      supabase.from('users').select('full_name').eq('user_id', req.userId).single(),
      supabase.from('user_preferences').select('language_name, language_code').eq('user_id', req.userId).single(),
    ]);

    // Determine target language: request param > stored preference > 'en'
    const targetLanguage = language
      || prefData?.language_code
      || contextManager.getLanguage(req.userId)
      || 'en';

    // 2. Get conversation history
    const conversationHistory = contextManager.getHistory(req.userId);

    // 3. Run analysis + generate response in parallel
    const [analysis, responseData] = await Promise.all([
      analyzeMessage(message, { conversationHistory, userLanguage: targetLanguage }),
      null, // placeholder — generate after analysis for better context
    ]);

    // 4. Generate multilingual response using analysis
    const reply = await generateResponse(message, analysis, {
      targetLanguage,
      conversationHistory,
    });

    // 5. Update context manager
    contextManager.addTurn(req.userId, message, reply.response);
    if (analysis.detected_language) {
      contextManager.setLanguage(req.userId, analysis.detected_language);
    }

    // 6. Auto SOS check — if risk >= 9 or life-threatening
    const autoSOSTrigger = analysis.risk_score >= 9 && analysis.needs_immediate_help;
    let autoIncidentId = null;

    if (autoSOSTrigger) {
      try {
        const { data: incident } = await supabase
          .from('sos_incidents')
          .insert([{
            user_id:        req.userId,
            status:         'triggered',
            trigger_type:   'auto',
            description:    analysis.auto_message_hint,
            emergency_type: analysis.emergency_type,
            risk_score:     analysis.risk_score,
            panic_mode:     true,
            auto_message:   analysis.auto_message_hint,
          }])
          .select()
          .single();
        if (incident) autoIncidentId = incident.id;
      } catch (sosErr) {
        console.error('Auto SOS incident creation failed:', sosErr.message);
      }
    }

    // 7. Persist chat messages
    const baseRow = { user_id: req.userId, ...(incident_id ? { incident_id } : {}) };
    const userRow = {
      ...baseRow,
      role:              'user',
      content:           message,
      intent:            analysis.intent,
      emergency_type:    analysis.emergency_type,
      risk_score:        analysis.risk_score,
      emotion:           analysis.emotion?.primary,
      emotion_intensity: analysis.emotion?.intensity,
      is_emergency:      analysis.is_emergency,
      is_abuse:          analysis.is_abuse_or_harassment,
      detected_language: analysis.detected_language,
      input_source:      source,
    };
    const aiRow = {
      ...baseRow,
      role:              'assistant',
      content:           reply.response,
      detected_language: targetLanguage,
      input_source:      'text',
    };

    await supabase.from('chat_messages').insert([userRow, aiRow]);

    // 8. Audit log for high-risk
    if (analysis.is_emergency || analysis.risk_score >= 7) {
      await supabase.from('audit_logs').insert([{
        user_id:       req.userId,
        action:        'ai_emergency_detected',
        resource_type: 'chat_message',
        metadata: {
          risk_score:       analysis.risk_score,
          is_emergency:     analysis.is_emergency,
          emergency_type:   analysis.emergency_type,
          auto_sos:         autoSOSTrigger,
        },
      }]);
    }

    return res.status(200).json({
      success: true,
      data: {
        // Response
        response:          reply.response,
        response_en:       reply.response_en,
        action_items:      reply.action_items,
        tone:              reply.tone,
        // Analysis
        analysis:          {
          intent:                analysis.intent,
          emergency_type:        analysis.emergency_type,
          is_emergency:          analysis.is_emergency,
          is_abuse_or_harassment:analysis.is_abuse_or_harassment,
          emotion:               analysis.emotion,
          risk_score:            analysis.risk_score,
          risk_factors:          analysis.risk_factors,
          needs_immediate_help:  analysis.needs_immediate_help,
          suggested_helplines:   analysis.suggested_helplines,
          detected_language:     analysis.detected_language,
          confidence:            analysis.confidence,
        },
        // Auto SOS
        emergency_detected:    analysis.is_emergency || analysis.risk_score >= 7,
        auto_sos_triggered:    autoSOSTrigger,
        auto_incident_id:      autoIncidentId,
      },
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return res.status(500).json({ success: false, error: 'AI service unavailable. Please try again.' });
  }
});

// ── POST /api/ai/analyze ──────────────────────────
router.post('/analyze', authenticateUser, async (req, res) => {
  try {
    const { message, language = 'en' } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message is required' });

    const analysis = await analyzeMessage(message, { userLanguage: language });
    return res.status(200).json({ success: true, data: { analysis } });
  } catch (error) {
    console.error('AI analyze error:', error);
    return res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

// ── GET /api/ai/history ───────────────────────────
router.get('/history', authenticateUser, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);

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

// ── DELETE /api/ai/context ────────────────────────
router.delete('/context', authenticateUser, async (req, res) => {
  contextManager.clearSession(req.userId);
  return res.status(200).json({ success: true, message: 'Conversation context cleared' });
});

module.exports = router;