// =====================================================
// UPDATED ProfileDashboard — integrates SOS modules
// =====================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, getCurrentUser } from '../../services/supabaseClient';
import { profileAPI } from '../../services/api';
import EmergencyContacts from './EmergencyContacts';
import LanguageSelector from './LanguageSelector';
import SOSButton from '../SOS/SOSButton';
import Helplines from '../SOS/Helplines';
import HelpHistory from '../SOS/HelpHistory';
import '../SOS/SOS.css';
import './Profile.css';

const TABS = [
  { key: 'sos',       label: '🆘 SOS',             },
  { key: 'contacts',  label: '📞 Contacts',         },
  { key: 'helplines', label: '☎️ Helplines',        },
  { key: 'history',   label: '📋 History',          },
  { key: 'language',  label: '🌐 Language',         },
  { key: 'profile',   label: '👤 Profile',          },
];

const ProfileDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({});
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('sos');
  const [sosActive, setSosActive] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      const response = await profileAPI.getProfile();
      if (response.success) {
        setProfile(response.data.user || {});
        setPreferences(response.data.preferences || {});
      }
    } catch (err) {
      setError(err.error || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className={`dashboard-header ${sosActive ? 'sos-header-warning' : ''}`}>
        <div className="header-content">
          <h1>🛡️ Safety App</h1>
          <div className="header-right">
            {sosActive && (
              <span className="sos-active-badge">🔴 SOS ACTIVE</span>
            )}
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {/* User info bar */}
      <div className="user-info-bar">
        <span className="user-avatar">👤</span>
        <div>
          <span className="user-name">{profile.full_name || user?.email}</span>
          <span className="user-lang"> · {preferences.language_name || 'English'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-scroll">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'sos' && (
          <SOSButton
            onSOSTriggered={(incident) => {
              setSosActive(true);
            }}
            onSOSResolved={() => {
              setSosActive(false);
            }}
          />
        )}

        {activeTab === 'contacts' && <EmergencyContacts />}

        {activeTab === 'helplines' && <Helplines />}

        {activeTab === 'history' && <HelpHistory />}

        {activeTab === 'language' && (
          <LanguageSelector
            currentLanguage={preferences.language_code || 'en'}
            onLanguageChange={loadProfile}
          />
        )}

        {activeTab === 'profile' && (
          <div className="profile-section">
            <h3>Profile Information</h3>
            <div className="profile-info-grid">
              <div className="profile-info-item">
                <span className="info-label">Full Name</span>
                <span className="info-value">{profile.full_name || '—'}</span>
              </div>
              <div className="profile-info-item">
                <span className="info-label">Email</span>
                <span className="info-value">{user?.email || '—'}</span>
              </div>
              <div className="profile-info-item">
                <span className="info-label">Phone</span>
                <span className="info-value">{profile.phoneNumber || 'Not set'}</span>
              </div>
              <div className="profile-info-item">
                <span className="info-label">Language</span>
                <span className="info-value">{preferences.language_name || 'English'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileDashboard;