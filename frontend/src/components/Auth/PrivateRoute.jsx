// =====================================================
// PRIVATE ROUTE COMPONENT
// =====================================================
// Protects routes that require authentication
// =====================================================

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentSession } from '../../services/supabaseClient';

const PrivateRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const session = await getCurrentSession();
      setAuthenticated(!!session);
    } catch (error) {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  return authenticated ? children : <Navigate to="/login" />;
};

export default PrivateRoute;