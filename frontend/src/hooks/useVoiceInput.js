// =====================================================
// useVoiceInput — Custom React Hook
// Module 6: Voice Input (Web Speech API)
// =====================================================
// Features:
//  - Continuous listening with interim results
//  - SOS keyword detection ("help", "SOS", "bachao", etc.)
//  - Language-aware recognition
//  - Permission state management
// =====================================================

import { useState, useEffect, useRef, useCallback } from 'react';

// SOS trigger keywords across all supported languages
const SOS_KEYWORDS = [
  // English
  'help', 'sos', 'emergency', 'danger', 'save me', 'call police',
  'help me', 'i need help', 'please help',
  // Hindi
  'bachao', 'madad', 'khatra', 'help karo', 'police bulao',
  'mujhe bachao', 'madad karo', 'khatra hai',
  // Tamil
  'udhavi', 'aapaththu', 'kaapaadunga',
  // Telugu
  'sahaayam', 'praanam', 'kapaadu',
  // Marathi
  'mala vachva', 'madad kara',
  // Bengali
  'bachao', 'sahajjo', 'bipod',
];

const LANG_TO_BCP47 = {
  en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN',
  mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', kn: 'kn-IN',
  ml: 'ml-IN', pa: 'pa-IN',
};

export function useVoiceInput({
  language = 'en',
  onTranscript,       // (text: string, isFinal: boolean) => void
  onSOSKeyword,       // (keyword: string, transcript: string) => void
  onError,
  continuous = false, // true = keep listening; false = one utterance
} = {}) {
  const [isListening,   setIsListening]   = useState(false);
  const [transcript,    setTranscript]    = useState('');
  const [interimText,   setInterimText]   = useState('');
  const [permission,    setPermission]    = useState('unknown'); // unknown|granted|denied
  const [supported,     setSupported]     = useState(true);
  const [error,         setError]         = useState('');

  const recognitionRef = useRef(null);
  const sosDetectedRef = useRef(false);

  // ── Detect SOS keyword in transcript ──
  const detectSOS = useCallback((text) => {
    const lower = text.toLowerCase();
    const hit = SOS_KEYWORDS.find(kw => lower.includes(kw));
    if (hit && !sosDetectedRef.current) {
      sosDetectedRef.current = true;
      onSOSKeyword?.(hit, text);
    }
  }, [onSOSKeyword]);

  // ── Initialize recognition ──
  const buildRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return null;
    }

    const rec = new SpeechRecognition();
    rec.lang          = LANG_TO_BCP47[language] || 'en-IN';
    rec.continuous    = continuous;
    rec.interimResults= true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setIsListening(true);
      setError('');
      sosDetectedRef.current = false;
    };

    rec.onresult = (event) => {
      let interimConcat = '';
      let finalConcat   = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const { transcript: t, confidence } = event.results[i][0];
        if (event.results[i].isFinal) {
          finalConcat += t + ' ';
          detectSOS(finalConcat);
          onTranscript?.(t.trim(), true);
        } else {
          interimConcat += t;
        }
      }

      if (finalConcat)   setTranscript(prev => (prev + ' ' + finalConcat).trim());
      if (interimConcat) setInterimText(interimConcat);
    };

    rec.onspeechend = () => {
      setInterimText('');
    };

    rec.onerror = (event) => {
      const msgs = {
        'not-allowed':       'Microphone permission denied. Please allow access.',
        'no-speech':         'No speech detected. Try again.',
        'network':           'Network error. Check your connection.',
        'audio-capture':     'No microphone found.',
        'aborted':           '',
      };
      const msg = msgs[event.error] || `Speech error: ${event.error}`;
      if (event.error === 'not-allowed') setPermission('denied');
      if (msg) { setError(msg); onError?.(msg); }
      setIsListening(false);
      setInterimText('');
    };

    rec.onend = () => {
      setIsListening(false);
      setInterimText('');
    };

    return rec;
  }, [language, continuous, detectSOS, onTranscript, onError]);

  // ── Start listening ──
  const startListening = useCallback(async () => {
    try {
      // Request mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermission('granted');
    } catch {
      setPermission('denied');
      setError('Microphone permission denied.');
      return;
    }

    sosDetectedRef.current = false;
    setTranscript('');
    setInterimText('');
    setError('');

    if (!recognitionRef.current) {
      recognitionRef.current = buildRecognition();
    }
    if (!recognitionRef.current) return;

    // Re-set language in case it changed
    recognitionRef.current.lang = LANG_TO_BCP47[language] || 'en-IN';

    try {
      recognitionRef.current.start();
    } catch (e) {
      // Already started — stop and restart
      recognitionRef.current.stop();
      setTimeout(() => recognitionRef.current?.start(), 300);
    }
  }, [buildRecognition, language]);

  // ── Stop listening ──
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText('');
  }, []);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // ── Language change: rebuild recognition ──
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, [language]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimText('');
    sosDetectedRef.current = false;
  }, []);

  return {
    isListening,
    transcript,
    interimText,
    permission,
    supported,
    error,
    startListening,
    stopListening,
    clearTranscript,
  };
}