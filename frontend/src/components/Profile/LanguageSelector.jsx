import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../../services/supabaseClient';
import { languageAPI } from '../../services/api';
import { SUPPORTED_LANGUAGES } from '../../utils/languages';

const LanguageSelector = ({ currentLanguage, onLanguageChange }) => {
  const [languages, setLanguages] = useState(SUPPORTED_LANGUAGES);
  const [selected, setSelected] = useState(currentLanguage);
  const [loading, setLoading] = useState(false);

  const handleLanguageChange = async (langCode, langName) => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      await languageAPI.updateUserLanguage(user.id, {
        language_code: langCode,
        language_name: langName
      });
      setSelected(langCode);
      if (onLanguageChange) onLanguageChange();
      alert('Language updated successfully!');
    } catch (error) {
      alert('Failed to update language');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="language-selector">
      <h3>Select Your Language</h3>
      <div className="language-grid">
        {languages.map((lang) => (
          <div
            key={lang.code}
            className={`language-card ${selected === lang.code ? 'selected' : ''}`}
            onClick={() => !loading && handleLanguageChange(lang.code, lang.name)}
          >
            <span className="lang-flag">{lang.flag}</span>
            <h4>{lang.nativeName}</h4>
            <p>{lang.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LanguageSelector;