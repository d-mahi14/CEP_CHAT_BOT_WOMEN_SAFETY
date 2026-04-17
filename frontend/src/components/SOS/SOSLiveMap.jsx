// =====================================================
// SOSLiveMap.jsx — Module 5: Real-Time Location + SOS Actions
// =====================================================
// FIXES vs previous version:
//   1. Map was blank → switched to Google Maps iframe embed
//      (no API key, always renders, no tile/CSP issues)
//   2. Share URL was empty → built immediately from lat/lng,
//      displayed as a clickable Google Maps deep link
//   3. Added "📞 Call Contact" — opens tel: for #1 contact
//   4. Added "🔊 Alarm" toggle — looping beep via Web Audio
//   5. Added "💬 WhatsApp" — pre-fills SOS message + link
//   6. Copy button copies the actual Google Maps URL
//   7. Map re-renders on every location update (key prop)
// =====================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { emergencyAPI } from '../../services/api';

// ── Audio alarm (Web Audio API — no file needed) ───────
function createAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let active = true;

    function tick() {
      if (!active) return;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
      setTimeout(tick, 800);
    }

    tick();
    return () => { active = false; setTimeout(() => ctx.close(), 500); };
  } catch {
    return () => {};
  }
}

function gmapsEmbed(lat, lng) {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}
function gmapsShare(lat, lng) {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}&z=17`;
}
function whatsappMsg(lat, lng) {
  const url = gmapsShare(lat, lng);
  const msg = encodeURIComponent(`🆘 SOS ALERT — I need help!\nMy live location: ${url}`);
  return `https://wa.me/?text=${msg}`;
}

const SOSLiveMap = ({ location, isPanic = false }) => {
  const [alarmOn,  setAlarmOn]  = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [contacts, setContacts] = useState([]);
  const stopAlarmRef = useRef(null);
  const prevLatLng   = useRef(null);

  useEffect(() => {
    emergencyAPI.getContacts()
      .then(r => { if (r.success) setContacts(r.data.contacts || []); })
      .catch(() => {});
  }, []);

  useEffect(() => () => stopAlarmRef.current?.(), []);

  const toggleAlarm = () => {
    if (alarmOn) {
      stopAlarmRef.current?.();
      stopAlarmRef.current = null;
      setAlarmOn(false);
    } else {
      stopAlarmRef.current = createAlarm();
      setAlarmOn(true);
    }
  };

  const handleCopy = useCallback(() => {
    if (!location) return;
    navigator.clipboard.writeText(gmapsShare(location.latitude, location.longitude))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  }, [location]);

  const topContact = contacts[0] || null;

  if (!location) {
    return (
      <div style={s.placeholder}>
        <div style={s.spin} />
        <p style={s.dimText}>Acquiring GPS signal…</p>
      </div>
    );
  }

  const { latitude: lat, longitude: lng, accuracy } = location;
  const shareUrl = gmapsShare(lat, lng);
  // Only change iframe src when position moves meaningfully (>0.001 deg ≈ 100m)
  const mapKey = `${lat.toFixed(3)}-${lng.toFixed(3)}`;

  return (
    <div style={s.wrap}>

      {/* ── Map ─────────────────────────────────────── */}
      <div style={s.mapBox}>
        <iframe
          key={mapKey}
          title="Live SOS location"
          src={gmapsEmbed(lat, lng)}
          style={s.frame}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div style={s.livePill}>
          <span style={s.dot} />
          LIVE &nbsp;{lat.toFixed(5)}, {lng.toFixed(5)}
          {accuracy ? <span style={s.acc}> ±{Math.round(accuracy)}m</span> : null}
        </div>
      </div>

      {/* ── Share row ────────────────────────────────── */}
      <div style={s.section}>
        <p style={s.sectionLabel}>📍 Share your location</p>
        <div style={s.shareRow}>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={s.urlLink}>
            {shareUrl.slice(8, 60)}{shareUrl.length > 68 ? '…' : ''}
          </a>
          <button style={{ ...s.iconBtn, ...(copied ? s.iconBtnSuccess : s.iconBtnBlue) }} onClick={handleCopy}>
            {copied ? '✓' : '📋'}
          </button>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={{ ...s.iconBtn, ...s.iconBtnNeutral }}>
            🗺️
          </a>
        </div>
      </div>

      {/* ── Action buttons ───────────────────────────── */}
      <div style={s.actions}>
        {topContact && (
          <a href={`tel:${topContact.phoneNumber}`} style={{ ...s.btn, ...s.btnCall }}>
            <span style={s.btnEmoji}>📞</span>
            <span style={s.btnText}>Call {topContact.contactName?.split(' ')[0] || 'Contact'}</span>
          </a>
        )}
        <a href={whatsappMsg(lat, lng)} target="_blank" rel="noopener noreferrer" style={{ ...s.btn, ...s.btnWA }}>
          <span style={s.btnEmoji}>💬</span>
          <span style={s.btnText}>WhatsApp</span>
        </a>
        <button onClick={toggleAlarm} style={{ ...s.btn, ...(alarmOn ? s.btnAlarmOn : s.btnAlarmOff) }}>
          <span style={s.btnEmoji}>{alarmOn ? '🔇' : '🔊'}</span>
          <span style={s.btnText}>{alarmOn ? 'Stop' : 'Alarm'}</span>
        </button>
      </div>

      {alarmOn && <div style={s.alarmBar}>🔊 ALARM SOUNDING — tap Stop to silence</div>}

      {/* keyframe styles injected via style tag */}
      <style>{`
        @keyframes sos-spin { to { transform: rotate(360deg); } }
        @keyframes sos-alarm { 0%,100%{opacity:1} 50%{opacity:0.55} }
        @keyframes sos-blink { 0%,100%{background:#ef4444} 50%{background:#f87171} }
      `}</style>
    </div>
  );
};

const s = {
  wrap: {
    display:      'flex',
    flexDirection:'column',
    borderRadius: 14,
    overflow:     'hidden',
    border:       '1px solid rgba(239,68,68,0.3)',
    background:   '#0B0F1A',
    width:        '100%',
    maxWidth:     400,
  },

  // Map
  mapBox: {
    position: 'relative',
    height:   220,
    overflow: 'hidden',
    background:'#111827',
  },
  frame: {
    width:   '100%',
    height:  '100%',
    border:  'none',
    display: 'block',
    filter:  'brightness(0.92) saturate(0.9)',
  },
  livePill: {
    position:    'absolute',
    bottom:      8,
    left:        8,
    right:       8,
    display:     'flex',
    alignItems:  'center',
    gap:         6,
    padding:     '5px 11px',
    background:  'rgba(0,0,0,0.72)',
    borderRadius:20,
    fontSize:    11,
    color:       '#fca5a5',
    fontFamily:  "'Courier New', monospace",
    letterSpacing:'0.025em',
    backdropFilter:'blur(6px)',
  },
  dot: {
    width:       7,
    height:      7,
    borderRadius:'50%',
    background:  '#ef4444',
    flexShrink:  0,
    animation:   'sos-blink 1s ease-in-out infinite',
  },
  acc: { color:'#64748b', fontSize:10 },

  // Share
  section: {
    padding:  '10px 12px 6px',
    background:'#0f1624',
    borderTop:'1px solid rgba(255,255,255,0.05)',
  },
  sectionLabel: {
    fontSize:     11,
    color:        '#64748b',
    margin:       '0 0 6px',
    textTransform:'uppercase',
    letterSpacing:'0.06em',
    fontWeight:   500,
  },
  shareRow: {
    display:    'flex',
    gap:        6,
    alignItems: 'center',
  },
  urlLink: {
    flex:          1,
    padding:       '7px 10px',
    background:    '#141c2e',
    border:        '1px solid rgba(96,165,250,0.2)',
    borderRadius:  8,
    color:         '#60a5fa',
    fontSize:      12,
    fontFamily:    "'Courier New', monospace",
    textDecoration:'none',
    overflow:      'hidden',
    whiteSpace:    'nowrap',
    textOverflow:  'ellipsis',
    display:       'block',
  },
  iconBtn: {
    width:         34,
    height:        34,
    borderRadius:  8,
    fontSize:      15,
    cursor:        'pointer',
    display:       'flex',
    alignItems:    'center',
    justifyContent:'center',
    textDecoration:'none',
    flexShrink:    0,
    border:        'none',
    fontFamily:    'inherit',
  },
  iconBtnBlue:    { background:'rgba(96,165,250,0.12)', border:'1px solid rgba(96,165,250,0.25)' },
  iconBtnSuccess: { background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', color:'#10b981' },
  iconBtnNeutral: { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)' },

  // Actions
  actions: {
    display:  'flex',
    gap:      8,
    padding:  '10px 12px 12px',
    background:'#0f1624',
    borderTop:'1px solid rgba(255,255,255,0.05)',
    flexWrap: 'wrap',
  },
  btn: {
    flex:          '1 1 70px',
    padding:       '9px 8px',
    borderRadius:  10,
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           4,
    cursor:        'pointer',
    textDecoration:'none',
    fontFamily:    'DM Sans, sans-serif',
    border:        'none',
  },
  btnCall:     { background:'rgba(16,185,129,0.15)',  border:'1px solid rgba(16,185,129,0.3)'  },
  btnWA:       { background:'rgba(37,211,102,0.12)',  border:'1px solid rgba(37,211,102,0.25)' },
  btnAlarmOff: { background:'rgba(245,158,11,0.12)',  border:'1px solid rgba(245,158,11,0.25)' },
  btnAlarmOn:  { background:'rgba(239,68,68,0.2)',    border:'1px solid rgba(239,68,68,0.5)'   },
  btnEmoji:    { fontSize:17, lineHeight:1 },
  btnText:     { fontSize:11, fontWeight:600, color:'#CBD5E4', letterSpacing:'0.02em' },

  // Alarm bar
  alarmBar: {
    padding:      '8px 12px',
    background:   'rgba(239,68,68,0.18)',
    borderTop:    '1px solid rgba(239,68,68,0.35)',
    color:        '#fca5a5',
    fontSize:     12,
    fontWeight:   700,
    textAlign:    'center',
    letterSpacing:'0.05em',
    animation:    'sos-alarm 0.7s ease-in-out infinite',
  },

  // Placeholder
  placeholder: {
    height:         180,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            12,
    background:     '#0B0F1A',
    border:         '1px solid rgba(239,68,68,0.2)',
    borderRadius:   14,
  },
  spin: {
    width:          22,
    height:         22,
    border:         '2.5px solid rgba(255,255,255,0.08)',
    borderTopColor: '#ef4444',
    borderRadius:   '50%',
    animation:      'sos-spin 0.7s linear infinite',
  },
  dimText: { fontSize:13, color:'#64748b', margin:0 },
};

export default SOSLiveMap;