// =====================================================
// PROFILE ROUTES — FIXED
// =====================================================
// FIX: decryptPhoneNumber() was called with only 2 args;
//      the 3rd arg (auth_tag) was undefined because
//      the SELECT query never fetched phone_number_auth_tag.
//
//      Changes:
//        - SELECT query now includes phone_number_auth_tag
//        - decryptPhoneNumber(encrypted, iv, authTag) — all 3 args passed
// =====================================================

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { decryptPhoneNumber } = require('../middleware/encryption');

// ── GET /api/profile ─────────────────────────────
router.get('/', authenticateUser, async (req, res) => {
  try {
    // FIX: include phone_number_auth_tag in SELECT
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(
        'id, user_id, full_name, is_active, last_login, created_at, ' +
        'phone_number_encrypted, phone_number_iv, phone_number_auth_tag'
      )
      .eq('user_id', req.userId)
      .single();

    if (userError) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    // FIX: pass all 3 args — encrypted, iv, authTag
    let phoneNumber = null;
    if (userData.phone_number_encrypted && userData.phone_number_iv && userData.phone_number_auth_tag) {
      try {
        phoneNumber = decryptPhoneNumber(
          userData.phone_number_encrypted,
          userData.phone_number_iv,
          userData.phone_number_auth_tag   // ← was missing / undefined before
        );
      } catch (err) {
        console.error('Failed to decrypt phone number:', err.message);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.userId,
          email: req.user.email,
          fullName: userData.full_name,
          phoneNumber,
          isActive: userData.is_active,
          lastLogin: userData.last_login,
          createdAt: userData.created_at,
        },
        profile: profileData || {},
        preferences: preferences || {},
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
      fullName, bio, location, dateOfBirth, gender,
      bloodGroup, medicalConditions, allergies, avatarUrl,
    } = req.body;

    if (fullName) {
      await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('user_id', req.userId);
    }

    const profileUpdate = {};
    if (bio           !== undefined) profileUpdate.bio                = bio;
    if (location      !== undefined) profileUpdate.location           = location;
    if (dateOfBirth   !== undefined) profileUpdate.date_of_birth      = dateOfBirth;
    if (gender        !== undefined) profileUpdate.gender             = gender;
    if (bloodGroup    !== undefined) profileUpdate.blood_group        = bloodGroup;
    if (medicalConditions !== undefined) profileUpdate.medical_conditions = medicalConditions;
    if (allergies     !== undefined) profileUpdate.allergies          = allergies;
    if (avatarUrl     !== undefined) profileUpdate.avatar_url         = avatarUrl;

    if (Object.keys(profileUpdate).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .update(profileUpdate)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (profileError) {
      return res.status(400).json({ success: false, error: profileError.message });
    }

    await supabase.from('audit_logs').insert([{
      user_id: req.userId,
      action: 'profile_updated',
      resource_type: 'user_profile',
      resource_id: req.userId,
      metadata: { updated_fields: Object.keys(profileUpdate) },
    }]);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { profile: profileData },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// ── GET /api/profile/preferences ─────────────────
router.get('/preferences', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (error) return res.status(404).json({ success: false, error: 'Preferences not found' });

    return res.status(200).json({ success: true, data: { preferences: data } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to get preferences' });
  }
});

// ── PUT /api/profile/preferences ─────────────────
router.put('/preferences', authenticateUser, async (req, res) => {
  try {
    const {
      languageCode, languageName, notificationEnabled,
      locationSharingEnabled, emergencyAlertSound,
      dataSharingConsent, analyticsConsent, marketingConsent,
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
      .update(updates)
      .eq('user_id', req.userId)
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
          user_id: req.userId,
          consent_type: consentType,
          consent_given: req.body[field],
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
        }]);
      }
    }

    await supabase.from('audit_logs').insert([{
      user_id: req.userId,
      action: 'preferences_updated',
      resource_type: 'user_preferences',
      resource_id: req.userId,
      metadata: { updated_fields: Object.keys(updates) },
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
router.get('/languages', async (req, res) => {
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