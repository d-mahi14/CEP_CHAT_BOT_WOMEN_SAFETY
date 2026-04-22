// =====================================================
// SOS API SERVICE
// =====================================================
// Frontend service for all SOS-related API calls
// Modules: 4, 5, 9, 13, 15
//
// CHANGES:
//   - getNearby() now accepts a `language` parameter
//     and passes it to the backend so the Groq AI
//     generates resource notes in the user's language.
// =====================================================

import axios from 'axios';
import { getCurrentSession } from './supabaseClient';

const NODE_API_URL = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000';

const getAuthHeaders = async () => {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('No active session');
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
};

export const sosAPI = {
  /**
   * Trigger an SOS incident (Module 4, 12)
   */
  trigger: async (payload) => {
    const headers = await getAuthHeaders();
    const res = await axios.post(`${NODE_API_URL}/api/sos/trigger`, payload, { headers });
    return res.data;
  },

  /**
   * Update location for active incident (Module 5)
   */
  updateLocation: async (incidentId, locationData) => {
    const headers = await getAuthHeaders();
    const res = await axios.post(
      `${NODE_API_URL}/api/sos/${incidentId}/location`,
      locationData,
      { headers }
    );
    return res.data;
  },

  /**
   * Resolve / cancel SOS
   */
  resolve: async (incidentId, action = 'resolved', notes = '') => {
    const headers = await getAuthHeaders();
    const res = await axios.patch(
      `${NODE_API_URL}/api/sos/${incidentId}/resolve`,
      { action, notes },
      { headers }
    );
    return res.data;
  },

  /**
   * Get active incident
   */
  getActive: async () => {
    const headers = await getAuthHeaders();
    const res = await axios.get(`${NODE_API_URL}/api/sos/active`, { headers });
    return res.data;
  },

  /**
   * Get help history (Module 9)
   */
  getHistory: async (page = 1, limit = 10) => {
    const headers = await getAuthHeaders();
    const res = await axios.get(
      `${NODE_API_URL}/api/sos/history?page=${page}&limit=${limit}`,
      { headers }
    );
    return res.data;
  },

  /**
   * Get helplines (Module 13)
   */
  getHelplines: async (category = null, state = null) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (state) params.append('state', state);
    const res = await axios.get(`${NODE_API_URL}/api/sos/helplines?${params}`);
    return res.data;
  },

  /**
   * Get nearby safety resources (Module 15)
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} radius - Search radius in metres (default 5000)
   * @param {string|null} type - Resource type filter (null = all)
   * @param {string} language - BCP47 language code for AI-generated notes (default 'en')
   */
  getNearby: async (lat, lng, radius = 5000, type = null, language = 'en') => {
    const params = new URLSearchParams({ lat, lng, radius });
    if (type) params.append('type', type);
    if (language) params.append('language', language);
    const res = await axios.get(`${NODE_API_URL}/api/sos/nearby?${params}`);
    return res.data;
  },
};

/**
 * Get current GPS location from browser
 * Returns Promise<{latitude, longitude, accuracy, ...}>
 */
export const getCurrentLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy:  pos.coords.accuracy,
        altitude:  pos.coords.altitude,
        speed:     pos.coords.speed,
        heading:   pos.coords.heading,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });

/**
 * Watch GPS location — returns watchId for cleanup
 */
export const watchLocation = (onUpdate, onError) => {
  if (!navigator.geolocation) {
    onError?.(new Error('Geolocation not supported'));
    return null;
  }
  return navigator.geolocation.watchPosition(
    (pos) => onUpdate({
      latitude:  pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy:  pos.coords.accuracy,
    }),
    (err) => onError?.(err),
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
};

export const stopWatchingLocation = (watchId) => {
  if (watchId) navigator.geolocation.clearWatch(watchId);
};