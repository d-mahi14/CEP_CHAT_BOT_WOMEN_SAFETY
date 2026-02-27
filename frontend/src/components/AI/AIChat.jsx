// =====================================================
// AIChat Component
// =====================================================
// Modules: 6 (Voice), 7 (Text), 8 (Emotion Display),
//          16 (Intent), 17 (Context), 18 (Abuse Alert),
//          19 (Risk Display), 20 (Multilingual)
// =====================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { aiAPI } from '../../services/aiService';

// ── Emotion config ────────────────────────────────
const EMOTION_CONFIG = {
  fear:     { icon: '😨', color: '#f59e0b', label: 'Fear'     },
  panic:    { icon: '😱', color: '#ef4444', label: 'Panic'    },
  distress: { icon: '😰', color: '#f97316', label: 'Distress' },
  anger:    { icon: '😠', color: '#dc2626', label: 'Anger'    },
  sadness:  { icon: '😢', color: '#6b7280', label: 'Sadness'  },
  calm:     { icon: '😌', color: '#10b981', label: 'Calm'     },
  neutral:  { icon: '😐', color: '#94a3b8', label: 'Neutral'  },
};

const INTENT_CONFIG = {
  emergency:       { icon: '🆘', color: '#ef4444', label: 'Emergency'        },
  harassment:      { icon: '⚠️', color: '#f97316', label: 'Harassment'       },
  mental_health:   { icon: '🧠', color: '#8b5cf6', label: 'Mental Health'    },
  legal_help:      { icon: '⚖️', color: '#3b82f6', label: 'Legal Help'       },
  information:     { icon: 'ℹ️', color: '#06b6d4', label: 'Information'      },
  other:           { icon: '💬', color: '#64748b', label: 'General'          },
};

// ── Risk badge ────────────────────────────────────
function RiskBadge({ score }) {
  if (!score || score < 4) return null;
  const cfg =
    score >= 8 ? { color: '#ef4444', bg: '#fef2f2', label: 'Critical'  } :
    score >= 6 ? { color: '#f97316', bg: '#fff7ed', label: 'High'       } :
                 { color: '#f59e0b', bg: '#fffbeb', label: 'Moderate'   };
  return (
    <span className="risk-badge" style={{ color: cfg.color, background: cfg.bg }}>
      ⚡ Risk {score}/10 — {cfg.label}
    </span>
  );
}

// ── Message bubble ────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  const emotionCfg = EMOTION_CONFIG[msg.analysis?.emotion?.primary] || EMOTION_CONFIG.neutral;
  const intentCfg  = INTENT_CONFIG[msg.analysis?.intent] || INTENT_CONFIG.other;

  return (
    <div className={`msg-bubble-wrap ${isUser ? 'user' : 'assistant'}`}>
      <div className={`msg-bubble ${isUser ? 'user' : 'assistant'}`}>

        {/* User message analysis chips */}
        {isUser && msg.analysis && (
          <div className="msg-analysis-chips">
            <span className="chip intent-chip" style={{ color: intentCfg.color }}>
              {intentCfg.icon} {intentCfg.label}
            </span>
            <span className="chip emotion-chip" style={{ color: emotionCfg.color }}>
              {emotionCfg.icon} {emotionCfg.label}
              {msg.analysis.emotion?.intensity > 1 &&
                ` ${msg.analysis.emotion.intensity}/10`}
            </span>
            <RiskBadge score={msg.analysis.risk_score} />
          </div>
        )}

        {/* Message text */}
        <p className="msg-text">{msg.content}</p>

        {/* Source badge for voice */}
        {msg.source === 'voice' && (
          <span className="msg-source">🎙️ Voice</span>
        )}

        {/* Action items from assistant */}
        {!isUser && msg.action_items?.length > 0 && (
          <ul className="msg-action-items">
            {msg.action_items.map((item, i) => (
              <li key={i}>→ {item}</li>
            ))}
          </ul>
        )}

        {/* Suggested helplines */}
        {isUser && msg.analysis?.suggested_helplines?.length > 0 && (
          <div className="msg-helplines">
            {msg.analysis.suggested_helplines.map(num => (
              <a key={num} href={`tel:${num}`} className="helpline-pill">
                📞 {num}
              </a>
            ))}
          </div>
        )}

        {/* Abuse warning */}
        {isUser && msg.analysis?.is_abuse_or_harassment && (
          <div className="abuse-warning">
            ⚠️ Harassment/abuse detected — your safety matters
          </div>
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
  const [messages,     setMessages]     = useState([]);
  const [inputText,    setInputText]    = useState('');
  const [loading,      setLoading]      = useState(false);
  const [inputMode,    setInputMode]    = useState('text'); // text | voice
  const [autoSOSBanner,setAutoSOSBanner]= useState(null);
  const [error,        setError]        = useState('');

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Handle SOS keyword from voice ──
  const handleSOSKeyword = useCallback((keyword, fullTranscript) => {
    // Auto-submit voice transcript as SOS
    sendMessage(fullTranscript, 'voice');
  }, []);

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
    onSOSKeyword: handleSOSKeyword,
    continuous: false,
  });

  // ── Send message ──
  const sendMessage = useCallback(async (textOverride, source = 'text') => {
    const text = (textOverride || inputText).trim();
    if (!text || loading) return;

    setInputText('');
    clearTranscript();
    setError('');
    setLoading(true);

    // Optimistically add user message
    const userMsg = {
      id: Date.now() + '-user',
      role: 'user',
      content: text,
      source,
      timestamp: new Date(),
      analysis: null,
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await aiAPI.chat(text, source, userLanguage);

      if (res.success) {
        const d = res.data;

        // Update user message with analysis
        setMessages(prev => prev.map(m =>
          m.id === userMsg.id
            ? { ...m, analysis: d.analysis }
            : m
        ));

        // Add assistant message
        setMessages(prev => [...prev, {
          id: Date.now() + '-ai',
          role: 'assistant',
          content: d.response,
          action_items: d.action_items,
          tone: d.tone,
          timestamp: new Date(),
        }]);

        // Auto-SOS banner
        if (d.auto_sos_triggered) {
          setAutoSOSBanner(d.auto_incident_id);
          onEmergencyDetected?.(d);
        }
      }
    } catch (err) {
      setError('Failed to send message. Check your connection.');
      // Remove optimistic user message
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, userLanguage, clearTranscript, onEmergencyDetected]);

  // ── Voice button toggle ──
  const handleVoiceToggle = useCallback(async () => {
    if (isListening) {
      stopListening();
      // Submit whatever was captured
      if (transcript.trim()) sendMessage(transcript, 'voice');
    } else {
      clearTranscript();
      setInputMode('voice');
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

  return (
    <div className="ai-chat-container">

      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-ai-avatar">🤖</span>
          <div>
            <h3 className="chat-title">Safety Assistant</h3>
            <p className="chat-subtitle">AI-powered · {supported ? 'Voice ready' : 'Text only'}</p>
          </div>
        </div>
        <div className="chat-header-right">
          <button
            className="chat-clear-btn"
            onClick={() => { setMessages([]); aiAPI.clearContext(); }}
            title="Clear conversation"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Auto-SOS banner */}
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
            <p className="empty-sub">
              You can type or speak — in any Indian language.
            </p>
            <div className="example-prompts">
              {['Someone is following me', 'I need police help', 'मुझे मदद चाहिए', 'Udhavi thevai'].map(p => (
                <button
                  key={p}
                  className="example-prompt-btn"
                  onClick={() => sendMessage(p, 'text')}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {loading && (
          <div className="chat-typing">
            <span /><span /><span />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice listening overlay */}
      {isListening && (
        <div className="voice-listening-bar">
          <div className="voice-waves">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="voice-wave" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <span className="voice-interim">{interimText || 'Listening...'}</span>
          <button className="voice-cancel" onClick={stopListening}>✕</button>
        </div>
      )}

      {/* Error */}
      {(error || voiceError) && (
        <div className="chat-error">{error || voiceError}</div>
      )}

      {/* Input area */}
      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? 'Listening...'
              : 'Type or speak your message... (any Indian language)'
          }
          rows={1}
          disabled={loading || isListening}
        />

        <div className="chat-input-actions">
          {/* Voice button */}
          {supported && (
            <button
              className={`voice-btn ${isListening ? 'active' : ''} ${permission === 'denied' ? 'denied' : ''}`}
              onClick={handleVoiceToggle}
              disabled={permission === 'denied'}
              title={
                permission === 'denied' ? 'Mic permission denied' :
                isListening ? 'Stop listening' : 'Start voice input'
              }
            >
              {isListening ? '⏹️' : '🎙️'}
            </button>
          )}

          {/* Send button */}
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