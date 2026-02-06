// =====================================================
// API SERVICE
// =====================================================
// Centralized API calls to Node.js and FastAPI backends
// =====================================================

import axios from 'axios';
import { getCurrentSession } from './supabaseClient';

// API base URLs
const NODE_API_URL = process.env.REACT_APP_NODE_API_URL || 'http://localhost:3001';
const FASTAPI_URL = process.env.REACT_APP_FASTAPI_URL || 'http://localhost:8000';

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
  /**
   * Register a new user
   */
  register: async (userData) => {
    try {
      const response = await axios.post(`${NODE_API_URL}/api/auth/register`, userData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Login user
   */
  login: async (credentials) => {
    try {
      const response = await axios.post(`${NODE_API_URL}/api/auth/login`, credentials);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Logout user
   */
  logout: async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.post(`${NODE_API_URL}/api/auth/logout`, {}, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get current user info
   */
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
  /**
   * Get user profile
   */
  getProfile: async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${NODE_API_URL}/api/profile`, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Update user profile
   */
  updateProfile: async (profileData) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.put(`${NODE_API_URL}/api/profile`, profileData, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get user preferences
   */
  getPreferences: async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${NODE_API_URL}/api/profile/preferences`, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Update user preferences
   */
  updatePreferences: async (preferences) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.put(`${NODE_API_URL}/api/profile/preferences`, preferences, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get supported languages
   */
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
  /**
   * Get all emergency contacts
   */
  getContacts: async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${NODE_API_URL}/api/emergency-contacts`, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Add new emergency contact
   */
  addContact: async (contactData) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.post(`${NODE_API_URL}/api/emergency-contacts`, contactData, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Update emergency contact
   */
  updateContact: async (contactId, contactData) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.put(`${NODE_API_URL}/api/emergency-contacts/${contactId}`, contactData, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Delete emergency contact
   */
  deleteContact: async (contactId) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.delete(`${NODE_API_URL}/api/emergency-contacts/${contactId}`, { headers });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get specific emergency contact
   */
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
// LANGUAGE APIs (FastAPI)
// =====================================================

export const languageAPI = {
  /**
   * Get all supported languages
   */
  getLanguages: async () => {
    try {
      const response = await axios.get(`${FASTAPI_URL}/api/v1/languages`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Update user language
   */
  updateUserLanguage: async (userId, languageData) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.put(
        `${FASTAPI_URL}/api/v1/user/${userId}/language`,
        languageData,
        { headers }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get user language
   */
  getUserLanguage: async (userId) => {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(
        `${FASTAPI_URL}/api/v1/user/${userId}/language`,
        { headers }
      );
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
  languageAPI
};