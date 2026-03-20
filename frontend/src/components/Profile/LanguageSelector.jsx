// =====================================================
// LanguageSelector.jsx — REDESIGNED
// Dark fortress theme matching Dashboard
// =====================================================

import React, { useState } from 'react';
import { languageAPI } from '../../services/api';
import { SUPPORTED_LANGUAGES } from '../../utils/languages';

const LanguageSelector = ({ currentLanguage, onLanguageChange }) => {
  const [selected,  setSelected]  = useState(currentLanguage || 'en');
  const [loading,   setLoading]   = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState('');

  const handleSelect = async (code, name) => {
    if (code === selected || loading) return;
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      await languageAPI.updateUserLanguage(null, { language_code: code, language_name: name });
      setSelected(code);
      setSaved(true);
      onLanguageChange?.();
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to update language. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ls-container">
      <div className="ls-header">
        <h3 className="ls-title">Language Preference</h3>
        <p className="ls-subtitle">AI responses will be in your selected language</p>
      </div>

      {saved && (
        <div className="ls-success">✅ Language updated successfully!</div>
      )}
      {error && (
        <div className="ls-error">{error}</div>
      )}

      <div className="ls-grid">
        {SUPPORTED_LANGUAGES.map(lang => (
          <button
            key={lang.code}
            className={`ls-card ${selected === lang.code ? 'selected' : ''} ${loading ? 'loading' : ''}`}
            onClick={() => handleSelect(lang.code, lang.name)}
            disabled={loading}
          >
            <span className="ls-flag">{lang.flag}</span>
            <span className="ls-native">{lang.nativeName}</span>
            <span className="ls-english">{lang.name}</span>
            {selected === lang.code && <span className="ls-check">✓</span>}
          </button>
        ))}
      </div>

      <style>{`
        .ls-container { max-width: 700px; margin: 0 auto; font-family: 'DM Sans', sans-serif; }
        .ls-header { margin-bottom: 20px; }
        .ls-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 1.2rem; color: #fff; margin: 0 0 6px 0; }
        .ls-subtitle { font-size: 0.85rem; color: #64748b; margin: 0; }
        .ls-success { padding: 10px 14px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; color: #10B981; font-size: 0.83rem; margin-bottom: 14px; }
        .ls-error { padding: 10px 14px; background: rgba(230,57,70,0.1); border: 1px solid rgba(230,57,70,0.25); border-radius: 8px; color: #FF6B74; font-size: 0.83rem; margin-bottom: 14px; }
        .ls-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
        .ls-card { position: relative; padding: 18px 12px; background: #131929; border: 1.5px solid rgba(255,255,255,0.07); border-radius: 12px; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 6px; font-family: inherit; }
        .ls-card:hover:not(:disabled) { border-color: rgba(230,57,70,0.4); background: rgba(230,57,70,0.06); transform: translateY(-2px); }
        .ls-card.selected { background: rgba(230,57,70,0.12); border-color: #E63946; }
        .ls-card.loading { opacity: 0.6; cursor: not-allowed; transform: none; }
        .ls-flag { font-size: 2rem; line-height: 1; }
        .ls-native { font-size: 1rem; font-weight: 600; color: #fff; }
        .ls-english { font-size: 0.72rem; color: #64748b; }
        .ls-card.selected .ls-native { color: #FF6B74; }
        .ls-check { position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; background: #E63946; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: white; font-weight: 700; }
      `}</style>
    </div>
  );
};

export default LanguageSelector;