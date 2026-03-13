// =====================================================
// API SERVICE
// =====================================================
// Centralized API calls to Node.js backend
// CHANGE: FastAPI/Python backend removed entirely.
//         languageAPI now calls Node.js /api/profile/languages
//         FASTAPI_URL reference deleted (was causing crash
//         because it was commented out but still used below)
// =====================================================

import axios from 'axios';
import { getCurrentSession } from './supabaseClient';

// API base URL — Node.js backend only
const NODE_API_URL = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000';

/**
 * Get authorization headers with JWT token
 */
const getAuthHeaders = async () => {
  const session = await getCurrentSession();
  if (!session || !session.access_token) {
    throw new Error('No active session');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
};

// =====================================================
// AUTHENTICATION APIs (Node.js)
// =====================================================

export const authAPI = {
  register: async (userData) => {
    try {
      const response = await axios.post(`${NODE_API_URL}/api/auth/register`, userData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  login: async (credentials) => {
    try {
      const response = await axios.post(`${NODE_API_URL}/api/auth/login`, credentials);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  logout: async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.post(`${NODE_API_URL}/api/auth/logout`, {}, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  me: async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${NODE_API_URL}/api/auth/me`, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

// =====================================================
// PROFILE APIs (Node.js)
// =====================================================

export const profileAPI = {
  getProfile: async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${NODE_API_URL}/api/profile`, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  updateProfile: async (profileData) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.put(`${NODE_API_URL}/api/profile`, profileData, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getPreferences: async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${NODE_API_URL}/api/profile/preferences`, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  updatePreferences: async (preferences) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.put(`${NODE_API_URL}/api/profile/preferences`, preferences, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getLanguages: async () => {
    try {
      const response = await axios.get(`${NODE_API_URL}/api/profile/languages`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

// =====================================================
// EMERGENCY CONTACTS APIs (Node.js)
// =====================================================

export const emergencyAPI = {
  getContacts: async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${NODE_API_URL}/api/emergency-contacts`, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  addContact: async (contactData) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.post(`${NODE_API_URL}/api/emergency-contacts`, contactData, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  updateContact: async (contactId, contactData) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.put(`${NODE_API_URL}/api/emergency-contacts/${contactId}`, contactData, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  deleteContact: async (contactId) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.delete(`${NODE_API_URL}/api/emergency-contacts/${contactId}`, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getContact: async (contactId) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${NODE_API_URL}/api/emergency-contacts/${contactId}`, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

// =====================================================
// LANGUAGE APIs
// =====================================================
// CHANGE: Was calling FastAPI (FASTAPI_URL) which no longer
//         exists. Now routes through Node.js profile endpoints.
//         updateUserLanguage / getUserLanguage → updatePreferences
// =====================================================

export const languageAPI = {
  // Public — no auth needed
  getLanguages: async () => {
    try {
      const response = await axios.get(`${NODE_API_URL}/api/profile/languages`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // CHANGE: was PUT /fastapi/api/v1/user/:id/language
  //         now uses PUT /api/profile/preferences with language fields
  updateUserLanguage: async (_userId, languageData) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.put(
        `${NODE_API_URL}/api/profile/preferences`,
        {
          languageCode: languageData.language_code || languageData.languageCode,
          languageName: languageData.language_name || languageData.languageName,
        },
        { headers }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // CHANGE: was GET /fastapi/api/v1/user/:id/language
  //         now uses GET /api/profile/preferences
  getUserLanguage: async (_userId) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${NODE_API_URL}/api/profile/preferences`, { headers });
      // Return just the language fields so callers don't need to change
      const prefs = response.data?.data?.preferences || {};
      return {
        success: true,
        data: {
          language_code: prefs.language_code,
          language_name: prefs.language_name,
        }
      };
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

// =====================================================
// AI APIs (Node.js → Groq)
// =====================================================

export const aiAPI = {
  chat: async (message, options = {}) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.post(
        `${NODE_API_URL}/api/ai/chat`,
        { message, ...options },
        { headers }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  analyze: async (message) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.post(
        `${NODE_API_URL}/api/ai/analyze`,
        { message },
        { headers }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getHistory: async (limit = 50, offset = 0) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(
        `${NODE_API_URL}/api/ai/history?limit=${limit}&offset=${offset}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  clearContext: async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.delete(`${NODE_API_URL}/api/ai/context`, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

export default {
  authAPI,
  profileAPI,
  emergencyAPI,
  languageAPI,
  aiAPI,
};