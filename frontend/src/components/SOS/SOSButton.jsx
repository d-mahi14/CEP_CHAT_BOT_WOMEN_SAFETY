// =====================================================
// SOSButton Component — FIXED
// =====================================================
// FIX: handleResolve() used activeIncident.incident_id
//      but sosAPI.getActive() returns the full row whose
//      PK field is named `id` (not `incident_id`).
//
//      `incident_id` IS returned by sosAPI.trigger(), so
//      we now normalise to a single `incidentId` state var
//      that is set correctly from both paths.
// =====================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sosAPI, getCurrentLocation, watchLocation, stopWatchingLocation } from '../../services/sosService';

const HOLD_DURATION = 3000; // 3 seconds

const SOSButton = ({ onSOSTriggered, onSOSResolved }) => {
  const [phase,         setPhase]         = useState('idle'); // idle|holding|active|resolving
  const [activeIncident,setActiveIncident]= useState(null);
  // FIX: separate clean ID state so resolve always has the right value
  const [incidentId,    setIncidentId]    = useState(null);
  const [holdProgress,  setHoldProgress]  = useState(0);
  const [location,      setLocation]      = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [timer,         setTimer]         = useState(0);
  const [errorMsg,      setErrorMsg]      = useState('');

  const holdIntervalRef          = useRef(null);
  const timerIntervalRef         = useRef(null);
  const locationWatchRef         = useRef(null);
  const holdStartRef             = useRef(null);

  // ── Restore active incident on mount ──────────
  useEffect(() => {
    sosAPI.getActive().then(res => {
      const inc = res?.data?.active_incident;
      if (inc) {
        setActiveIncident(inc);
        setIncidentId(inc.id);           // FIX: field is `id` here
        setPhase('active');
        const sec = Math.floor((Date.now() - new Date(inc.created_at)) / 1000);
        setTimer(sec);
      }
    }).catch(() => {});
  }, []);

  // ── Timer while active ─────────────────────────
  useEffect(() => {
    if (phase === 'active') {
      timerIntervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerIntervalRef.current);
      if (phase === 'idle') setTimer(0);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [phase]);

  // ── Cleanup on unmount ─────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(holdIntervalRef.current);
      clearInterval(timerIntervalRef.current);
      stopWatchingLocation(locationWatchRef.current);
    };
  }, []);

  // ── GPS helper ─────────────────────────────────
  const fetchLocation = useCallback(async () => {
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      setLocationError(null);
      return loc;
    } catch {
      setLocationError('Location unavailable');
      return null;
    }
  }, []);

  // ── Start continuous GPS push ──────────────────
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

  // ── Hold start ─────────────────────────────────
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

  // ── Hold cancel ────────────────────────────────
  const handleHoldEnd = useCallback(() => {
    if (phase !== 'holding') return;
    clearInterval(holdIntervalRef.current);
    setPhase('idle');
    setHoldProgress(0);
  }, [phase]);

  // ── Trigger SOS ────────────────────────────────
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
        // FIX: trigger response uses `incident_id` — normalise to incidentId state
        const id = data.incident_id;
        setIncidentId(id);
        startLocationTracking(id);
        onSOSTriggered?.(data);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
      }
    } catch (err) {
      console.error('SOS trigger failed:', err);
      setErrorMsg('Failed to trigger SOS. Check your connection.');
      setPhase('idle');
    }
  }, [fetchLocation, startLocationTracking, onSOSTriggered]);

  // ── Resolve SOS ────────────────────────────────
  const handleResolve = useCallback(async (action) => {
    // FIX: use dedicated incidentId state instead of activeIncident.incident_id
    if (!incidentId) return;
    setPhase('resolving');

    try {
      stopWatchingLocation(locationWatchRef.current);
      await sosAPI.resolve(incidentId, action);  // FIX: was activeIncident.incident_id
      setActiveIncident(null);
      setIncidentId(null);
      setPhase('idle');
      setTimer(0);
      onSOSResolved?.({ action });
    } catch (err) {
      console.error('Resolve error:', err);
      setPhase('active');
      setErrorMsg('Could not resolve SOS. Try again.');
    }
  }, [incidentId, onSOSResolved]);

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ══ Active SOS screen ══════════════════════════
  if (phase === 'active' || phase === 'resolving') {
    const riskScore = activeIncident?.risk_score || 5;
    const isPanic   = activeIncident?.panic_mode;

    return (
      <div className={`sos-active-screen ${isPanic ? 'panic' : ''}`}>
        <div className="sos-pulse-ring" />
        <div className="sos-pulse-ring delay1" />

        <div className="sos-active-content">
          <div className="sos-active-icon">🆘</div>
          <h2 className="sos-active-title">
            {isPanic ? '🚨 PANIC MODE ACTIVE' : 'SOS ACTIVE'}
          </h2>

          <div className="sos-timer">{formatTime(timer)}</div>

          <div className="sos-risk-badge" data-score={riskScore}>
            Risk Level: {riskScore}/10{riskScore >= 8 && ' — CRITICAL'}
          </div>

          {activeIncident?.emergency_type && (
            <div className="sos-type-badge">
              {activeIncident.emergency_type.toUpperCase()}
            </div>
          )}

          {location && (
            <p className="sos-location-status">
              📍 Location sharing active
              {location.accuracy && ` (±${Math.round(location.accuracy)}m)`}
            </p>
          )}
          {locationError && <p className="sos-location-error">⚠️ {locationError}</p>}

          <p className="sos-contacts-note">
            {activeIncident?.contacts_notified
              ? '✅ Emergency contacts notified'
              : '📤 Notifying emergency contacts...'}
          </p>

          {errorMsg && <p className="sos-error">{errorMsg}</p>}

          <div className="sos-resolve-actions">
            <button
              className="btn-resolve safe"
              onClick={() => handleResolve('resolved')}
              disabled={phase === 'resolving'}
            >
              ✅ I'm Safe
            </button>
            <button
              className="btn-resolve false-alarm"
              onClick={() => handleResolve('false_alarm')}
              disabled={phase === 'resolving'}
            >
              ❌ False Alarm
            </button>
          </div>

          {phase === 'resolving' && <p className="sos-resolving">Closing SOS...</p>}
        </div>
      </div>
    );
  }

  // ══ Idle / Holding button ══════════════════════
  const holdPct = holdProgress;
  return (
    <div className="sos-button-wrapper">
      <p className="sos-instruction">
        {phase === 'holding'
          ? 'Keep holding to confirm...'
          : 'Hold 3 seconds to trigger emergency SOS'}
      </p>

      <div
        className={`sos-button ${phase === 'holding' ? 'holding' : ''}`}
        onMouseDown={handleHoldStart}
        onMouseUp={handleHoldEnd}
        onMouseLeave={handleHoldEnd}
        onTouchStart={handleHoldStart}
        onTouchEnd={handleHoldEnd}
        role="button"
        aria-label="Emergency SOS button — hold 3 seconds"
      >
        <svg className="sos-progress-ring" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" className="sos-ring-bg" />
          <circle
            cx="60" cy="60" r="54"
            className="sos-ring-fill"
            strokeDasharray={`${2 * Math.PI * 54}`}
            strokeDashoffset={`${2 * Math.PI * 54 * (1 - holdPct / 100)}`}
          />
        </svg>
        <div className="sos-button-inner">
          <span className="sos-label">SOS</span>
        </div>
      </div>

      {errorMsg && <p className="sos-error">{errorMsg}</p>}

      <button className="sos-panic-btn" onClick={() => triggerSOS('panic')}>
        🚨 Instant Panic Alert
      </button>
    </div>
  );
};

export default SOSButton;