import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { getCurrentSession } from '../../services/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';

const NODE_API = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000';

const getHeaders = async () => {
  const session = await getCurrentSession();
  return { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };
};

const TOPIC_META = {
  sexual_harassment: { icon: '⚖️', color: '#7c3aed', label: 'Sexual Harassment' },
  domestic_violence: { icon: '🏠', color: '#dc2626', label: 'Domestic Violence' },
  rape_assault:      { icon: '🛡️', color: '#b91c1c', label: 'Rape & Assault' },
  stalking:          { icon: '👁️', color: '#d97706', label: 'Stalking & Cyber' },
  eve_teasing:       { icon: '📢', color: '#059669', label: 'Eve Teasing' },
  child_marriage:    { icon: '👧', color: '#2563eb', label: 'Child Marriage' },
};

// ── Know Your Rights Panel ────────────────────────
const KnowYourRights = () => {
  const { t } = useLanguage();
  const [topics, setTopics] = useState([]);
  const [selected, setSelected] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getHeaders().then(h =>
      axios.get(`${NODE_API}/api/legal/topics`, { headers: h })
        .then(r => setTopics(r.data?.data?.topics || []))
        .catch(() => {})
    );
  }, []);

  const loadTopic = async (key) => {
    setSelected(key);
    setLoading(true);
    try {
      const h = await getHeaders();
      const r = await axios.get(`${NODE_API}/api/legal/know-your-rights/${key}`, { headers: h });
      setInfo(r.data?.data);
    } catch { setInfo(null); }
    setLoading(false);
  };

  const meta = selected ? TOPIC_META[selected] : null;

  return (
    <div>
      <p className="la-subtitle">{t('legal_subtitle_rights')}</p>
      <div className="la-topic-grid">
        {Object.entries(TOPIC_META).map(([key, m]) => (
          <button
            key={key}
            className={`la-topic-btn ${selected === key ? 'active' : ''}`}
            onClick={() => loadTopic(key)}
            style={{ '--accent': m.color }}
          >
            <span className="la-topic-icon">{m.icon}</span>
            <span className="la-topic-label">{m.label}</span>
          </button>
        ))}
      </div>

      {loading && <div className="la-loading">{t('legal_loading')}</div>}

      {info && !loading && (
        <div className="la-info-card" style={{ borderLeft: `3px solid ${meta?.color}` }}>
          <h3 className="la-info-title">{info.title}</h3>
          <div className="la-info-section">
            <h4>Applicable Laws</h4>
            <ul>{(info.acts || []).map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
          <div className="la-info-section">
            <h4>Your Rights</h4>
            <ul>{(info.rights || []).map((r, i) => <li key={i}>✓ {r}</li>)}</ul>
          </div>
          <div className="la-info-section">
            <h4>What to Do — Step by Step</h4>
            <ol>{(info.steps || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
          <div className="la-info-section">
            <h4>IPC Sections</h4>
            <div className="la-ipc-grid">
              {(info.ipc_sections || []).map((s, i) => (
                <span key={i} className="la-ipc-badge">{s}</span>
              ))}
            </div>
          </div>
          <div className="la-helplines-row">
            <span className="la-hl-label">{t('legal_answer_helplines')}:</span>
            {(info.helplines || []).map((h, i) => (
              <a key={i} href={`tel:${h.split(' ')[0]}`} className="la-hl-pill">{h}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── AI Legal Q&A ──────────────────────────────────
const LegalQA = () => {
  // 1. Get both translation function and language code from context
  const { t, languageCode } = useLanguage(); 
  
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 2. Localize Example Questions via translation keys
  const EXAMPLE_QS = [
    t('legal_example_1'),
    t('legal_example_2'),
    t('legal_example_3'),
    t('legal_example_4'),
  ];

  const ask = async (q) => {
    const text = (q || question).trim();
    if (!text) return;
    setLoading(true);
    setAnswer(null);
    setError('');
    
    try {
      const h = await getHeaders();
      // 3. Pass the languageCode to the backend so the AI knows which language to output
      const r = await axios.post(
        `${NODE_API}/api/legal/ai-legal-help`, 
        { 
          question: text,
          language: languageCode // Backend uses this to steer the LLM response
        }, 
        { headers: h }
      );
      setAnswer(r.data?.data);
    } catch { 
      setError(t('legal_error')); 
    }
    setLoading(false);
  };

  return (
    <div>
      <p className="la-subtitle">{t('legal_subtitle_qa')}</p>
      
      <div className="la-qa-input-row">
        <input
          className="la-qa-input"
          placeholder={t('legal_ask_ph')}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
        />
        <button className="la-qa-btn" onClick={() => ask()} disabled={!question.trim() || loading}>
          {loading ? '…' : t('legal_ask_btn')}
        </button>
      </div>

      <div className="la-example-prompts">
        {EXAMPLE_QS.map((q, index) => (
          <button 
            key={index} 
            className="la-example-btn" 
            onClick={() => { setQuestion(q); ask(q); }}
          >
            {q}
          </button>
        ))}
      </div>

      {error && <div className="la-error">{error}</div>}

      {answer && (
        <div className="la-answer-card">
          {/* AI generated answer will now be in the requested language */}
          <p className="la-answer-text">{answer.answer}</p>
          
          {answer.relevant_sections?.length > 0 && (
            <div className="la-answer-section">
              <strong>{t('legal_answer_sections')}:</strong>
              <div className="la-ipc-grid" style={{ marginTop: 6 }}>
                {answer.relevant_sections.map((s, i) => (
                  <span key={i} className="la-ipc-badge">{s}</span>
                ))}
              </div>
            </div>
          )}

          {answer.next_steps?.length > 0 && (
            <div className="la-answer-section">
              <strong>{t('legal_answer_steps')}:</strong>
              <ol style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                {answer.next_steps.map((s, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                ))}
              </ol>
            </div>
          )}

          {answer.helplines?.length > 0 && (
            <div className="la-helplines-row" style={{ marginTop: 12 }}>
              <span className="la-hl-label">{t('legal_answer_helplines')}:</span>
              {answer.helplines.map((h, i) => (
                <a key={i} href={`tel:${h.split(' ')[0]}`} className="la-hl-pill">{h}</a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── FIR Draft Assistant ────────────────────────────
const FIRDraft = () => {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    complainantName: '', complainantAddress: '', complainantPhone: '',
    incidentDate: '', incidentTime: '', incidentLocation: '',
    accusedDescription: '', incidentDescription: '', witnesses: '',
    offenseType: 'sexual_harassment',
  });
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const OFFENSE_TYPES = useMemo(() => 
    Object.entries(TOPIC_META).map(([k, v]) => ({ value: k, label: v.label })), []
  );

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const generate = async () => {
    if (!form.incidentDescription.trim()) return;
    setLoading(true);
    try {
      const h = await getHeaders();
      const r = await axios.post(`${NODE_API}/api/legal/fir-draft`, form, { headers: h });
      setDraft(r.data?.data?.draft || '');
    } catch { setDraft('Failed to generate draft.'); }
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <p className="la-subtitle">{t('legal_subtitle_fir')}</p>
      <div className="la-fir-grid">
        <div className="la-field">
          <label className="la-label">{t('legal_fir_offense')} *</label>
          <select className="la-input" value={form.offenseType} onChange={set('offenseType')}>
            {OFFENSE_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="la-field">
          <label className="la-label">{t('legal_fir_name')}</label>
          <input className="la-input" value={form.complainantName} onChange={set('complainantName')} />
        </div>
        <div className="la-field">
          <label className="la-label">{t('legal_fir_phone')}</label>
          <input className="la-input" value={form.complainantPhone} onChange={set('complainantPhone')} />
        </div>
        <div className="la-field">
          <label className="la-label">{t('legal_fir_date')} *</label>
          <input className="la-input" type="date" value={form.incidentDate} onChange={set('incidentDate')} />
        </div>
        <div className="la-field">
          <label className="la-label">{t('legal_fir_time')}</label>
          <input className="la-input" type="time" value={form.incidentTime} onChange={set('incidentTime')} />
        </div>
        <div className="la-field" style={{ gridColumn: '1 / -1' }}>
          <label className="la-label">{t('legal_fir_location')} *</label>
          <input className="la-input" value={form.incidentLocation} onChange={set('incidentLocation')} />
        </div>
        <div className="la-field" style={{ gridColumn: '1 / -1' }}>
          <label className="la-label">{t('legal_fir_address')}</label>
          <input className="la-input" value={form.complainantAddress} onChange={set('complainantAddress')} />
        </div>
        <div className="la-field" style={{ gridColumn: '1 / -1' }}>
          <label className="la-label">{t('legal_fir_accused')}</label>
          <input className="la-input" value={form.accusedDescription} onChange={set('accusedDescription')} />
        </div>
        <div className="la-field" style={{ gridColumn: '1 / -1' }}>
          <label className="la-label">{t('legal_fir_desc')} *</label>
          <textarea className="la-input la-textarea" rows={5} value={form.incidentDescription} onChange={set('incidentDescription')} />
        </div>
        <div className="la-field" style={{ gridColumn: '1 / -1' }}>
          <label className="la-label">{t('legal_fir_witnesses')}</label>
          <input className="la-input" value={form.witnesses} onChange={set('witnesses')} />
        </div>
      </div>

      <div className="la-fir-notice">ℹ️ {t('legal_fir_notice')}</div>

      <button className="la-generate-btn" onClick={generate} disabled={!form.incidentDescription.trim() || loading}>
        {loading ? t('legal_fir_generating') : `📄 ${t('legal_fir_generate')}`}
      </button>

      {draft && (
        <div className="la-draft-box">
          <div className="la-draft-header">
            <span>Generated FIR Draft</span>
            <button className="la-copy-btn" onClick={copy}>{copied ? t('legal_fir_copied') : t('legal_fir_copy')}</button>
          </div>
          <pre className="la-draft-text">{draft}</pre>
        </div>
      )}
    </div>
  );
};

// ── Main Legal Assistant Component ─────────────────
const LegalAssistant = () => {
  const [tab, setTab] = useState('rights');
  const { t } = useLanguage();

  const TABS = useMemo(() => [
    { key: 'rights', icon: '⚖️', label: t('legal_tab_rights') },
    { key: 'qa',     icon: '🤖', label: t('legal_tab_qa') },
    { key: 'fir',    icon: '📄', label: t('legal_tab_fir') },
  ], [t]);

  return (
    <div className="la-container">
      <div className="la-tab-bar">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`la-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="la-panel">
        {tab === 'rights' && <KnowYourRights />}
        {tab === 'qa'      && <LegalQA />}
        {tab === 'fir'     && <FIRDraft />}
      </div>

      <style>{`
        /* ... existing styles remain unchanged ... */
        .la-container{max-width:760px;margin:0 auto;font-family:'DM Sans',sans-serif}
        .la-tab-bar{display:flex;gap:0;border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden;margin-bottom:20px}
        .la-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:12px 8px;background:#131929;border:none;color:#64748b;font-size:.85rem;font-weight:500;cursor:pointer;transition:all .2s;font-family:inherit;border-right:1px solid rgba(255,255,255,.07)}
        .la-tab:last-child{border-right:none}
        .la-tab:hover{background:#1E2740;color:#CBD5E4}
        .la-tab.active{background:rgba(230,57,70,.12);color:#FF6B74}
        .la-panel{animation:la-in .25s ease}
        @keyframes la-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .la-subtitle{font-size:.85rem;color:#64748b;margin:0 0 16px}
        .la-topic-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:20px}
        .la-topic-btn{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 10px;background:#131929;border:1.5px solid rgba(255,255,255,.07);border-radius:12px;cursor:pointer;transition:all .2s;font-family:inherit}
        .la-topic-btn:hover{border-color:var(--accent);background:rgba(255,255,255,.03)}
        .la-topic-btn.active{border-color:var(--accent);background:rgba(255,255,255,.06)}
        .la-topic-icon{font-size:1.6rem;line-height:1}
        .la-topic-label{font-size:.78rem;color:#CBD5E4;font-weight:500;text-align:center}
        .la-loading{text-align:center;padding:30px;color:#64748b}
        .la-info-card{background:#131929;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,.07);animation:la-in .3s ease}
        .la-info-title{font-family:'Syne',sans-serif;font-weight:700;font-size:1.05rem;color:#fff;margin:0 0 16px}
        .la-info-section{margin-bottom:16px}
        .la-info-section h4{font-size:.78rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;font-weight:500}
        .la-info-section ul,.la-info-section ol{margin:0;padding-left:18px;color:#CBD5E4;font-size:.88rem;line-height:1.7}
        .la-info-section li{margin-bottom:4px}
        .la-ipc-grid{display:flex;flex-wrap:wrap;gap:6px}
        .la-ipc-badge{padding:4px 10px;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.3);border-radius:6px;font-size:.72rem;color:#93c5fd}
        .la-helplines-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)}
        .la-hl-label{font-size:.78rem;color:#64748b}
        .la-hl-pill{padding:5px 12px;background:rgba(230,57,70,.12);border:1px solid rgba(230,57,70,.3);border-radius:20px;color:#FF6B74;text-decoration:none;font-size:.78rem;font-weight:600}
        .la-hl-pill:hover{background:rgba(230,57,70,.25)}
        .la-qa-input-row{display:flex;gap:8px;margin-bottom:14px}
        .la-qa-input{flex:1;padding:11px 14px;background:#1E2740;border:1.5px solid rgba(255,255,255,.07);border-radius:8px;color:#fff;font-size:.9rem;font-family:inherit;outline:none;transition:border-color .2s}
        .la-qa-input:focus{border-color:#E63946}
        .la-qa-input::placeholder{color:#374151}
        .la-qa-btn{padding:11px 20px;background:#E63946;border:none;border-radius:8px;color:#fff;font-size:.9rem;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit}
        .la-qa-btn:hover:not(:disabled){background:#c8303c}
        .la-qa-btn:disabled{opacity:.5;cursor:not-allowed}
        .la-example-prompts{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px}
        .la-example-btn{padding:7px 13px;background:#131929;border:1px solid rgba(255,255,255,.07);border-radius:20px;color:#CBD5E4;font-size:.78rem;cursor:pointer;font-family:inherit;transition:all .2s}
        .la-example-btn:hover{border-color:#E63946;color:#FF6B74}
        .la-error{padding:10px 14px;background:rgba(230,57,70,.1);border:1px solid rgba(230,57,70,.3);border-radius:8px;color:#FF6B74;font-size:.83rem;margin-bottom:12px}
        .la-answer-card{background:#131929;border:1px solid rgba(255,255,255,.07);border-left:3px solid #E63946;border-radius:12px;padding:16px;animation:la-in .25s ease}
        .la-answer-text{font-size:.9rem;color:#CBD5E4;line-height:1.7;margin:0 0 12px}
        .la-answer-section{margin-top:12px;font-size:.85rem;color:#CBD5E4}
        .la-fir-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
        .la-field{display:flex;flex-direction:column;gap:5px}
        .la-label{font-size:.72rem;font-weight:500;color:#CBD5E4;letter-spacing:.03em}
        .la-input{padding:10px 13px;background:#1E2740;border:1.5px solid rgba(255,255,255,.07);border-radius:8px;color:#fff;font-size:.88rem;font-family:inherit;outline:none;transition:border-color .2s;width:100%;box-sizing:border-box}
        .la-input:focus{border-color:#E63946}
        .la-input::placeholder{color:#374151}
        .la-input option{background:#1E2740}
        .la-textarea{resize:vertical;min-height:100px}
        .la-fir-notice{padding:10px 14px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:8px;color:#93c5fd;font-size:.8rem;margin-bottom:14px}
        .la-generate-btn{width:100%;padding:13px;background:#E63946;border:none;border-radius:10px;color:#fff;font-size:.95rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;margin-bottom:16px}
        .la-generate-btn:hover:not(:disabled){background:#c8303c}
        .la-generate-btn:disabled{opacity:.5;cursor:not-allowed}
        .la-draft-box{background:#0B0F1A;border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden}
        .la-draft-header{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#131929;border-bottom:1px solid rgba(255,255,255,.07);font-size:.82rem;color:#CBD5E4;font-weight:500}
        .la-copy-btn{padding:5px 12px;background:#1E2740;border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#CBD5E4;font-size:.75rem;cursor:pointer;font-family:inherit}
        .la-copy-btn:hover{background:#253050}
        .la-draft-text{padding:16px;font-size:.8rem;color:#94a3b8;font-family:'Courier New',monospace;white-space:pre-wrap;line-height:1.6;margin:0;overflow-x:auto}
        @media(max-width:600px){.la-fir-grid{grid-template-columns:1fr}.la-tab span:last-child{display:none}}
      `}</style>
    </div>
  );
};

export default LegalAssistant;