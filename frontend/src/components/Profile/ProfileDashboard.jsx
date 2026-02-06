// =====================================================
// PROFILE DASHBOARD COMPONENT
// =====================================================
// Main dashboard showing user profile and quick actions
// =====================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, getCurrentUser } from '../../services/supabaseClient';
import { profileAPI } from '../../services/api';
import EmergencyContacts from './EmergencyContacts';
import LanguageSelector from './LanguageSelector';
import './Profile.css';

const ProfileDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({});
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

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
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Safety App Dashboard</h1>
          <button onClick={handleLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="dashboard-content">
        <div className="user-info-card">
          <div className="avatar-placeholder">👤</div>
          <div className="user-details">
            <h2>{profile.fullName || user?.email}</h2>
            <p className="user-email">{user?.email}</p>
            <div className="user-stats">
              <div className="stat">
                <span className="stat-label">Language:</span>
                <span className="stat-value">{preferences.language_name || 'English'}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Phone:</span>
                <span className="stat-value">{profile.phoneNumber || 'Not set'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button
            className={`tab ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contacts')}
          >
            Emergency Contacts
          </button>
          <button
            className={`tab ${activeTab === 'language' ? 'active' : ''}`}
            onClick={() => setActiveTab('language')}
          >
            Language
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'profile' && (
            <div className="profile-section">
              <h3>Profile Information</h3>
              <p>User profile settings will appear here</p>
            </div>
          )}

          {activeTab === 'contacts' && (
            <EmergencyContacts />
          )}

          {activeTab === 'language' && (
            <LanguageSelector 
              currentLanguage={preferences.language_code || 'en'}
              onLanguageChange={loadProfile}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileDashboard;