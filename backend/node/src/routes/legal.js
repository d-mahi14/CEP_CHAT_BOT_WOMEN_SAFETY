// =====================================================
// LEGAL ROUTES — Module 23 (Legal Content Management)
// Know Your Rights, FIR Filing Guidance, IPC/Law Help
//
// CHANGES:
//   - ai-legal-help endpoint now receives `languageName`
//     from the frontend and enforces it in the system
//     prompt with explicit instructions to NEVER respond
//     in English unless the target language IS English.
//   - This guarantees the answer, next_steps, and
//     relevant_sections are all in the user's chosen
//     language (Hindi, Tamil, Telugu, Marathi, etc.)
// =====================================================

const express = require('express');
const router  = express.Router();
const { supabase }       = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const axios              = require('axios');

// ── Language name map ──────────────────────────────
const LANGUAGE_NAMES = {
  en: 'English',   hi: 'Hindi',     ta: 'Tamil',   te: 'Telugu',
  mr: 'Marathi',   bn: 'Bengali',   gu: 'Gujarati', kn: 'Kannada',
  ml: 'Malayalam', pa: 'Punjabi',
};

// ── Static Legal Knowledge Base ────────────────────
const LEGAL_KNOWLEDGE = {
  sexual_harassment: {
    title: 'Sexual Harassment at Workplace',
    acts: ['Sexual Harassment of Women at Workplace Act, 2013 (POSH)', 'IPC Section 354A'],
    rights: [
      'Right to file a complaint with the Internal Complaints Committee (ICC)',
      'Right to a fair investigation within 90 days',
      'Right to interim relief during investigation (transfer, leave)',
      'Right to appeal if dissatisfied with ICC findings',
    ],
    steps: [
      'Document all incidents with dates, times, witnesses',
      'File written complaint with ICC within 3 months of last incident',
      'Request interim measures if needed (transfer, medical leave)',
      'If ICC not present, approach Local Complaints Committee (LCC)',
    ],
    helplines: ['1800-111-900 (NCW)', '181 (Women Helpline)'],
    ipc_sections: ['IPC 354A — Sexual harassment', 'IPC 354B — Assault to disrobe', 'IPC 354C — Voyeurism', 'IPC 354D — Stalking'],
  },
  domestic_violence: {
    title: 'Domestic Violence',
    acts: ['Protection of Women from Domestic Violence Act, 2005 (PWDVA)', 'IPC Section 498A'],
    rights: [
      'Right to reside in the shared household',
      'Right to protection order against the abuser',
      'Right to monetary relief for losses and medical expenses',
      'Right to custody of children temporarily',
      'Right to legal aid free of cost',
    ],
    steps: [
      'Contact a Protection Officer or service provider',
      'File a Domestic Incident Report (DIR)',
      'Apply for a Protection Order in the Magistrate court',
      'Seek emergency shelter if needed',
    ],
    helplines: ['181 (Women Helpline)', '100 (Police)', '1091 (Women in Distress)'],
    ipc_sections: ['IPC 498A — Cruelty by husband or relatives', 'IPC 304B — Dowry death', 'IPC 406 — Criminal breach of trust (dowry)'],
  },
  rape_assault: {
    title: 'Rape & Sexual Assault',
    acts: ['IPC Section 375/376', 'Criminal Law Amendment Act, 2013 (Nirbhaya Act)'],
    rights: [
      'Right to free medical examination and treatment at any government hospital',
      'Right to file Zero FIR at any police station (not just where crime occurred)',
      'Right to record statement before a magistrate (no police present)',
      'Right to free legal aid',
      'Right to in-camera trial',
      'Identity cannot be disclosed publicly',
    ],
    steps: [
      'Go to nearest hospital for immediate medical care (preserve evidence)',
      'File Zero FIR at the nearest police station',
      'Request female officer for statement recording',
      'Contact a One Stop Centre (OSC) for integrated support',
    ],
    helplines: ['112 (Emergency)', '1091 (Women in Distress)', '181 (Women Helpline)'],
    ipc_sections: ['IPC 375 — Definition of rape', 'IPC 376 — Punishment (7 years to life)', 'IPC 376D — Gang rape', 'IPC 354 — Outraging modesty'],
  },
  stalking: {
    title: 'Stalking & Cyberstalking',
    acts: ['IPC Section 354D', 'IT Act 2000 Section 66E, 67'],
    rights: [
      'Right to file FIR for stalking (cognizable offense)',
      'Right to seek restraining order',
      'Right to report cyberstalking to cybercrime portal',
    ],
    steps: [
      'Collect evidence: screenshots, call logs, witnesses',
      'File FIR at nearest police station (Section 354D IPC)',
      'Report to cybercrime.gov.in for online harassment',
      'Request police protection if in immediate danger',
    ],
    helplines: ['1091', '100 (Police)', 'cybercrime.gov.in'],
    ipc_sections: ['IPC 354D — Stalking (3 years first offense, 5 years repeat)', 'IT Act 66E — Violation of privacy', 'IT Act 67 — Obscene material'],
  },
  eve_teasing: {
    title: 'Eve Teasing & Public Harassment',
    acts: ['IPC Section 294', 'IPC Section 354', 'State-level anti-eve teasing laws'],
    rights: [
      'Right to file complaint with nearest police officer',
      'Any person can file complaint on behalf of victim',
    ],
    steps: [
      'Note details: description, vehicle number, location',
      'Call 100 immediately or approach PCR van',
      'File complaint at nearest police station',
    ],
    helplines: ['100 (Police)', '112', '1091'],
    ipc_sections: ['IPC 294 — Obscene acts in public', 'IPC 354 — Assault to outrage modesty'],
  },
  child_marriage: {
    title: 'Child Marriage',
    acts: ['Prohibition of Child Marriage Act, 2006 (PCMA)'],
    rights: [
      'A child marriage can be declared void by the child on reaching adulthood',
      'Right to approach Child Marriage Prohibition Officer (CMPO)',
    ],
    steps: [
      'Contact CMPO or police to stop an impending child marriage',
      'Childline 1098 can be called 24x7',
    ],
    helplines: ['1098 (Childline)', '181'],
    ipc_sections: ['PCMA Section 9 — Male adult punishment', 'PCMA Section 10 — Abettor punishment'],
  },
};

// ── FIR Template Generator ─────────────────────────
function generateFIRDraft({
  complainantName, complainantAddress, complainantPhone,
  incidentDate, incidentTime, incidentLocation,
  accusedDescription, incidentDescription, witnesses,
  offenseType
}) {
  const knowledge = LEGAL_KNOWLEDGE[offenseType] || {};
  const sections  = (knowledge.ipc_sections || []).map(s => s.split('—')[0].trim()).join(', ');
  const today     = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });

  return `TO,
The Station House Officer,
[Police Station Name],
[District], [State]

DATE: ${today}

SUBJECT: First Information Report — ${knowledge.title || incidentDescription.slice(0,50)}

Sir/Madam,

I, ${complainantName || '[Your Full Name]'}, residing at ${complainantAddress || '[Your Complete Address]'}, Phone: ${complainantPhone || '[Your Phone Number]'}, hereby lodge this complaint and request you to register a First Information Report (FIR) against the person(s) described herein.

1. INCIDENT DETAILS:
   Date of Incident: ${incidentDate || '[Date]'}
   Time of Incident: ${incidentTime || '[Time]'}
   Place of Incident: ${incidentLocation || '[Exact Location]'}

2. DESCRIPTION OF ACCUSED:
   ${accusedDescription || '[Physical description, name if known, relationship to complainant]'}

3. INCIDENT DESCRIPTION:
   ${incidentDescription || '[Detailed account of what happened — include sequence of events, any threats made, injuries sustained, property damaged]'}

4. WITNESSES (if any):
   ${witnesses || '[Names and addresses of any witnesses]'}

5. APPLICABLE SECTIONS:
   ${sections ? `This incident falls under ${sections} of the Indian Penal Code.` : '[Applicable IPC/Special Act sections]'}

6. EVIDENCE AVAILABLE:
   [List any evidence: photographs, messages, medical reports, CCTV footage location]

I request that:
a) An FIR be registered immediately under the appropriate sections
b) Necessary action be taken against the accused
c) A copy of the FIR be provided to me as per law

I declare that the above information is true to the best of my knowledge.

Yours faithfully,

________________________
${complainantName || '[Full Name]'}
Date: ${today}
Signature/Thumb Impression`;
}

// ── GET /api/legal/topics ──────────────────────────
router.get('/topics', authenticateUser, async (req, res) => {
  const topics = Object.entries(LEGAL_KNOWLEDGE).map(([key, val]) => ({
    key,
    title: val.title,
    helplines: val.helplines,
  }));
  return res.json({ success: true, data: { topics } });
});

// ── GET /api/legal/know-your-rights/:topic ─────────
router.get('/know-your-rights/:topic', authenticateUser, async (req, res) => {
  const info = LEGAL_KNOWLEDGE[req.params.topic];
  if (!info) return res.status(404).json({ success: false, error: 'Topic not found' });
  return res.json({ success: true, data: info });
});

// ── POST /api/legal/fir-draft ──────────────────────
router.post('/fir-draft', authenticateUser, async (req, res) => {
  let draft;
  try {
    draft = generateFIRDraft(req.body);
  } catch (err) {
    console.error('FIR generation error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate FIR draft' });
  }

  try {
    await supabase.from('audit_logs').insert([{
      user_id:       req.userId,
      action:        'fir_draft_generated',
      resource_type: 'legal',
      metadata:      { offense_type: req.body.offenseType },
    }]);
  } catch (auditErr) {
    console.error('Audit log error (non-critical):', auditErr.message);
  }

  return res.json({ success: true, data: { draft } });
});

// ── POST /api/legal/ai-legal-help ─────────────────
// UPDATED: Enforces response language — answer is always in the user's selected language
router.post('/ai-legal-help', authenticateUser, async (req, res) => {
  try {
    const { question, language = 'en', languageName } = req.body;
    if (!question) return res.status(400).json({ success: false, error: 'question is required' });

    // Resolve human-readable language name
    const targetLangName = languageName || LANGUAGE_NAMES[language] || 'English';
    const isEnglish = language === 'en';

    // Build a very explicit language instruction so the model cannot default to English
    const languageInstruction = isEnglish
      ? 'Respond in English.'
      : `CRITICAL LANGUAGE REQUIREMENT: You MUST respond entirely in ${targetLangName} (language code: ${language}).
Do NOT use English in the "answer" or "next_steps" fields under any circumstances.
The user has selected ${targetLangName} as their preferred language and cannot read English.
Every word in "answer" and every item in "next_steps" must be written in ${targetLangName} script.
IPC section numbers and helpline numbers may remain as digits/numbers.
"relevant_sections" values should keep the IPC section identifier (e.g. "IPC 354A") but describe it in ${targetLangName}.`;

    const LEGAL_SYSTEM = `You are an Indian women's legal rights assistant specialising in Indian law.
Answer legal questions about Indian law, IPC sections, women's rights, and legal procedures.
Be empathetic, clear, and practical. Mention relevant acts and helplines.

${languageInstruction}

Keep responses under 200 words.
End with relevant helpline numbers.

Return ONLY valid JSON with this exact structure — no markdown, no backticks:
{
  "answer": "your answer in ${targetLangName}",
  "relevant_sections": ["IPC section with short description in ${targetLangName}"],
  "helplines": ["112", "181", "1091"],
  "next_steps": ["step 1 in ${targetLangName}", "step 2 in ${targetLangName}"]
}`;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: LEGAL_SYSTEM },
          { role: 'user',   content: question },
        ],
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const raw = response.data.choices[0]?.message?.content || '{}';
    const result = JSON.parse(raw);

    // Log the query for analytics
    try {
      await supabase.from('audit_logs').insert([{
        user_id:       req.userId,
        action:        'legal_ai_query',
        resource_type: 'legal',
        metadata:      { language, question: question.slice(0, 100) },
      }]);
    } catch (_) { /* non-critical */ }

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('Legal AI error:', err.message);
    return res.status(500).json({ success: false, error: 'Legal AI service unavailable' });
  }
});

// ── GET /api/legal/analytics ───────────────────────
router.get('/analytics', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;

    const [sosRes, chatRes, contactRes] = await Promise.all([
      supabase.from('sos_incidents').select('status, emergency_type, risk_score, trigger_type, created_at, panic_mode')
        .eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('chat_messages').select('intent, emotion, risk_score, is_emergency, detected_language, created_at')
        .eq('user_id', userId).eq('role', 'user').order('created_at', { ascending: false }),
      supabase.from('emergency_contacts').select('id').eq('user_id', userId).eq('is_active', true),
    ]);

    const incidents = sosRes.data || [];
    const chats     = chatRes.data || [];
    const contacts  = contactRes.data || [];

    const sosStats = {
      total:       incidents.length,
      resolved:    incidents.filter(i => i.status === 'resolved').length,
      false_alarm: incidents.filter(i => i.status === 'false_alarm').length,
      cancelled:   incidents.filter(i => i.status === 'cancelled').length,
      panic_mode:  incidents.filter(i => i.panic_mode).length,
      avg_risk:    incidents.length ? Math.round(incidents.reduce((s, i) => s + (i.risk_score || 0), 0) / incidents.length) : 0,
    };

    const typeMap = {};
    incidents.forEach(i => { const t = i.emergency_type || 'other'; typeMap[t] = (typeMap[t] || 0) + 1; });

    const triggerMap = {};
    incidents.forEach(i => { const t = i.trigger_type || 'manual'; triggerMap[t] = (triggerMap[t] || 0) + 1; });

    const intentMap = {};
    chats.forEach(c => { const k = c.intent || 'other'; intentMap[k] = (intentMap[k] || 0) + 1; });

    const emotionMap = {};
    chats.forEach(c => { if (c.emotion) emotionMap[c.emotion] = (emotionMap[c.emotion] || 0) + 1; });

    const monthly = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      monthly[key] = 0;
    }
    incidents.forEach(inc => {
      const d = new Date(inc.created_at);
      const key = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      if (key in monthly) monthly[key]++;
    });

    return res.json({
      success: true,
      data: {
        sos_stats: sosStats,
        emergency_types: typeMap,
        trigger_types:   triggerMap,
        chat_intents:    intentMap,
        emotions:        emotionMap,
        monthly_trend:   monthly,
        contacts_count:  contacts.length,
        chat_total:      chats.length,
        emergency_chats: chats.filter(c => c.is_emergency).length,
        languages_used:  [...new Set(chats.map(c => c.detected_language).filter(Boolean))],
      },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

module.exports = router;