// =====================================================
// PROFILE ROUTES — FIXED
// =====================================================
// ROOT CAUSE OF CURRENT BUG (screenshot):
//   PUT / does: supabase.from('users').upsert({ user_id, full_name })
//   When the users row is MISSING, upsert = INSERT.
//   INSERT leaves phone_number_encrypted = NULL which
//   violates the NOT NULL constraint → 500 error shown
//   as "null value in column phone_number_encrypted..."
//
// FIX: Always include phone fields in the upsert payload.
//   - If a new phoneNumber was sent in the request body,
//     encrypt it and include all 3 fields.
//   - If no phone sent AND row already exists, use an
//     UPDATE-only query (skip upsert of phone fields).
//   - If no phone sent AND row is new (missing), use ''
//     as a safe NOT-NULL default so INSERT succeeds.
//
// ALSO: added phoneNumber to the list of accepted fields
//   so the frontend phone input actually saves to DB.
// =====================================================

const express = require('express');
const router  = express.Router();
const { supabase }                                      = require('../config/supabase');
const { authenticateUser }                              = require('../middleware/auth');
const { decryptPhoneNumber, encryptPhoneNumber }        = require('../middleware/encryption');

// ── GET /api/profile ─────────────────────────────
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { data: userData } = await supabase
      .from('users')
      .select(
        'id, user_id, full_name, is_active, last_login, created_at,' +
        'phone_number_encrypted, phone_number_iv, phone_number_auth_tag'
      )
      .eq('user_id', req.userId)
      .maybeSingle();

    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', req.userId)
      .maybeSingle();

    // Auto-create preferences if missing
    let { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', req.userId)
      .maybeSingle();

    if (!preferences) {
      const { data: created } = await supabase
        .from('user_preferences')
        .upsert(
          { user_id: req.userId, language_code: 'en', language_name: 'English' },
          { onConflict: 'user_id' }
        )
        .select()
        .single();
      preferences = created || { language_code: 'en', language_name: 'English' };
    }

    // Decrypt phone — only if all 3 fields present and non-empty
    let phoneNumber = null;
    if (
      userData?.phone_number_encrypted &&
      userData?.phone_number_iv &&
      userData?.phone_number_auth_tag &&
      userData.phone_number_encrypted !== ''
    ) {
      try {
        phoneNumber = decryptPhoneNumber(
          userData.phone_number_encrypted,
          userData.phone_number_iv,
          userData.phone_number_auth_tag
        );
      } catch (err) {
        console.error('Phone decrypt error:', err.message);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id:          req.userId,
          email:       req.user?.email || null,
          fullName:    userData?.full_name  || null,
          phoneNumber,
          isActive:    userData?.is_active  ?? true,
          lastLogin:   userData?.last_login || null,
          createdAt:   userData?.created_at || null,
        },
        profile:     profileData  || {},
        preferences: preferences  || {},
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

// ── PUT /api/profile ──────────────────────────────
router.put('/', authenticateUser, async (req, res) => {
  try {
    const {
      fullName, phoneNumber,              // users table fields
      bio, location, dateOfBirth,         // user_profiles fields
      gender, bloodGroup, medicalConditions, allergies, avatarUrl,
    } = req.body;

    let didSomething = false;

    // ── Update public.users ──────────────────────
    // Only touch this table if fullName or phoneNumber was provided
    if ((fullName !== undefined && fullName.trim()) || phoneNumber !== undefined) {

      // Check if the row already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('user_id, phone_number_encrypted')
        .eq('user_id', req.userId)
        .maybeSingle();

      const usersPayload = { user_id: req.userId };

      if (fullName !== undefined && fullName.trim()) {
        usersPayload.full_name = fullName.trim();
      }

      if (phoneNumber !== undefined && phoneNumber.trim()) {
        // Encrypt the new phone number
        try {
          const enc = encryptPhoneNumber(phoneNumber.trim());
          usersPayload.phone_number_encrypted = enc.encrypted;
          usersPayload.phone_number_iv        = enc.iv;
          usersPayload.phone_number_auth_tag  = enc.authTag;
        } catch (encErr) {
          console.error('Phone encrypt error:', encErr.message);
          return res.status(400).json({ success: false, error: 'Failed to encrypt phone number.' });
        }
      } else if (!existingUser) {
        // FIX: Row doesn't exist yet → upsert = INSERT → must satisfy NOT NULL.
        // Use empty string as safe default so INSERT succeeds.
        // User can add a real phone number later.
        usersPayload.phone_number_encrypted = '';
        usersPayload.phone_number_iv        = '';
        usersPayload.phone_number_auth_tag  = '';
      }
      // If existingUser exists and no new phone → don't touch phone columns at all
      // (partial upsert only updates the columns we include)

      const { error: usersErr } = await supabase
        .from('users')
        .upsert(usersPayload, { onConflict: 'user_id' });

      if (usersErr) {
        console.error('users upsert error:', usersErr.message);
        return res.status(400).json({ success: false, error: usersErr.message });
      }
      didSomething = true;
    }

    // ── Update public.user_profiles ──────────────
    const profileUpdate = {};
    if (bio               !== undefined) profileUpdate.bio                = bio;
    if (location          !== undefined) profileUpdate.location           = location;
    if (dateOfBirth       !== undefined) profileUpdate.date_of_birth      = dateOfBirth || null;
    if (gender            !== undefined) profileUpdate.gender             = gender;
    if (bloodGroup        !== undefined) profileUpdate.blood_group        = bloodGroup;
    if (medicalConditions !== undefined) profileUpdate.medical_conditions = medicalConditions;
    if (allergies         !== undefined) profileUpdate.allergies          = allergies;
    if (avatarUrl         !== undefined) profileUpdate.avatar_url         = avatarUrl;

    let profileData = null;

    if (Object.keys(profileUpdate).length > 0) {
      const { data, error: profileErr } = await supabase
        .from('user_profiles')
        .upsert(
          { user_id: req.userId, ...profileUpdate },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (profileErr) {
        console.error('user_profiles upsert error:', profileErr.message);
        return res.status(400).json({ success: false, error: profileErr.message });
      }
      profileData = data;
      didSomething = true;
    }

    if (!didSomething) {
      return res.status(400).json({ success: false, error: 'No fields provided to update.' });
    }

    // Audit log
    await supabase.from('audit_logs').insert([{
      user_id:       req.userId,
      action:        'profile_updated',
      resource_type: 'user_profile',
      resource_id:   req.userId,
      metadata: {
        updated_fields: [
          ...(fullName    ? ['full_name']    : []),
          ...(phoneNumber ? ['phone_number'] : []),
          ...Object.keys(profileUpdate),
        ],
      },
    }]);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { profile: profileData || {} },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// ── GET /api/profile/preferences ─────────────────
router.get('/preferences', authenticateUser, async (req, res) => {
  try {
    let { data } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', req.userId)
      .maybeSingle();

    if (!data) {
      const { data: created } = await supabase
        .from('user_preferences')
        .upsert(
          { user_id: req.userId, language_code: 'en', language_name: 'English' },
          { onConflict: 'user_id' }
        )
        .select()
        .single();
      data = created;
    }

    return res.status(200).json({ success: true, data: { preferences: data || {} } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to get preferences' });
  }
});

// ── PUT /api/profile/preferences ─────────────────
router.put('/preferences', authenticateUser, async (req, res) => {
  try {
    const {
      languageCode, languageName,
      notificationEnabled, locationSharingEnabled,
      emergencyAlertSound, dataSharingConsent,
      analyticsConsent, marketingConsent,
      theme, timezone,
    } = req.body;

    const updates = {};
    if (languageCode           !== undefined) updates.language_code            = languageCode;
    if (languageName           !== undefined) updates.language_name            = languageName;
    if (notificationEnabled    !== undefined) updates.notification_enabled     = notificationEnabled;
    if (locationSharingEnabled !== undefined) updates.location_sharing_enabled = locationSharingEnabled;
    if (emergencyAlertSound    !== undefined) updates.emergency_alert_sound    = emergencyAlertSound;
    if (dataSharingConsent     !== undefined) updates.data_sharing_consent     = dataSharingConsent;
    if (analyticsConsent       !== undefined) updates.analytics_consent        = analyticsConsent;
    if (marketingConsent       !== undefined) updates.marketing_consent        = marketingConsent;
    if (theme                  !== undefined) updates.theme                    = theme;
    if (timezone               !== undefined) updates.timezone                 = timezone;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(
        { user_id: req.userId, ...updates },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    // Log consent changes
    for (const [field, consentType] of [
      ['dataSharingConsent', 'data_sharing'],
      ['analyticsConsent',   'analytics'],
      ['marketingConsent',   'marketing'],
    ]) {
      if (req.body[field] !== undefined) {
        await supabase.from('privacy_consents').insert([{
          user_id:       req.userId,
          consent_type:  consentType,
          consent_given: req.body[field],
          ip_address:    req.ip,
          user_agent:    req.headers['user-agent'],
        }]);
      }
    }

    await supabase.from('audit_logs').insert([{
      user_id:       req.userId,
      action:        'preferences_updated',
      resource_type: 'user_preferences',
      resource_id:   req.userId,
      metadata:      { updated_fields: Object.keys(updates) },
    }]);

    return res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences: data },
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

// ── GET /api/profile/languages ────────────────────
router.get('/languages', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('supported_languages')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, data: { languages: data } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to get languages' });
  }
});

module.exports = router;