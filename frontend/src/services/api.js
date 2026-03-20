import axios from 'axios';
import { getCurrentSession } from './supabaseClient';

const NODE_API_URL = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000';

const getAuthHeaders = async () => {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
};

const tokenHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

// ── Auth ──────────────────────────────────────────
export const authAPI = {
  register: async (userData) => {
    const response = await axios.post(`${NODE_API_URL}/api/auth/register`, userData);
    return response.data;
  },
  login: async (credentials) => {
    const response = await axios.post(`${NODE_API_URL}/api/auth/login`, credentials);
    return response.data;
  },
  logout: async () => {
    const headers = await getAuthHeaders();
    const response = await axios.post(`${NODE_API_URL}/api/auth/logout`, {}, { headers });
    return response.data;
  },
  me: async () => {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${NODE_API_URL}/api/auth/me`, { headers });
    return response.data;
  },
};

// ── Profile ───────────────────────────────────────
export const profileAPI = {
  getProfile: async () => {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${NODE_API_URL}/api/profile`, { headers });
    return response.data;
  },

  updateProfile: async (profileData) => {
    const headers = await getAuthHeaders();
    // phoneNumber is now included — backend encrypts it
    const allowed = [
      'fullName', 'phoneNumber', 'bio', 'location', 'dateOfBirth',
      'gender', 'bloodGroup', 'medicalConditions', 'allergies', 'avatarUrl',
    ];
    const payload = {};
    for (const key of allowed) {
      if (profileData[key] !== undefined) payload[key] = profileData[key];
    }
    const response = await axios.put(`${NODE_API_URL}/api/profile`, payload, { headers });
    return response.data;
  },

  getPreferences: async () => {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${NODE_API_URL}/api/profile/preferences`, { headers });
    return response.data;
  },

  updatePreferences: async (preferences) => {
    const headers = await getAuthHeaders();
    const allowed = [
      'languageCode','languageName','notificationEnabled','locationSharingEnabled',
      'emergencyAlertSound','dataSharingConsent','analyticsConsent','marketingConsent',
      'theme','timezone',
    ];
    const payload = {};
    for (const key of allowed) {
      if (preferences[key] !== undefined) payload[key] = preferences[key];
    }
    const response = await axios.put(`${NODE_API_URL}/api/profile/preferences`, payload, { headers });
    return response.data;
  },

  getLanguages: async () => {
    const response = await axios.get(`${NODE_API_URL}/api/profile/languages`);
    return response.data;
  },
};

// ── Emergency Contacts ────────────────────────────
export const emergencyAPI = {
  getContacts: async () => {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${NODE_API_URL}/api/emergency-contacts`, { headers });
    return response.data;
  },
  addContact: async (contactData) => {
    const headers = await getAuthHeaders();
    const response = await axios.post(`${NODE_API_URL}/api/emergency-contacts`, contactData, { headers });
    return response.data;
  },
  addContactWithToken: async (contactData, token) => {
    const response = await axios.post(`${NODE_API_URL}/api/emergency-contacts`, contactData, { headers: tokenHeaders(token) });
    return response.data;
  },
  updateContact: async (contactId, contactData) => {
    const headers = await getAuthHeaders();
    const response = await axios.put(`${NODE_API_URL}/api/emergency-contacts/${contactId}`, contactData, { headers });
    return response.data;
  },
  deleteContact: async (contactId) => {
    const headers = await getAuthHeaders();
    const response = await axios.delete(`${NODE_API_URL}/api/emergency-contacts/${contactId}`, { headers });
    return response.data;
  },
};

// ── Language ──────────────────────────────────────
export const languageAPI = {
  getLanguages: async () => {
    const response = await axios.get(`${NODE_API_URL}/api/profile/languages`);
    return response.data;
  },
  updateUserLanguage: async (_userId, languageData) => {
    const headers = await getAuthHeaders();
    const languageCode = languageData.language_code || languageData.languageCode;
    const languageName = languageData.language_name || languageData.languageName;
    const response = await axios.put(`${NODE_API_URL}/api/profile/preferences`, { languageCode, languageName }, { headers });
    return response.data;
  },
  getUserLanguage: async (_userId) => {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${NODE_API_URL}/api/profile/preferences`, { headers });
    const prefs = response.data?.data?.preferences || {};
    return { success: true, data: { language_code: prefs.language_code, language_name: prefs.language_name } };
  },
};

// ── AI ────────────────────────────────────────────
export const aiAPI = {
  chat: async (message, source = 'text', language = 'en') => {
    const headers = await getAuthHeaders();
    const response = await axios.post(`${NODE_API_URL}/api/ai/chat`, { message, source, language }, { headers });
    return response.data;
  },
  analyze: async (message) => {
    const headers = await getAuthHeaders();
    const response = await axios.post(`${NODE_API_URL}/api/ai/analyze`, { message }, { headers });
    return response.data;
  },
  getHistory: async (limit = 50, offset = 0) => {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${NODE_API_URL}/api/ai/history?limit=${limit}&offset=${offset}`, { headers });
    return response.data;
  },
  clearContext: async () => {
    try {
      const headers = await getAuthHeaders();
      await axios.delete(`${NODE_API_URL}/api/ai/context`, { headers });
    } catch { /* non-critical */ }
  },
};

export default { authAPI, profileAPI, emergencyAPI, languageAPI, aiAPI };