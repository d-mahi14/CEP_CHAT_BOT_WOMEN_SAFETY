// =====================================================
// LanguageContext.jsx — with useT() translation hook
// =====================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import translations from '../utils/translations';

const LanguageContext = createContext({
  languageCode: 'en',
  languageName: 'English',
  setLanguage: () => {},
  t: (key) => key,
});

export const LANGUAGE_LABELS = {
  en: { name: 'English',   native: 'English',   dir: 'ltr' },
  hi: { name: 'Hindi',     native: 'हिंदी',      dir: 'ltr' },
  ta: { name: 'Tamil',     native: 'தமிழ்',      dir: 'ltr' },
  te: { name: 'Telugu',    native: 'తెలుగు',     dir: 'ltr' },
  mr: { name: 'Marathi',   native: 'मराठी',      dir: 'ltr' },
  bn: { name: 'Bengali',   native: 'বাংলা',      dir: 'ltr' },
  gu: { name: 'Gujarati',  native: 'ગુજરાતી',    dir: 'ltr' },
  kn: { name: 'Kannada',   native: 'ಕನ್ನಡ',      dir: 'ltr' },
  ml: { name: 'Malayalam', native: 'മലയാളം',     dir: 'ltr' },
  pa: { name: 'Punjabi',   native: 'ਪੰਜਾਬੀ',    dir: 'ltr' },
};

export const LanguageProvider = ({ children }) => {
  const stored = localStorage.getItem('app_language_code') || 'en';
  const [languageCode, setLanguageCode] = useState(
    LANGUAGE_LABELS[stored] ? stored : 'en'
  );
  const [languageName, setLanguageName] = useState(
    LANGUAGE_LABELS[stored]?.name || 'English'
  );

  const t = useCallback((key) => {
    return (
      translations[languageCode]?.[key] ||
      translations.en?.[key] ||
      key
    );
  }, [languageCode]);

  const setLanguage = useCallback((code, name) => {
    const info = LANGUAGE_LABELS[code];
    if (!info) return;
    const resolvedName = name || info.name;
    setLanguageCode(code);
    setLanguageName(resolvedName);
    localStorage.setItem('app_language_code', code);
    localStorage.setItem('app_language_name', resolvedName);
    document.documentElement.lang = code;
    document.documentElement.dir  = info.dir || 'ltr';
  }, []);

  useEffect(() => {
    document.documentElement.lang = languageCode;
    document.documentElement.dir  = LANGUAGE_LABELS[languageCode]?.dir || 'ltr';
  }, []);

  return (
    <LanguageContext.Provider value={{ languageCode, languageName, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

export default LanguageContext;