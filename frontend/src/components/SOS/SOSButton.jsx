import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sosAPI, getCurrentLocation, watchLocation, stopWatchingLocation } from '../../services/sosService';
import { useLanguage } from '../../context/LanguageContext';

const HOLD_DURATION = 3000;

const SOSButton = ({ onSOSTriggered, onSOSResolved }) => {
  const [phase, setPhase] = useState('idle');
  const [activeIncident, setActiveIncident] = useState(null);
  const [incidentId, setIncidentId] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [timer, setTimer] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const holdIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const locationWatchRef = useRef(null);
  const holdStartRef = useRef(null);

  const { t } = useLanguage();

  useEffect(() => {
    sosAPI.getActive().then(res => {
      const inc = res?.data?.active_incident;
      if (inc) {
        setActiveIncident(inc);
        setIncidentId(inc.id);
        setPhase('active');
        const sec = Math.floor((Date.now() - new Date(inc.created_at)) / 1000);
        setTimer(sec);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (phase === 'active') {
      timerIntervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerIntervalRef.current);
      if (phase === 'idle') setTimer(0);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [phase]);

  useEffect(() => {
    return () => {
      clearInterval(holdIntervalRef.current);
      clearInterval(timerIntervalRef.current);
      stopWatchingLocation(locationWatchRef.current);
    };
  }, []);

  const fetchLocation = useCallback(async () => {
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      setLocationError(null);
      return loc;
    } catch {
      setLocationError(t('sos_location_error'));
      return null;
    }
  }, [t]);

  const startLocationTracking = useCallback((id) => {
    locationWatchRef.current = watchLocation(
      async (loc) => {
        setLocation(loc);
        try { await sosAPI.updateLocation(id, loc); }
        catch (e) { console.error('Location push error:', e); }
      },
      (err) => setLocationError('GPS error: ' + err.message)
    );
  }, []);

  const handleHoldStart = useCallback((e) => {
    if (phase !== 'idle') return;
    e.preventDefault();
    holdStartRef.current = Date.now();
    setPhase('holding');
    setHoldProgress(0);

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setHoldProgress(progress);
      if (elapsed >= HOLD_DURATION) {
        clearInterval(holdIntervalRef.current);
        triggerSOS('manual');
      }
    }, 50);
  }, [phase]);

  const handleHoldEnd = useCallback(() => {
    if (phase !== 'holding') return;
    clearInterval(holdIntervalRef.current);
    setPhase('idle');
    setHoldProgress(0);
  }, [phase]);

  const triggerSOS = useCallback(async (triggerType = 'manual') => {
    setPhase('active');
    setErrorMsg('');

    try {
      const loc = await fetchLocation();
      const payload = {
        trigger_type: triggerType,
        description: '',
        ...(loc || {}),
        address: null,
      };

      const res = await sosAPI.trigger(payload);

      if (res.success) {
        const data = res.data;
        setActiveIncident(data);
        const id = data.incident_id;
        setIncidentId(id);
        startLocationTracking(id);
        onSOSTriggered?.(data);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
      }
    } catch (err) {
      console.error('SOS trigger failed:', err);
      setErrorMsg(t('sos_error_trigger'));
      setPhase('idle');
    }
  }, [fetchLocation, startLocationTracking, onSOSTriggered, t]);

  const handleResolve = useCallback(async (action) => {
    if (!incidentId) return;
    setPhase('resolving');

    try {
      stopWatchingLocation(locationWatchRef.current);
      await sosAPI.resolve(incidentId, action);
      setActiveIncident(null);
      setIncidentId(null);
      setPhase('idle');
      setTimer(0);
      onSOSResolved?.({ action });
    } catch (err) {
      console.error('Resolve error:', err);
      setPhase('active');
      setErrorMsg(t('sos_error_resolve'));
    }
  }, [incidentId, onSOSResolved, t]);

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (phase === 'active' || phase === 'resolving') {
    const riskScore = activeIncident?.risk_score || 5;
    const isPanic = activeIncident?.panic_mode;

    return (
      <div className={`sos-active-screen ${isPanic ? 'panic' : ''}`}>
        <div className="sos-pulse-ring" />
        <div className="sos-pulse-ring delay1" />

        <div className="sos-active-content">
          <div className="sos-active-icon">🆘</div>

          <h2 className="sos-active-title">
            {isPanic ? `🚨 ${t('sos_panic_title')}` : t('sos_active_title')}
          </h2>

          <div className="sos-timer">{formatTime(timer)}</div>

          <div className="sos-risk-badge">
            {t('risk_level')}: {riskScore}/10
            {riskScore >= 8 && ` — ${t('critical')}`}
          </div>

          {location && (
            <p className="sos-location-status">
              📍 {t('sos_location')}
              {location.accuracy && ` (±${Math.round(location.accuracy)}m)`}
            </p>
          )}

          {locationError && (
            <p className="sos-location-error">⚠️ {locationError}</p>
          )}

          <p className="sos-contacts-note">
            {activeIncident?.contacts_notified
              ? `✅ ${t('sos_notified')}`
              : `📤 ${t('sos_notifying')}`}
          </p>

          {errorMsg && <p className="sos-error">{errorMsg}</p>}

          <div className="sos-resolve-actions">
            <button
              className="btn-resolve safe"
              onClick={() => handleResolve('resolved')}
              disabled={phase === 'resolving'}
            >
              ✅ {t('sos_safe')}
            </button>

            <button
              className="btn-resolve false-alarm"
              onClick={() => handleResolve('false_alarm')}
              disabled={phase === 'resolving'}
            >
              ❌ {t('sos_false')}
            </button>
          </div>

          {phase === 'resolving' && (
            <p className="sos-resolving">{t('sos_closing')}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="sos-button-wrapper">
      <p className="sos-instruction">
        {phase === 'holding' ? t('sos_holding') : t('sos_hold')}
      </p>

      <div
        className={`sos-button ${phase === 'holding' ? 'holding' : ''}`}
        onMouseDown={handleHoldStart}
        onMouseUp={handleHoldEnd}
        onMouseLeave={handleHoldEnd}
        onTouchStart={handleHoldStart}
        onTouchEnd={handleHoldEnd}
      >
        <div className="sos-button-inner">
          <span className="sos-label">SOS</span>
        </div>
      </div>

      {errorMsg && <p className="sos-error">{errorMsg}</p>}

      <button className="sos-panic-btn" onClick={() => triggerSOS('panic')}>
        🚨 {t('sos_panic')}
      </button>
    </div>
  );
};

export default SOSButton;
