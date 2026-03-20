// =====================================================
// PRIVATE ROUTE COMPONENT — FIXED
// =====================================================
// FIX: The original component imported getCurrentSession
//      which could throw (or always return null when the
//      session was not yet loaded), causing the route to
//      always redirect to /login even after a successful
//      login/register.
//
//      Now:
//        1. getCurrentSession() returns null safely (no throw)
//        2. We also subscribe to onAuthStateChange so the
//           component re-checks when Supabase restores the
//           session from localStorage on first load.
// =====================================================

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';

const PrivateRoute = ({ children }) => {
  // null  = still checking
  // true  = authenticated
  // false = not authenticated
  const [authState, setAuthState] = useState(null);

  useEffect(() => {
    // Check immediately (handles already-stored sessions)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(!!session);
    });

    // Also subscribe — fires when session is restored from localStorage
    // or when the user logs out elsewhere
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthState(!!session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Still loading — show a minimal spinner so the user isn't flashed to /login
  if (authState === null) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0B0F1A',
        color: '#CBD5E4',
        fontSize: '1rem',
      }}>
        <span style={{
          width: 28, height: 28,
          border: '3px solid rgba(255,255,255,0.15)',
          borderTopColor: '#E63946',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
          marginRight: 12,
          display: 'inline-block',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        Loading…
      </div>
    );
  }

  return authState ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;