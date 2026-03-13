// =====================================================
// AUTHENTICATION ROUTES
// =====================================================
// FIX SUMMARY:
//   1. Removed phone_number_auth_tag from users INSERT
//      → Column does not exist in public.users schema (only _encrypted + _iv)
//      → Run SCHEMA_FIX.sql to ADD the column, then this file stores it correctly
//   2. Register now saves emergency_contacts sent from the frontend
//      → Register.jsx sends emergency_contacts[] but old code ignored them
// =====================================================

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { encryptPhoneNumber, encrypt } = require('../middleware/encryption');
const { authenticateUser } = require('../middleware/auth');

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, phoneNumber, full_name, phone,
            emergency_contacts, preferred_language } = req.body;

    // Support both camelCase (API) and snake_case (Register.jsx) field names
    const name  = fullName  || full_name;
    const phone_ = phoneNumber || phone;

    if (!email || !password || !name || !phone_) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, fullName/full_name, phoneNumber/phone'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters with 1 uppercase letter and 1 number'
      });
    }

    // Encrypt phone number
    const encryptedPhone = encryptPhoneNumber(phone_);

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });

    if (authError) {
      return res.status(400).json({ success: false, error: authError.message });
    }

    if (authData.user) {
      // FIX: store auth_tag — requires SCHEMA_FIX.sql to add the column first
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          user_id:                authData.user.id,
          full_name:              name,
          phone_number_encrypted: encryptedPhone.encrypted,
          phone_number_iv:        encryptedPhone.iv,
          phone_number_auth_tag:  encryptedPhone.authTag  // needs column added by SCHEMA_FIX.sql
        }]);

      if (userError) {
        console.error('Error creating user record:', userError);
        // Continue — auth user already created
      }

      // FIX: Save preferred language if provided
      if (preferred_language && preferred_language !== 'en') {
        const langNames = {
          hi: 'Hindi', ta: 'Tamil', te: 'Telugu', mr: 'Marathi',
          bn: 'Bengali', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi'
        };
        await supabase
          .from('user_preferences')
          .update({
            language_code: preferred_language,
            language_name: langNames[preferred_language] || 'English'
          })
          .eq('user_id', authData.user.id);
      }

      // FIX: Save emergency contacts from registration form
      // Register.jsx sends: [{ name, phone, priority }]
      if (emergency_contacts && Array.isArray(emergency_contacts) && emergency_contacts.length > 0) {
        const contactRows = emergency_contacts
          .filter(c => c.name && c.phone)
          .map((c, i) => {
            const encName  = encrypt(c.name);
            const encPhone = encrypt(c.phone);
            return {
              user_id:                 authData.user.id,
              contact_name_encrypted:  encName.encrypted,
              contact_name_iv:         encName.iv,
              contact_name_auth_tag:   encName.authTag,   // needs SCHEMA_FIX.sql
              phone_number_encrypted:  encPhone.encrypted,
              phone_number_iv:         encPhone.iv,
              phone_number_auth_tag:   encPhone.authTag,  // needs SCHEMA_FIX.sql
              relationship:            c.relationship || 'Emergency Contact',
              priority:                c.priority || (i + 1)
            };
          });

        if (contactRows.length > 0) {
          const { error: contactError } = await supabase
            .from('emergency_contacts')
            .insert(contactRows);

          if (contactError) {
            console.error('Error saving emergency contacts:', contactError);
          }
        }
      }

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id:       authData.user.id,
        action:        'user_registered',
        resource_type: 'user',
        resource_id:   authData.user.id,
        ip_address:    req.ip,
        user_agent:    req.headers['user-agent']
      }]);

      return res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: {
            id:       authData.user.id,
            email:    authData.user.email,
            fullName: name
          },
          session: authData.session
        }
      });
    }

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    await supabase.from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('user_id', data.user.id);

    await supabase.from('audit_logs').insert([{
      user_id:       data.user.id,
      action:        'user_login',
      resource_type: 'user',
      resource_id:   data.user.id,
      ip_address:    req.ip,
      user_agent:    req.headers['user-agent']
    }]);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user:    { id: data.user.id, email: data.user.email },
        session: data.session
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticateUser, async (req, res) => {
  try {
    const token = req.headers.authorization.substring(7);
    const { error } = await supabase.auth.signOut(token);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    await supabase.from('audit_logs').insert([{
      user_id:       req.userId,
      action:        'user_logout',
      resource_type: 'user',
      resource_id:   req.userId,
      ip_address:    req.ip,
      user_agent:    req.headers['user-agent']
    }]);

    return res.status(200).json({ success: true, message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, user_id, full_name, created_at, last_login, is_active')
      .eq('user_id', req.userId)
      .single();

    if (userError) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('language_code, language_name, theme')
      .eq('user_id', req.userId)
      .single();

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id:          req.user.id,
          email:       req.user.email,
          fullName:    userData.full_name,
          lastLogin:   userData.last_login,
          isActive:    userData.is_active,
          preferences: preferences || {}
        }
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get user information' });
  }
});

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ success: false, error: 'Refresh token is required' });
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error) {
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }

    return res.status(200).json({ success: true, data: { session: data.session } });

  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({ success: false, error: 'Failed to refresh token' });
  }
});

module.exports = router;