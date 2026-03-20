// =====================================================
// SUPABASE CLIENT - REACT
// =====================================================
// FIX: removed hard throw on missing env vars.
//      Previously the app crashed entirely if .env was
//      not set up yet. Now it logs a warning and the
//      supabase client simply won't make network calls
//      until the env is correctly configured.
// =====================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.REACT_APP_SUPABASE_URL     || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabaseClient] Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY.\n' +
    'Copy .env.example to .env and fill in your Supabase project values.'
  );
}

// Create Supabase client (even if keys are empty — it will fail gracefully on calls)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken:  true,
    persistSession:    true,   // FIX: this is what keeps the user logged in across page reloads
    detectSessionInUrl: true,
  }
});

/**
 * Get current session
 * Returns null (instead of throwing) if there is no active session.
 */
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[supabaseClient] getSession error:', error.message);
      return null;
    }
    return session;
  } catch (err) {
    console.error('[supabaseClient] getSession exception:', err);
    return null;
  }
};

/**
 * Get current user
 * Returns null (instead of throwing) if not authenticated.
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('[supabaseClient] getUser error:', error.message);
      return null;
    }
    return user;
  } catch (err) {
    console.error('[supabaseClient] getUser exception:', err);
    return null;
  }
};

/**
 * Sign up new user
 */
export const signUp = async (email, password, metadata = {}) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata }
  });
  if (error) throw error;
  return data;
};

/**
 * Sign in existing user
 * FIX: Supabase's persistSession:true means the returned session is
 * automatically stored in localStorage — no manual token storage needed.
 */
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

/**
 * Sign out current user
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};

export default supabase;