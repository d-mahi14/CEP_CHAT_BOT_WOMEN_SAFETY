// =====================================================
// PROFILE ROUTES
// =====================================================
// Handles user profile management and preferences
// =====================================================

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { decryptPhoneNumber } = require('../middleware/encryption');

/**
 * GET /api/profile
 * Get user profile information
 * Requires authentication
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    // Get basic user info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (userError) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get profile data
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    // Get preferences
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    // Decrypt phone number
    let phoneNumber = null;
    if (userData.phone_number_encrypted && userData.phone_number_iv) {
      try {
        phoneNumber = decryptPhoneNumber(
          userData.phone_number_encrypted,
          userData.phone_number_iv,
          userData.phone_number_auth_tag
        );
      } catch (error) {
        console.error('Failed to decrypt phone number:', error);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.userId,
          email: req.user.email,
          fullName: userData.full_name,
          phoneNumber: phoneNumber,
          isActive: userData.is_active,
          lastLogin: userData.last_login,
          createdAt: userData.created_at
        },
        profile: profileData || {},
        preferences: preferences || {}
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
});

/**
 * PUT /api/profile
 * Update user profile
 * Requires authentication
 * 
 * Body:
 * - fullName: string (optional)
 * - bio: string (optional)
 * - location: string (optional)
 * - dateOfBirth: string (optional)
 * - gender: string (optional)
 * - bloodGroup: string (optional)
 * - medicalConditions: array (optional)
 * - allergies: array (optional)
 */
router.put('/', authenticateUser, async (req, res) => {
  try {
    const {
      fullName,
      bio,
      location,
      dateOfBirth,
      gender,
      bloodGroup,
      medicalConditions,
      allergies,
      avatarUrl
    } = req.body;

    // Update users table if fullName is provided
    if (fullName) {
      const { error: userError } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('user_id', req.userId);

      if (userError) {
        console.error('Error updating user:', userError);
      }
    }

    // Prepare profile update data
    const profileUpdate = {};
    if (bio !== undefined) profileUpdate.bio = bio;
    if (location !== undefined) profileUpdate.location = location;
    if (dateOfBirth !== undefined) profileUpdate.date_of_birth = dateOfBirth;
    if (gender !== undefined) profileUpdate.gender = gender;
    if (bloodGroup !== undefined) profileUpdate.blood_group = bloodGroup;
    if (medicalConditions !== undefined) profileUpdate.medical_conditions = medicalConditions;
    if (allergies !== undefined) profileUpdate.allergies = allergies;
    if (avatarUrl !== undefined) profileUpdate.avatar_url = avatarUrl;

    // Update profile
    if (Object.keys(profileUpdate).length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .update(profileUpdate)
        .eq('user_id', req.userId)
        .select()
        .single();

      if (profileError) {
        return res.status(400).json({
          success: false,
          error: profileError.message
        });
      }

      // Log audit event
      await supabase
        .from('audit_logs')
        .insert([
          {
            user_id: req.userId,
            action: 'profile_updated',
            resource_type: 'user_profile',
            resource_id: req.userId,
            metadata: { updated_fields: Object.keys(profileUpdate) }
          }
        ]);

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          profile: profileData
        }
      });
    }

    return res.status(400).json({
      success: false,
      error: 'No fields to update'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * GET /api/profile/preferences
 * Get user preferences
 * Requires authentication
 */
router.get('/preferences', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Preferences not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        preferences: data
      }
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get preferences'
    });
  }
});

/**
 * PUT /api/profile/preferences
 * Update user preferences
 * Requires authentication
 * 
 * Body:
 * - languageCode: string (optional)
 * - languageName: string (optional)
 * - notificationEnabled: boolean (optional)
 * - locationSharingEnabled: boolean (optional)
 * - emergencyAlertSound: boolean (optional)
 * - dataSharingConsent: boolean (optional)
 * - analyticsConsent: boolean (optional)
 * - marketingConsent: boolean (optional)
 * - theme: string (optional)
 * - timezone: string (optional)
 */
router.put('/preferences', authenticateUser, async (req, res) => {
  try {
    const {
      languageCode,
      languageName,
      notificationEnabled,
      locationSharingEnabled,
      emergencyAlertSound,
      dataSharingConsent,
      analyticsConsent,
      marketingConsent,
      theme,
      timezone
    } = req.body;

    // Prepare update data
    const updates = {};
    if (languageCode !== undefined) updates.language_code = languageCode;
    if (languageName !== undefined) updates.language_name = languageName;
    if (notificationEnabled !== undefined) updates.notification_enabled = notificationEnabled;
    if (locationSharingEnabled !== undefined) updates.location_sharing_enabled = locationSharingEnabled;
    if (emergencyAlertSound !== undefined) updates.emergency_alert_sound = emergencyAlertSound;
    if (dataSharingConsent !== undefined) updates.data_sharing_consent = dataSharingConsent;
    if (analyticsConsent !== undefined) updates.analytics_consent = analyticsConsent;
    if (marketingConsent !== undefined) updates.marketing_consent = marketingConsent;
    if (theme !== undefined) updates.theme = theme;
    if (timezone !== undefined) updates.timezone = timezone;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    // Update preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .update(updates)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Log consent changes
    const consentFields = ['dataSharingConsent', 'analyticsConsent', 'marketingConsent'];
    for (const field of consentFields) {
      if (req.body[field] !== undefined) {
        const consentType = field.replace('Consent', '').replace(/([A-Z])/g, '_$1').toLowerCase();
        
        await supabase
          .from('privacy_consents')
          .insert([
            {
              user_id: req.userId,
              consent_type: consentType,
              consent_given: req.body[field],
              ip_address: req.ip,
              user_agent: req.headers['user-agent']
            }
          ]);
      }
    }

    // Log audit event
    await supabase
      .from('audit_logs')
      .insert([
        {
          user_id: req.userId,
          action: 'preferences_updated',
          resource_type: 'user_preferences',
          resource_id: req.userId,
          metadata: { updated_fields: Object.keys(updates) }
        }
      ]);

    return res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        preferences: data
      }
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update preferences'
    });
  }
});

/**
 * GET /api/profile/languages
 * Get available languages
 */
router.get('/languages', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('supported_languages')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        languages: data
      }
    });

  } catch (error) {
    console.error('Get languages error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get languages'
    });
  }
});

module.exports = router;