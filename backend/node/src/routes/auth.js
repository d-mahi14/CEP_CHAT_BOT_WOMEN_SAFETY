// =====================================================
// AUTHENTICATION ROUTES
// =====================================================
// Handles user registration, login, logout, and session management
// Uses Supabase Auth for authentication
// =====================================================

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { encryptPhoneNumber } = require('../middleware/encryption');
const { authenticateUser } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * Register a new user
 * 
 * Body:
 * - email: string (required)
 * - password: string (required)
 * - fullName: string (required)
 * - phoneNumber: string (required)
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, phoneNumber } = req.body;

    // Validate required fields
    if (!email || !password || !fullName || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, fullName, phoneNumber'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate password strength (min 8 chars, at least 1 number, 1 uppercase)
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters with 1 uppercase letter and 1 number'
      });
    }

    // Encrypt phone number before storage
    const encryptedPhone = encryptPhoneNumber(phoneNumber);

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (authError) {
      return res.status(400).json({
        success: false,
        error: authError.message
      });
    }

    // If user was created successfully
    if (authData.user) {
      // Store additional user data in users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([
          {
            user_id: authData.user.id,
            full_name: fullName,
            phone_number_encrypted: encryptedPhone.encrypted,
            phone_number_iv: encryptedPhone.iv,
            phone_number_auth_tag: encryptedPhone.authTag
          }
        ])
        .select()
        .single();

      if (userError) {
        console.error('Error creating user record:', userError);
        // Note: Auth user is already created, so we log but continue
      }

      // Log audit event
      await supabase
        .from('audit_logs')
        .insert([
          {
            user_id: authData.user.id,
            action: 'user_registered',
            resource_type: 'user',
            resource_id: authData.user.id,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
          }
        ]);

      return res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: {
            id: authData.user.id,
            email: authData.user.email,
            fullName: fullName
          },
          session: authData.session
        }
      });
    }

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
});

/**
 * POST /api/auth/login
 * Login existing user
 * 
 * Body:
 * - email: string (required)
 * - password: string (required)
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login time
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('user_id', data.user.id);

    // Log audit event
    await supabase
      .from('audit_logs')
      .insert([
        {
          user_id: data.user.id,
          action: 'user_login',
          resource_type: 'user',
          resource_id: data.user.id,
          ip_address: req.ip,
          user_agent: req.headers['user-agent']
        }
      ]);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: data.user.id,
          email: data.user.email
        },
        session: data.session
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout current user
 * Requires authentication
 */
router.post('/logout', authenticateUser, async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization.substring(7);

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut(token);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Log audit event
    await supabase
      .from('audit_logs')
      .insert([
        {
          user_id: req.userId,
          action: 'user_logout',
          resource_type: 'user',
          resource_id: req.userId,
          ip_address: req.ip,
          user_agent: req.headers['user-agent']
        }
      ]);

    return res.status(200).json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 * Requires authentication
 */
router.get('/me', authenticateUser, async (req, res) => {
  try {
    // Get user details from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, user_id, full_name, created_at, last_login, is_active')
      .eq('user_id', req.userId)
      .single();

    if (userError) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user preferences
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('language_code, language_name, theme')
      .eq('user_id', req.userId)
      .single();

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          fullName: userData.full_name,
          lastLogin: userData.last_login,
          isActive: userData.is_active,
          preferences: preferences || {}
        }
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user information'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        session: data.session
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh token'
    });
  }
});

module.exports = router;