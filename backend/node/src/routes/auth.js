// =====================================================
// AUTH ROUTES — FIXED
// =====================================================
// FIX: Added skip_auth_signup flag to register endpoint.
//
// PROBLEM: Register.jsx (Step 1) was calling BOTH:
//   1. supabase.auth.signUp()   on the frontend
//   2. authAPI.register()       which called supabase.auth.signUp() AGAIN on the backend
//   → Result: "User already registered" error on Step 2
//
// FIX: When skip_auth_signup: true is sent in the body
//   (set by frontend after it already called signUp),
//   the backend skips the signUp call and only:
//     - Inserts into public.users (phone + full_name)
//     - Updates preferred language in user_preferences
//   It uses req.user.id from the Bearer token to identify the user.
//
// The emergency contacts are now saved directly from
// the frontend (Step 2) via POST /api/emergency-contacts.
// =====================================================

const express = require('express');
const router  = express.Router();
const { supabase }                         = require('../config/supabase');
const { encryptPhoneNumber, encrypt }      = require('../middleware/encryption');
const { authenticateUser }                 = require('../middleware/auth');

const LANG_NAMES = {
  hi: 'Hindi', ta: 'Tamil', te: 'Telugu', mr: 'Marathi',
  bn: 'Bengali', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
};

// ── POST /api/auth/register ───────────────────────
router.post('/register', async (req, res) => {
  try {
    const {
      email, password, fullName, full_name, phoneNumber, phone,
      emergency_contacts, preferred_language,
      // FIX: frontend sends this when it already called supabase.auth.signUp
      skip_auth_signup,
    } = req.body;

    const name   = (fullName  || full_name  || '').trim();
    const phone_ = (phoneNumber || phone    || '').trim();

    // ── PATH A: skip_auth_signup = true ────────────
    // Frontend already created the auth user. We just need to:
    //   1. Read userId from the Bearer token
    //   2. Insert into public.users
    //   3. Update language preference
    if (skip_auth_signup) {
      // Validate token and get user
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Missing authorization header' });
      }
      const token = authHeader.substring(7);
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
      }

      const userId = user.id;

      // Encrypt phone (if provided)
      let encPhone = { encrypted: '', iv: '', authTag: '' };
      if (phone_) {
        try { encPhone = encryptPhoneNumber(phone_); }
        catch (e) { console.error('Phone encrypt error:', e.message); }
      }

      // Upsert into public.users (handles trigger-already-ran case)
      const { error: userErr } = await supabase
        .from('users')
        .upsert({
          user_id:               userId,
          full_name:             name || user.user_metadata?.full_name || 'User',
          phone_number_encrypted: encPhone.encrypted,
          phone_number_iv:        encPhone.iv,
          phone_number_auth_tag:  encPhone.authTag,
        }, { onConflict: 'user_id' });

      if (userErr) console.error('users upsert error:', userErr.message);

      // Update language preference (trigger creates default row, we update it)
      if (preferred_language && preferred_language !== 'en') {
        await supabase
          .from('user_preferences')
          .upsert({
            user_id:       userId,
            language_code: preferred_language,
            language_name: LANG_NAMES[preferred_language] || 'English',
          }, { onConflict: 'user_id' });
      }

      // Audit log
      await supabase.from('audit_logs').insert([{
        user_id:       userId,
        action:        'user_registered',
        resource_type: 'user',
        resource_id:   userId,
        ip_address:    req.ip,
        user_agent:    req.headers['user-agent'],
      }]);

      return res.status(201).json({
        success: true,
        message: 'User profile created',
        data: { user: { id: userId, email: user.email, fullName: name } },
      });
    }

    // ── PATH B: legacy full registration (no skip flag) ──
    // Only used if frontend does NOT call signUp itself.
    if (!email || !password || !name || !phone_) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, fullName/full_name, phoneNumber/phone',
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
        error: 'Password must be at least 8 characters with 1 uppercase letter and 1 number',
      });
    }

    const encPhone = encryptPhoneNumber(phone_);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (authError) {
      return res.status(400).json({ success: false, error: authError.message });
    }

    if (authData.user) {
      const userId = authData.user.id;

      const { error: userError } = await supabase
        .from('users')
        .upsert({
          user_id:               userId,
          full_name:             name,
          phone_number_encrypted: encPhone.encrypted,
          phone_number_iv:        encPhone.iv,
          phone_number_auth_tag:  encPhone.authTag,
        }, { onConflict: 'user_id' });

      if (userError) console.error('Error creating user record:', userError.message);

      if (preferred_language && preferred_language !== 'en') {
        await supabase
          .from('user_preferences')
          .upsert({
            user_id:       userId,
            language_code: preferred_language,
            language_name: LANG_NAMES[preferred_language] || 'English',
          }, { onConflict: 'user_id' });
      }

      // Save emergency contacts if provided in body (legacy path)
      if (emergency_contacts?.length > 0) {
        const contactRows = emergency_contacts
          .filter(c => c.name && c.phone)
          .map((c, i) => {
            const encName  = encrypt(c.name);
            const encPhone2 = encrypt(c.phone);
            return {
              user_id:                userId,
              contact_name_encrypted: encName.encrypted,
              contact_name_iv:        encName.iv,
              contact_name_auth_tag:  encName.authTag,
              phone_number_encrypted: encPhone2.encrypted,
              phone_number_iv:        encPhone2.iv,
              phone_number_auth_tag:  encPhone2.authTag,
              relationship:           c.relationship || 'Emergency Contact',
              priority:               c.priority || (i + 1),
            };
          });

        if (contactRows.length > 0) {
          const { error: contactErr } = await supabase
            .from('emergency_contacts')
            .insert(contactRows);
          if (contactErr) console.error('Error saving contacts:', contactErr.message);
        }
      }

      await supabase.from('audit_logs').insert([{
        user_id:       userId,
        action:        'user_registered',
        resource_type: 'user',
        resource_id:   userId,
        ip_address:    req.ip,
        user_agent:    req.headers['user-agent'],
      }]);

      return res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user:    { id: userId, email: authData.user.email, fullName: name },
          session: authData.session,
        },
      });
    }

    return res.status(400).json({ success: false, error: 'Registration failed' });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ success: false, error: 'Invalid email or password' });

    // Update last_login (upsert in case users row is missing)
    await supabase
      .from('users')
      .upsert({ user_id: data.user.id, last_login: new Date().toISOString() }, { onConflict: 'user_id' });

    await supabase.from('audit_logs').insert([{
      user_id: data.user.id, action: 'user_login',
      resource_type: 'user', resource_id: data.user.id,
      ip_address: req.ip, user_agent: req.headers['user-agent'],
    }]);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: { id: data.user.id, email: data.user.email }, session: data.session },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────
router.post('/logout', authenticateUser, async (req, res) => {
  try {
    const token = req.headers.authorization.substring(7);
    const { error } = await supabase.auth.signOut(token);
    if (error) return res.status(400).json({ success: false, error: error.message });

    await supabase.from('audit_logs').insert([{
      user_id: req.userId, action: 'user_logout',
      resource_type: 'user', resource_id: req.userId,
      ip_address: req.ip, user_agent: req.headers['user-agent'],
    }]);

    return res.status(200).json({ success: true, message: 'Logout successful' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

// ── GET /api/auth/me ──────────────────────────────
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('id, user_id, full_name, created_at, last_login, is_active')
      .eq('user_id', req.userId)
      .maybeSingle();

    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('language_code, language_name, theme')
      .eq('user_id', req.userId)
      .maybeSingle();

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id:          req.user.id,
          email:       req.user.email,
          fullName:    userData?.full_name || null,
          lastLogin:   userData?.last_login || null,
          isActive:    userData?.is_active ?? true,
          preferences: preferences || {},
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to get user information' });
  }
});

// ── POST /api/auth/refresh ────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ success: false, error: 'Refresh token required' });

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });

    return res.status(200).json({ success: true, data: { session: data.session } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to refresh token' });
  }
});

module.exports = router;