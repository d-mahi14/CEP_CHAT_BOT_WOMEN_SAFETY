// =====================================================
// AIChat.jsx — UPDATED
// Dark fortress aesthetic · Full Groq analysis display
// Modules: 6 (Voice), 7 (Text), 8 (Emotion), 16 (Intent),
//          17 (Context), 18 (Abuse Alert), 19 (Risk), 20 (Multilingual)
// =====================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { aiAPI } from '../../services/aiService';
import './AIChat.css';

// ── Config ────────────────────────────────────────
const EMOTION_CFG = {
  fear:     { icon: '😨', color: '#f59e0b' },
  panic:    { icon: '😱', color: '#ef4444' },
  distress: { icon: '😰', color: '#f97316' },
  anger:    { icon: '😠', color: '#dc2626' },
  sadness:  { icon: '😢', color: '#6b7280' },
  calm:     { icon: '😌', color: '#10b981' },
  neutral:  { icon: '😐', color: '#64748b' },
};

const INTENT_CFG = {
  emergency:     { icon: '🆘', label: 'Emergency',     color: '#ef4444' },
  harassment:    { icon: '⚠️', label: 'Harassment',    color: '#f97316' },
  mental_health: { icon: '🧠', label: 'Mental Health', color: '#8b5cf6' },
  legal_help:    { icon: '⚖️', label: 'Legal Help',    color: '#3b82f6' },
  information:   { icon: 'ℹ️', label: 'Information',   color: '#06b6d4' },
  other:         { icon: '💬', label: 'General',       color: '#64748b' },
  greeting:      { icon: '👋', label: 'Greeting',      color: '#10b981' },
  question:      { icon: '❓', label: 'Question',      color: '#64748b' },
};

// Risk color helper
function riskColor(score) {
  if (score >= 8) return '#ef4444';
  if (score >= 6) return '#f97316';
  if (score >= 4) return '#f59e0b';
  return '#10b981';
}

// ── Risk Badge ────────────────────────────────────
function RiskBadge({ score }) {
  if (!score || score < 4) return null;
  const label = score >= 8 ? 'Critical' : score >= 6 ? 'High' : 'Moderate';
  return (
    <span className="chip risk-badge" style={{ color: riskColor(score), borderColor: riskColor(score) + '60' }}>
      ⚡ {score}/10 · {label}
    </span>
  );
}

// ── Message Bubble ────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  const ana = msg.analysis;
  const emotionCfg = EMOTION_CFG[ana?.emotion?.primary] || EMOTION_CFG.neutral;
  const intentCfg  = INTENT_CFG[ana?.intent] || INTENT_CFG.other;

  return (
    <div className={`msg-bubble-wrap ${isUser ? 'user' : 'assistant'}`}>
      <div className={`msg-bubble ${isUser ? 'user' : 'assistant'}`}>

        {/* Analysis chips — user messages */}
        {isUser && ana && (
          <div className="msg-analysis-chips">
            <span className="chip intent-chip">
              {intentCfg.icon} {intentCfg.label}
            </span>
            <span className="chip emotion-chip">
              {emotionCfg.icon} {emotionCfg.icon === '😐' ? 'Neutral' : ana.emotion?.primary}
              {ana.emotion?.intensity > 1 && ` ${ana.emotion.intensity}/10`}
            </span>
            <RiskBadge score={ana.risk_score} />
          </div>
        )}

        {/* Message text */}
        <p className="msg-text">{msg.content}</p>

        {/* Voice source */}
        {msg.source === 'voice' && <span className="msg-source">🎙️ Voice</span>}

        {/* Action items from AI */}
        {!isUser && msg.action_items?.length > 0 && (
          <ul className="msg-action-items">
            {msg.action_items.map((item, i) => <li key={i}>→ {item}</li>)}
          </ul>
        )}

        {/* Suggested helplines */}
        {isUser && ana?.suggested_helplines?.length > 0 && (
          <div className="msg-helplines">
            {ana.suggested_helplines.map(num => (
              <a key={num} href={`tel:${num}`} className="helpline-pill">📞 {num}</a>
            ))}
          </div>
        )}

        {/* Abuse warning */}
        {isUser && ana?.is_abuse_or_harassment && (
          <div className="abuse-warning">⚠️ Abuse/harassment detected — you are not alone</div>
        )}

        {/* Language detection (non-English) */}
        {isUser && ana?.detected_language && ana.detected_language !== 'en' && (
          <span className="msg-source">🌐 {ana.detected_language.toUpperCase()}</span>
        )}

        <span className="msg-time">
          {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────
const AIChat = ({ userLanguage = 'en', onEmergencyDetected }) => {
  const [messages,      setMessages]      = useState([]);
  const [inputText,     setInputText]     = useState('');
  const [loading,       setLoading]       = useState(false);
  const [autoSOSBanner, setAutoSOSBanner] = useState(null);
  const [error,         setError]         = useState('');

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const textareaRef    = useRef(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleTextareaChange = (e) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  // ── Voice hook ──
  const {
    isListening, transcript, interimText,
    permission, supported, error: voiceError,
    startListening, stopListening, clearTranscript,
  } = useVoiceInput({
    language: userLanguage,
    onTranscript: (text, isFinal) => {
      if (isFinal) setInputText(prev => (prev + ' ' + text).trim());
    },
    onSOSKeyword: useCallback((keyword, fullText) => {
      sendMessage(fullText, 'voice');
    }, []),
    continuous: false,
  });

  // ── Send message ──
  const sendMessage = useCallback(async (textOverride, source = 'text') => {
    const text = (textOverride || inputText).trim();
    if (!text || loading) return;

    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    clearTranscript();
    setError('');
    setLoading(true);

    const userMsgId = Date.now() + '-user';
    setMessages(prev => [...prev, {
      id: userMsgId, role: 'user', content: text,
      source, timestamp: new Date(), analysis: null,
    }]);

    try {
      const res = await aiAPI.chat(text, source, userLanguage);

      if (res.success) {
        const d = res.data;

        // Update user message with analysis
        setMessages(prev => prev.map(m =>
          m.id === userMsgId ? { ...m, analysis: d.analysis } : m
        ));

        // Add AI response
        setMessages(prev => [...prev, {
          id: Date.now() + '-ai',
          role: 'assistant',
          content: d.response,
          action_items: d.action_items,
          tone: d.tone,
          timestamp: new Date(),
        }]);

        // Auto SOS banner
        if (d.auto_sos_triggered) {
          setAutoSOSBanner(d.auto_incident_id);
          onEmergencyDetected?.(d);
        }
      }
    } catch (err) {
      setError('Failed to send message. Check your connection.');
      setMessages(prev => prev.filter(m => m.id !== userMsgId));
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, userLanguage, clearTranscript, onEmergencyDetected]);

  // ── Voice toggle ──
  const handleVoiceToggle = useCallback(async () => {
    if (isListening) {
      stopListening();
      if (transcript.trim()) sendMessage(transcript, 'voice');
    } else {
      clearTranscript();
      await startListening();
    }
  }, [isListening, transcript, startListening, stopListening, clearTranscript, sendMessage]);

  // ── Enter key ──
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const EXAMPLE_PROMPTS = [
    'Someone is following me',
    'I need police help',
    'मुझे मदद चाहिए',
    'Udhavi thevai',
  ];

  return (
    <div className="ai-chat-container">

      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-ai-avatar">🤖</span>
          <div>
            <h3 className="chat-title">Safety Assistant</h3>
            <p className="chat-subtitle">
              AI-powered · {supported ? 'Voice ready' : 'Text only'} · 10 Indian languages
            </p>
          </div>
        </div>
        <button
          className="chat-clear-btn"
          onClick={() => { setMessages([]); aiAPI.clearContext(); setAutoSOSBanner(null); }}
          title="Clear conversation"
        >
          🗑️
        </button>
      </div>

      {/* Auto-SOS Banner */}
      {autoSOSBanner && (
        <div className="auto-sos-banner">
          🆘 Emergency auto-detected — SOS triggered automatically
          <button onClick={() => setAutoSOSBanner(null)}>×</button>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <span className="empty-chat-icon">🛡️</span>
            <p>Tell me what's happening.</p>
            <p className="empty-sub">Type or speak — any Indian language supported.</p>
            <div className="example-prompts">
              {EXAMPLE_PROMPTS.map(p => (
                <button key={p} className="example-prompt-btn" onClick={() => sendMessage(p, 'text')}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

        {loading && (
          <div className="chat-typing">
            <span /><span /><span />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice listening bar */}
      {isListening && (
        <div className="voice-listening-bar">
          <div className="voice-waves">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="voice-wave" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <span className="voice-interim">{interimText || 'Listening…'}</span>
          <button className="voice-cancel" onClick={stopListening}>✕</button>
        </div>
      )}

      {/* Error */}
      {(error || voiceError) && (
        <div className="chat-error">{error || voiceError}</div>
      )}

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={inputText}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening…' : 'Type a message… (Shift+Enter for new line)'}
          rows={1}
          disabled={loading || isListening}
        />
        <div className="chat-input-actions">
          {supported && (
            <button
              className={`voice-btn ${isListening ? 'active' : ''} ${permission === 'denied' ? 'denied' : ''}`}
              onClick={handleVoiceToggle}
              disabled={permission === 'denied'}
              title={permission === 'denied' ? 'Mic denied' : isListening ? 'Stop' : 'Voice input'}
            >
              {isListening ? '⏹️' : '🎙️'}
            </button>
          )}
          <button
            className="send-btn"
            onClick={() => sendMessage()}
            disabled={!inputText.trim() || loading}
          >
            {loading ? '⏳' : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;