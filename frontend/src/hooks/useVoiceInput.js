// =====================================================
// useVoiceInput — Custom React Hook
// Module 6: Voice Input (Web Speech API)
// =====================================================
// FIX: InvalidStateError "recognition has already started"
//   Root cause: startListening() called buildRecognition()
//   only if recognitionRef.current was null, but after a
//   stop() the ref still held the old instance. Calling
//   .start() on it again after it had already ended threw
//   InvalidStateError. Additionally React StrictMode mounts
//   components twice, leaving a stale recognition instance.
//
//   Fix:
//   1. Track a `isStarted` ref so we never call .start()
//      twice on the same instance.
//   2. Always create a FRESH SpeechRecognition instance on
//      each startListening() call (don't reuse old ones).
//   3. Wrap .start() in try/catch with graceful recovery.
//   4. On stopListening(), abort (not stop) so onend fires
//      immediately and we can safely restart.
// =====================================================

import { useState, useEffect, useRef, useCallback } from 'react';

const SOS_KEYWORDS = [
  'help', 'sos', 'emergency', 'danger', 'save me', 'call police',
  'help me', 'i need help', 'please help',
  'bachao', 'madad', 'khatra', 'help karo', 'police bulao',
  'mujhe bachao', 'madad karo', 'khatra hai',
  'udhavi', 'aapaththu', 'kaapaadunga',
  'sahaayam', 'praanam', 'kapaadu',
  'mala vachva', 'madad kara',
  'bachao', 'sahajjo', 'bipod',
];

const LANG_TO_BCP47 = {
  en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN',
  mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', kn: 'kn-IN',
  ml: 'ml-IN', pa: 'pa-IN',
};

export function useVoiceInput({
  language = 'en',
  onTranscript,
  onSOSKeyword,
  onError,
  continuous = false,
} = {}) {
  const [isListening,  setIsListening]  = useState(false);
  const [transcript,   setTranscript]   = useState('');
  const [interimText,  setInterimText]  = useState('');
  const [permission,   setPermission]   = useState('unknown');
  const [supported,    setSupported]    = useState(true);
  const [error,        setError]        = useState('');

  // FIX: always keep a ref to the CURRENT instance; never reuse after stop
  const recognitionRef = useRef(null);
  // FIX: guard flag — true while recognition is running
  const isActiveRef    = useRef(false);
  const sosDetectedRef = useRef(false);

  const detectSOS = useCallback((text) => {
    const lower = text.toLowerCase();
    const hit = SOS_KEYWORDS.find(kw => lower.includes(kw));
    if (hit && !sosDetectedRef.current) {
      sosDetectedRef.current = true;
      onSOSKeyword?.(hit, text);
    }
  }, [onSOSKeyword]);

  // FIX: always create a fresh instance — never reuse a stopped one
  const createRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return null; }

    const rec = new SR();
    rec.lang           = LANG_TO_BCP47[language] || 'en-IN';
    rec.continuous     = continuous;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      isActiveRef.current = true;
      setIsListening(true);
      setError('');
      sosDetectedRef.current = false;
    };

    rec.onresult = (event) => {
      let interimConcat = '';
      let finalConcat   = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const { transcript: t } = event.results[i][0];
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
      // FIX: 'aborted' fires when we call .abort() ourselves — not a real error
      if (event.error === 'aborted') return;

      const msgs = {
        'not-allowed':   'Microphone permission denied. Please allow access.',
        'no-speech':     'No speech detected. Try again.',
        'network':       'Network error. Check your connection.',
        'audio-capture': 'No microphone found.',
      };
      const msg = msgs[event.error] || `Speech error: ${event.error}`;
      if (event.error === 'not-allowed') setPermission('denied');
      setError(msg);
      onError?.(msg);
      isActiveRef.current = false;
      setIsListening(false);
      setInterimText('');
    };

    rec.onend = () => {
      // FIX: clear the active flag so a fresh .start() can be called next time
      isActiveRef.current = false;
      setIsListening(false);
      setInterimText('');
    };

    return rec;
  }, [language, continuous, detectSOS, onTranscript, onError]);

  const startListening = useCallback(async () => {
    // FIX: if already active, stop first and wait for onend before restarting
    if (isActiveRef.current && recognitionRef.current) {
      recognitionRef.current.abort();
      // Wait a tick for onend to fire
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Request mic permission
    try {
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

    // FIX: always create a fresh instance
    const rec = createRecognition();
    if (!rec) return;
    recognitionRef.current = rec;

    try {
      rec.start();
    } catch (e) {
      // Shouldn't happen since we always create fresh, but guard anyway
      console.warn('SpeechRecognition.start() error:', e.message);
      setError('Could not start voice recognition. Please try again.');
    }
  }, [createRecognition]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      // FIX: use abort() instead of stop() — abort fires onend synchronously
      // so the isActiveRef guard clears immediately
      try { recognitionRef.current.abort(); } catch (_) {}
    }
    isActiveRef.current = false;
    setIsListening(false);
    setInterimText('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
      }
    };
  }, []);

  // Language change: abort current session so next startListening uses new lang
  useEffect(() => {
    if (recognitionRef.current && isActiveRef.current) {
      try { recognitionRef.current.abort(); } catch (_) {}
    }
    recognitionRef.current = null;
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