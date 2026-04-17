// =====================================================
// ProfileDashboard.jsx — FULL i18n + Last Login fix
// =====================================================
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, getCurrentUser, supabase } from '../../services/supabaseClient';
import { profileAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import EmergencyContacts from './EmergencyContacts';
import LanguageSelector from './LanguageSelector';
import SOSButton from '../SOS/SOSButton';
import Helplines from '../SOS/Helplines';
import HelpHistory from '../SOS/HelpHistory';
import AIChat from '../AI/AIChat';
import '../SOS/SOS.css';
import './Dashboard.css';
import LegalAssistant from '../Legal/LegalAssistant';
import ConsentManager from '../Privacy/ConsentManager';
import Analytics from '../Analytics/Analytics';
import NearbyResources from '../SOS/NearbyResources';
const GENDERS      = ['', 'Female', 'Male', 'Non-binary', 'Prefer not to say'];
const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

async function uploadAvatarToStorage(userId, file) {
  const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error('Upload failed: ' + error.message);
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

function formatDateTime(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return null; }
}

// ── Previous Login helpers ─────────────────────────
// We store the PREVIOUS session's timestamp in localStorage.
// On each load we show what was stored, then update the store
// with the current session time so next visit shows this one.
const PREV_LOGIN_KEY = 'safeguard_prev_login';



/* ══════════════════════════════════════════════════
   ProfileEditor
   ══════════════════════════════════════════════════ */
const ProfileEditor = ({ userObj, profileObj, userEmail, onSaved }) => {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);

  const [editing,       setEditing]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile,    setAvatarFile]    = useState(null);

  useEffect(() => { setAvatarPreview(profileObj?.avatar_url || null); }, [profileObj?.avatar_url]);

  const makeForm = () => ({
    fullName:    userObj?.fullName    || '',
    phoneNumber: userObj?.phoneNumber || '',
    bio:         profileObj?.bio               || '',
    location:    profileObj?.location          || '',
    gender:      profileObj?.gender            || '',
    bloodGroup:  profileObj?.blood_group       || '',
    dateOfBirth: profileObj?.date_of_birth
      ? String(profileObj.date_of_birth).slice(0, 10) : '',
  });

  const [form, setForm] = useState(makeForm);
  useEffect(() => { setForm(makeForm()); }, [
    userObj?.fullName, userObj?.phoneNumber,
    profileObj?.bio, profileObj?.location, profileObj?.gender,
    profileObj?.blood_group, profileObj?.date_of_birth,
  ]);

  const setF = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setError(''); };

  const handleFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Image must be smaller than 5 MB.'); return; }
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP images are allowed.'); return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleSave = async e => {
    e.preventDefault();
    if (!form.fullName.trim()) { setError(t('name_required')); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      let avatarUrl;
      if (avatarFile) {
        setUploading(true);
        try {
          avatarUrl = await uploadAvatarToStorage(userObj?.id || userEmail || 'user', avatarFile);
        } catch (upErr) { setError(upErr.message); setSaving(false); setUploading(false); return; }
        setUploading(false);
        setAvatarFile(null);
      }
      await profileAPI.updateProfile({
        fullName: form.fullName.trim(), phoneNumber: form.phoneNumber.trim(),
        bio: form.bio, location: form.location, gender: form.gender,
        bloodGroup: form.bloodGroup, dateOfBirth: form.dateOfBirth || null,
        ...(avatarUrl !== undefined && { avatarUrl }),
      });
      setSuccess(t('profile_saved'));
      setEditing(false);
      onSaved?.();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err?.response?.data?.error || 'Update failed. Please try again.');
    } finally { setSaving(false); }
  };

  const initials = (userObj?.fullName || userEmail || 'U').charAt(0).toUpperCase();


  return (
    <div className="pe-wrap">
      <div className="pe-hero">
        <div
          className={`pe-avatar-ring ${editing ? 'pe-avatar-editable' : ''}`}
          onClick={editing ? () => fileInputRef.current?.click() : undefined}
        >
          {avatarPreview
            ? <img src={avatarPreview} alt="Profile" className="pe-avatar-img" />
            : <div className="pe-avatar-letters">{initials}</div>
          }
          {editing && (
            <div className="pe-avatar-overlay">
              {uploading ? <span className="pe-spin pe-spin-lg" /> : <span>📷</span>}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        <div className="pe-hero-info">
          <h2 className="pe-name">
            {userObj?.fullName || <span style={{ color:'#64748b', fontWeight:400 }}>{t('not_set')}</span>}
          </h2>
          <p className="pe-email">{userEmail}</p>
          <span className="pe-since">
            {t('member_since')}{' '}
            {userObj?.createdAt
              ? new Date(userObj.createdAt).toLocaleDateString('en-IN', { month:'long', year:'numeric' })
              : '—'}
          </span>
          {editing && <p className="pe-hint">{t('click_photo')}</p>}
        </div>

        <button className="pe-toggle" onClick={() => {
          setEditing(v => !v); setError(''); setSuccess('');
          if (!editing) setForm(makeForm());
        }}>
          {editing ? `✕ ${t('profile_cancel')}` : `✏️ ${t('profile_edit')}`}
        </button>
      </div>

      {success && <div className="pe-success">✅ {success}</div>}
      {error   && <div className="pe-error">⚠️ {error}</div>}

      {editing ? (
        <form className="pe-form" onSubmit={handleSave} noValidate>
          <div className="pe-grid">
            <div className="pe-field">
              <label className="pe-lbl">{t('full_name')} *</label>
              <input className="pe-inp" type="text" value={form.fullName}
                onChange={setF('fullName')} placeholder={t('full_name')} />
            </div>
            <div className="pe-field">
              <label className="pe-lbl">{t('phone')}</label>
              <div className="pe-input-icon-wrap">
                <span className="pe-input-prefix">📱</span>
                <input className="pe-inp pe-inp-icon" type="tel" inputMode="tel"
                  value={form.phoneNumber} onChange={setF('phoneNumber')}
                  placeholder="+91 98765 43210" autoComplete="tel" />
              </div>
            </div>
            <div className="pe-field">
              <label className="pe-lbl">{t('location')}</label>
              <input className="pe-inp" type="text" value={form.location}
                onChange={setF('location')} placeholder="e.g. Mumbai" />
            </div>
            <div className="pe-field">
              <label className="pe-lbl">{t('gender')}</label>
              <select className="pe-inp" value={form.gender} onChange={setF('gender')}>
                {GENDERS.map(g => <option key={g} value={g}>{g || t('gender_select')}</option>)}
              </select>
            </div>
            <div className="pe-field">
              <label className="pe-lbl">{t('dob')}</label>
              <input className="pe-inp" type="date" value={form.dateOfBirth} onChange={setF('dateOfBirth')} />
            </div>
            <div className="pe-field">
              <label className="pe-lbl">{t('blood_group')}</label>
              <select className="pe-inp" value={form.bloodGroup} onChange={setF('bloodGroup')}>
                {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b || t('gender_select')}</option>)}
              </select>
            </div>
          </div>
          <div className="pe-field" style={{ marginTop:14 }}>
            <label className="pe-lbl">{t('bio')}</label>
            <textarea className="pe-inp pe-ta" rows={3} value={form.bio}
              onChange={setF('bio')} placeholder="…" />
          </div>
          <div className="pe-actions">
            <button type="button" className="pe-cancel" onClick={() => { setEditing(false); setError(''); }}>
              {t('profile_cancel')}
            </button>
            <button type="submit" className="pe-save" disabled={saving}>
              {saving
                ? <><span className="pe-spin" /> {uploading ? t('profile_uploading') : t('profile_saving')}</>
                : `✓ ${t('profile_save')}`}
            </button>
          </div>
        </form>
      ) : (
        <div className="pe-grid-info">
          {[
            { icon:'👤', label:t('full_name'),    value: userObj?.fullName    || t('not_set') },
            { icon:'📧', label:t('email'),         value: userEmail            || '—' },
            { icon:'📱', label:t('phone'),         value: userObj?.phoneNumber || t('not_set') },
            { icon:'📍', label:t('location'),      value: profileObj?.location || '—' },
            { icon:'🪪', label:t('gender'),        value: profileObj?.gender   || '—' },
            { icon:'🎂', label:t('dob'),           value: profileObj?.date_of_birth
                ? new Date(profileObj.date_of_birth).toLocaleDateString('en-IN') : '—' },
            { icon:'🩸', label:t('blood_group'),   value: profileObj?.blood_group || '—' },
            { icon:'📝', label:t('bio'),           value: profileObj?.bio         || '—' },
          ].map(item => (
            <div className="pe-card" key={item.label}>
              <span className="pe-card-icon">{item.icon}</span>
              <div>
                <span className="pe-card-lbl">{item.label}</span>
                <span className="pe-card-val">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .pe-wrap{max-width:700px;margin:0 auto;font-family:'DM Sans',sans-serif}
        .pe-hero{display:flex;align-items:center;gap:18px;padding:22px;background:#131929;border:1px solid rgba(255,255,255,.07);border-radius:16px;margin-bottom:18px;flex-wrap:wrap}
        .pe-avatar-ring{position:relative;flex-shrink:0;width:72px;height:72px;border-radius:50%}
        .pe-avatar-editable{cursor:pointer}
        .pe-avatar-img{width:72px;height:72px;border-radius:50%;object-fit:cover;border:2.5px solid rgba(230,57,70,.5);display:block}
        .pe-avatar-letters{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#E63946,#a8202a);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:1.8rem;color:#fff}
        .pe-avatar-overlay{position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-size:1.4rem;opacity:0;transition:opacity .2s}
        .pe-avatar-editable:hover .pe-avatar-overlay{opacity:1}
        .pe-hero-info{flex:1;min-width:0}
        .pe-name{font-family:'Syne',sans-serif;font-weight:700;font-size:1.25rem;color:#fff;margin:0 0 3px}
        .pe-email{font-size:.83rem;color:#64748b;margin:0 0 7px}
        .pe-since{font-size:.7rem;padding:3px 10px;background:#1E2740;border:1px solid rgba(255,255,255,.07);border-radius:20px;color:#64748b}
        .pe-hint{font-size:.7rem;color:#64748b;margin:8px 0 0}
        .pe-toggle{padding:9px 16px;background:rgba(230,57,70,.12);border:1px solid rgba(230,57,70,.3);border-radius:8px;color:#FF6B74;font-size:.83rem;font-weight:600;cursor:pointer;transition:all .2s;font-family:inherit;white-space:nowrap;align-self:flex-start}
        .pe-toggle:hover{background:rgba(230,57,70,.22)}
        .pe-success{padding:10px 14px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:8px;color:#10B981;font-size:.82rem;margin-bottom:12px}
        .pe-error{padding:10px 14px;background:rgba(230,57,70,.1);border:1px solid rgba(230,57,70,.3);border-radius:8px;color:#FF6B74;font-size:.82rem;margin-bottom:12px}
        .pe-form{background:#131929;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:20px;animation:pe-in .25s ease}
        @keyframes pe-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .pe-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .pe-field{display:flex;flex-direction:column;gap:5px}
        .pe-lbl{font-size:.72rem;font-weight:500;color:#CBD5E4;letter-spacing:.03em}
        .pe-inp{padding:10px 13px;background:#1E2740;border:1.5px solid rgba(255,255,255,.07);border-radius:8px;color:#fff;font-size:.88rem;font-family:inherit;outline:none;transition:border-color .2s;width:100%;box-sizing:border-box}
        .pe-inp:focus{border-color:#E63946}
        .pe-inp::placeholder{color:#374151}
        .pe-inp option{background:#1E2740}
        .pe-ta{resize:vertical;min-height:76px}
        .pe-input-icon-wrap{position:relative;display:flex;align-items:center}
        .pe-input-prefix{position:absolute;left:12px;font-size:.95rem;pointer-events:none;z-index:1}
        .pe-inp-icon{padding-left:36px}
        .pe-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
        .pe-cancel{padding:9px 16px;background:#1E2740;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#CBD5E4;font-size:.86rem;cursor:pointer;font-family:inherit}
        .pe-cancel:hover{background:#253050}
        .pe-save{display:flex;align-items:center;gap:7px;padding:9px 20px;background:#E63946;border:none;border-radius:8px;color:#fff;font-size:.88rem;font-weight:600;cursor:pointer;font-family:inherit}
        .pe-save:hover:not(:disabled){background:#c8303c}
        .pe-save:disabled{opacity:.6;cursor:not-allowed}
        .pe-spin{width:13px;height:13px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:pe-sp .7s linear infinite;display:inline-block}
        .pe-spin-lg{width:22px;height:22px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:pe-sp .7s linear infinite;display:inline-block}
        @keyframes pe-sp{to{transform:rotate(360deg)}}
        .pe-grid-info{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
        .pe-card{display:flex;align-items:flex-start;gap:12px;padding:13px 15px;background:#131929;border:1px solid rgba(255,255,255,.07);border-radius:12px;transition:border-color .2s}
        .pe-card:hover{border-color:rgba(255,255,255,.12)}
        .pe-card-icon{font-size:1.05rem;flex-shrink:0;margin-top:2px}
        .pe-card>div{display:flex;flex-direction:column;gap:2px;min-width:0}
        .pe-card-lbl{font-size:.68rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
        .pe-card-val{font-size:.87rem;color:#fff;font-weight:500;word-break:break-word}
        @media(max-width:600px){.pe-grid{grid-template-columns:1fr}.pe-hero{flex-direction:column;align-items:flex-start}}
      `}</style>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   MAIN DASHBOARD
   ══════════════════════════════════════════════════ */
const ProfileDashboard = () => {
  const navigate = useNavigate();
  const { languageCode, languageName, setLanguage, t } = useLanguage();

  const [user,             setUser]             = useState(null);
  const [profile,          setProfile]          = useState({});
  const [profileData,      setProfileData]      = useState({});
  const [preferences,      setPreferences]      = useState({});
  const [loading,          setLoading]          = useState(true);
  const [activeTab,        setActiveTab]        = useState('sos');
  const [sosActive,        setSosActive]        = useState(false);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);

  const TABS = [
    { key:'sos',       label:t('nav_sos'),       icon:'🆘', desc:t('nav_sos_desc')       },
    { key:'ai',        label:t('nav_ai'),         icon:'🤖', desc:t('nav_ai_desc')        },
    { key:'contacts',  label:t('nav_contacts'),   icon:'📞', desc:t('nav_contacts_desc')  },
    { key:'helplines', label:t('nav_helplines'),  icon:'☎️', desc:t('nav_helplines_desc') },
    { key:'nearby', label:t('nav_nearby'), icon:'🗺️', desc:t('nav_nearby_desc') },
    { key:'history',   label:t('nav_history'),    icon:'📋', desc:t('nav_history_desc')   },
    { key:'language',  label:t('nav_language'),   icon:'🌐', desc:t('nav_language_desc')  },
    { key:'profile',   label:t('nav_profile'),    icon:'👤', desc:t('nav_profile_desc')   },
    { key:'legal',     label:t('nav_legal'),     icon:'⚖️', desc:t('nav_legal_desc')     },
    { key:'analytics', label:t('nav_analytics'), icon:'📊', desc:t('nav_analytics_desc') },
    { key:'privacy', label:'Privacy', icon:'🔒', desc:'Consent' },
  ];

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);

  
      const response = await profileAPI.getProfile();
      if (response.success) {
        setProfile(response.data.user        || {});
        setProfileData(response.data.profile || {});
        const prefs = response.data.preferences || {};
        setPreferences(prefs);
        if (prefs.language_code && prefs.language_code !== languageCode) {
          setLanguage(prefs.language_code, prefs.language_name);
        }
      }
    } catch (err) {
      console.error('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await signOut(); navigate('/login'); }
    catch (err) { console.error(err); }
  };

  const changeTab = key => { setActiveTab(key); setSidebarOpen(false); };

  if (loading) {
    return (
      <div className="db-loading">
        <span className="db-spinner" />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span>Loading…</span>
      </div>
    );
  }

  const firstName  = (profile.fullName || user?.email || 'U').split(' ')[0];
  const avatarUrl  = profileData?.avatar_url || null;
  const activeInfo = TABS.find(tab => tab.key === activeTab);

  return (
    <div className={`db-root ${sosActive ? 'sos-mode' : ''}`}>
      <aside className={`db-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="db-logo">
          <div className="db-logo-shield">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
          </div>
          <span className="db-logo-text">SafeGuard</span>
        </div>

        <div className="db-user-card">
          {avatarUrl
            ? <img src={avatarUrl} className="db-avatar" alt="avatar"
                style={{ objectFit:'cover', border:'2px solid rgba(230,57,70,.4)' }} />
            : <div className="db-avatar">{firstName.charAt(0).toUpperCase()}</div>
          }
          <div className="db-user-info">
            <span className="db-user-name">{profile.fullName || 'User'}</span>
            <span className="db-user-email">{user?.email}</span>
          </div>
          {sosActive && <span className="db-sos-dot" />}
        </div>

        <nav className="db-nav">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`db-nav-item ${activeTab === tab.key ? 'active' : ''} ${tab.key === 'sos' && sosActive ? 'sos-pulse' : ''}`}
              onClick={() => changeTab(tab.key)}
            >
              <span className="db-nav-icon">{tab.icon}</span>
              <div className="db-nav-text">
                <span className="db-nav-label">{tab.label}</span>
                <span className="db-nav-desc">{tab.desc}</span>
              </div>
              {tab.key === 'sos' && sosActive && <span className="db-nav-badge">{t('sos_active')}</span>}
            </button>
          ))}
        </nav>

        <div className="db-sidebar-footer">
          <span className="db-lang-badge">🌐 {languageName || 'English'}</span>
          <button className="db-logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {t('logout')}
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="db-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="db-main">
        <header className={`db-topbar ${sosActive ? 'topbar-sos' : ''}`}>
          <button className="db-hamburger" onClick={() => setSidebarOpen(s => !s)}>
            <span /><span /><span />
          </button>
          <div className="db-topbar-title">
            <span className="db-tab-icon">{activeInfo?.icon}</span>
            <div>
              <h2 className="db-tab-name">{activeInfo?.label}</h2>
              <p className="db-tab-sub">{activeInfo?.desc}</p>
            </div>
          </div>
          <div className="db-topbar-right">
            {sosActive && (
              <div className="db-sos-live-badge">
                <span className="live-dot" />{t('sos_active')}
              </div>
            )}
            <div className="db-topbar-avatar">
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar"
                    style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} />
                : firstName.charAt(0)
              }
            </div>
          </div>
        </header>

        {activeTab === 'sos' && !sosActive && (
          <div className="db-welcome-banner">
            <div className="db-welcome-text">
              <h3>{t('welcome_back')}, {firstName} 👋</h3>
              <p>{t('safety_active')} · {languageName || 'English'}</p>
            </div>
            <div className="db-welcome-stats">
              <div className="db-stat-chip"><span>112</span><small>{t('nav_sos_desc')}</small></div>
              <div className="db-stat-chip"><span>1091</span><small>Women's Help</small></div>
            </div>
          </div>
        )}

        <div className="db-content">
          {activeTab === 'sos' && (
            <div className="db-sos-wrapper">
              <SOSButton
                onSOSTriggered={() => setSosActive(true)}
                onSOSResolved={() => setSosActive(false)}
              />
            </div>
          )}
          {activeTab === 'ai' && (
            <div className="db-ai-wrapper">
              <AIChat
                userLanguage={languageCode}
                onEmergencyDetected={d => { if (d?.auto_sos_triggered) setSosActive(true); }}
              />
            </div>
          )}
          {activeTab === 'contacts'  && <EmergencyContacts />}
          {activeTab === 'helplines' && <Helplines />}
          {activeTab === 'nearby' && <NearbyResources />}
          {activeTab === 'history'   && <HelpHistory />}
          {activeTab === 'language'  && (
            <LanguageSelector currentLanguage={languageCode} onLanguageChange={loadProfile} />
          )}
          {activeTab === 'profile' && (
            <ProfileEditor
              userObj={profile}
              profileObj={profileData}
              userEmail={user?.email}
              onSaved={loadProfile}
            />
          )}
          {activeTab === 'legal'     && <LegalAssistant />}
          {activeTab === 'analytics' && <Analytics />}
          {activeTab === 'privacy' && <ConsentManager />}
        </div>
      </main>
    </div>
  );
};

export default ProfileDashboard;