// =====================================================
// AI API Service — Frontend
// =====================================================
// Connects to Node.js /api/ai routes (Groq-powered)
// =====================================================

import axios from 'axios';
import { getCurrentSession } from './supabaseClient';

const NODE_API_URL = process.env.REACT_APP_NODE_API_URL || 'http://localhost:3001';

const getAuthHeaders = async () => {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('No active session');
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
};

export const aiAPI = {
  /**
   * Send a message and get AI analysis + response
   * Module 7 (text), Module 6 (voice), 8, 16, 18, 19, 20
   */
  chat: async (message, source = 'text', language = 'en') => {
    const headers = await getAuthHeaders();
    const res = await axios.post(
      `${NODE_API_URL}/api/ai/chat`,
      { message, source, language },
      { headers }
    );
    return res.data;
  },

  /**
   * Analyze text only — no conversational response
   */
  analyze: async (message, language = 'en') => {
    const headers = await getAuthHeaders();
    const res = await axios.post(
      `${NODE_API_URL}/api/ai/analyze`,
      { message, language },
      { headers }
    );
    return res.data;
  },

  /**
   * Fetch chat history
   */
  getHistory: async (page = 1, limit = 20) => {
    const headers = await getAuthHeaders();
    const res = await axios.get(
      `${NODE_API_URL}/api/ai/history?page=${page}&limit=${limit}`,
      { headers }
    );
    return res.data;
  },

  /**
   * Clear conversation context (start fresh)
   */
  clearContext: async () => {
    try {
      const headers = await getAuthHeaders();
      await axios.delete(`${NODE_API_URL}/api/ai/context`, { headers });
    } catch {
      // Non-critical
    }
  },
};