// =====================================================
// ConsentManager.jsx — Module 28: Privacy & Security
// =====================================================
// Lets users manage their consent preferences:
//   - Data Sharing consent
//   - Analytics consent
//   - Marketing consent
// Reads current prefs from user_preferences table via
// GET /api/profile/preferences, then PUTs updates via
// PUT /api/profile/preferences.
// Each toggle change is logged to privacy_consents table
// on the backend automatically.
// =====================================================

import React, { useState, useEffect } from 'react';
import { profileAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    style={{
      width: 48,
      height: 26,
      borderRadius: 13,
      border: 'none',
      background: checked ? '#E63946' : '#1E2740',
      cursor: disabled ? 'not-allowed' : 'pointer',
      position: 'relative',
      transition: 'background 0.25s ease',
      flexShrink: 0,
      outline: 'none',
      boxShadow: checked ? '0 0 8px rgba(230,57,70,0.35)' : 'none',
    }}
  >
    <span style={{
      position: 'absolute',
      top: 3,
      left: checked ? 24 : 3,
      width: 20,
      height: 20,
      background: '#fff',
      borderRadius: '50%',
      transition: 'left 0.25s ease',
      display: 'block',
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    }} />
  </button>
);

const ConsentItem = ({ icon, title, description, checked, onChange, saving, tag }) => (
  <div style={s.item}>
    <div style={s.itemLeft}>
      <div style={s.itemIcon}>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={s.itemText}>
        <div style={s.itemHeader}>
          <span style={s.itemTitle}>{title}</span>
          {tag && <span style={s.itemTag}>{tag}</span>}
        </div>
        <p style={s.itemDesc}>{description}</p>
      </div>
    </div>
    <div style={s.itemRight}>
      {saving ? (
        <span style={s.savingDot} />
      ) : (
        <Toggle checked={checked} onChange={onChange} />
      )}
    </div>
  </div>
);

const ConsentManager = () => {
  const { t } = useLanguage();

  const [prefs,   setPrefs]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState({});
  const [error,   setError]   = useState('');
  const [saved,   setSaved]   = useState('');

  useEffect(() => {
    profileAPI.getPreferences()
      .then(res => {
        if (res.success) setPrefs(res.data.preferences || {});
      })
      .catch(() => setError('Failed to load preferences.'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (field, value) => {
    setPrefs(p => ({ ...p, [field]: value }));
    setSaving(s => ({ ...s, [field]: true }));
    setError('');
    setSaved('');

    try {
      await profileAPI.updatePreferences({ [field]: value });
      setSaved(`${field.replace('Consent', '').replace('_consent', '')} preference saved`);
      setTimeout(() => setSaved(''), 3000);
    } catch {
      // revert
      setPrefs(p => ({ ...p, [field]: !value }));
      setError('Failed to save preference. Please try again.');
    } finally {
      setSaving(s => ({ ...s, [field]: false }));
    }
  };

  if (loading) {
    return (
      <div style={s.loading}>
        <span style={s.spinner} />
        <style>{`@keyframes cm-spin{to{transform:rotate(360deg)}}`}</style>
        Loading privacy settings…
      </div>
    );
  }

  const dataSharing = prefs?.data_sharing_consent  ?? false;
  const analytics   = prefs?.analytics_consent     ?? false;
  const marketing   = prefs?.marketing_consent     ?? false;

  return (
    <div style={s.container}>

      {/* Header */}
      <div style={s.header}>
        <h3 style={s.title}>🔒 Privacy & Consent</h3>
        <p style={s.subtitle}>
          Control how your data is used. Changes take effect immediately and are logged for your records.
        </p>
      </div>

      {/* Status banners */}
      {saved && (
        <div style={s.successBanner}>✅ {saved}</div>
      )}
      {error && (
        <div style={s.errorBanner}>{error}</div>
      )}

      {/* Required section */}
      <div style={s.section}>
        <div style={s.sectionLabel}>Essential (always on)</div>
        <div style={s.card}>
          <ConsentItem
            icon="🛡️"
            title="Emergency Data Processing"
            description="Required to operate the app. Covers SOS triggers, location sharing during emergencies, and contact notifications. Cannot be disabled."
            tag="Required"
            checked={true}
            onChange={() => {}}
            saving={false}
          />
          <div style={s.divider} />
          <ConsentItem
            icon="🔐"
            title="Encrypted Storage"
            description="Your phone numbers, contact details, and profile data are always encrypted using AES-256-GCM. This cannot be turned off."
            tag="Required"
            checked={true}
            onChange={() => {}}
            saving={false}
          />
        </div>
      </div>

      {/* Optional section */}
      <div style={s.section}>
        <div style={s.sectionLabel}>Optional</div>
        <div style={s.card}>
          <ConsentItem
            icon="📊"
            title="Data Sharing"
            description="Allow anonymised data (incident patterns, response times) to be shared to improve emergency services in your area. No personal identifiers are ever included."
            checked={dataSharing}
            onChange={(v) => handleToggle('dataSharingConsent', v)}
            saving={saving.dataSharingConsent}
          />
          <div style={s.divider} />
          <ConsentItem
            icon="📈"
            title="Usage Analytics"
            description="Help us improve SafeGuard by sending anonymous usage data such as which features you use most. Never includes your messages or location history."
            checked={analytics}
            onChange={(v) => handleToggle('analyticsConsent', v)}
            saving={saving.analyticsConsent}
          />
          <div style={s.divider} />
          <ConsentItem
            icon="📣"
            title="Safety Notifications"
            description="Receive occasional notifications about new safety features, nearby alerts in your area, and safety tips relevant to your region."
            checked={marketing}
            onChange={(v) => handleToggle('marketingConsent', v)}
            saving={saving.marketingConsent}
          />
        </div>
      </div>

      {/* Info section */}
      <div style={s.infoBox}>
        <div style={s.infoRow}>
          <span style={s.infoIcon}>📋</span>
          <div>
            <p style={s.infoTitle}>Consent Log</p>
            <p style={s.infoText}>Every change you make here is timestamped and securely stored. You can request a copy of your consent history at any time.</p>
          </div>
        </div>
        <div style={s.infoRow}>
          <span style={s.infoIcon}>🗑️</span>
          <div>
            <p style={s.infoTitle}>Your Right to Erasure</p>
            <p style={s.infoText}>You may request full deletion of your account and data by contacting support. All personal data will be permanently removed within 30 days.</p>
          </div>
        </div>
        <div style={s.infoRow}>
          <span style={s.infoIcon}>🇮🇳</span>
          <div>
            <p style={s.infoTitle}>Compliance</p>
            <p style={s.infoText}>SafeGuard complies with India's Digital Personal Data Protection Act (DPDP) 2023 and applicable data protection regulations.</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cm-spin { to { transform: rotate(360deg); } }
        @keyframes cm-save { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
};

const s = {
  container: {
    maxWidth: 700,
    margin: '0 auto',
    fontFamily: "'DM Sans', sans-serif",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    fontSize: '1.2rem',
    color: '#fff',
    margin: '0 0 6px',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.6,
  },
  successBanner: {
    padding: '10px 14px',
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 8,
    color: '#10B981',
    fontSize: '0.83rem',
    marginBottom: 14,
  },
  errorBanner: {
    padding: '10px 14px',
    background: 'rgba(230,57,70,0.1)',
    border: '1px solid rgba(230,57,70,0.3)',
    borderRadius: 8,
    color: '#FF6B74',
    fontSize: '0.83rem',
    marginBottom: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 10,
  },
  card: {
    background: '#131929',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.06)',
    margin: '0 16px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    padding: '18px 16px',
  },
  itemLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    flex: 1,
    minWidth: 0,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  itemTitle: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: '#fff',
  },
  itemTag: {
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 20,
    fontSize: '0.65rem',
    color: '#94a3b8',
    fontWeight: 600,
    letterSpacing: '0.05em',
  },
  itemDesc: {
    fontSize: '0.8rem',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.6,
  },
  itemRight: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  savingDot: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid rgba(230,57,70,0.3)',
    borderTopColor: '#E63946',
    borderRadius: '50%',
    animation: 'cm-spin 0.7s linear infinite',
  },
  infoBox: {
    background: '#131929',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIcon: {
    fontSize: '1.2rem',
    flexShrink: 0,
    marginTop: 1,
  },
  infoTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#CBD5E4',
    margin: '0 0 3px',
  },
  infoText: {
    fontSize: '0.78rem',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.6,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 40,
    color: '#64748b',
    fontFamily: "'DM Sans', sans-serif",
  },
  spinner: {
    display: 'inline-block',
    width: 18,
    height: 18,
    border: '2.5px solid rgba(255,255,255,0.08)',
    borderTopColor: '#E63946',
    borderRadius: '50%',
    animation: 'cm-spin 0.7s linear infinite',
  },
};

export default ConsentManager;