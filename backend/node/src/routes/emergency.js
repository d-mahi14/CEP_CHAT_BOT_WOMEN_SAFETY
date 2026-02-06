// =====================================================
// EMERGENCY CONTACTS ROUTES
// =====================================================
// Handles CRUD operations for emergency contacts
// All data is encrypted before storage
// =====================================================

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { encrypt, decrypt } = require('../middleware/encryption');

/**
 * GET /api/emergency-contacts
 * Get all emergency contacts for current user
 * Requires authentication
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', req.userId)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Decrypt contact information
    const decryptedContacts = data.map(contact => {
      try {
        const contactName = decrypt(
          contact.contact_name_encrypted,
          contact.contact_name_iv,
          contact.contact_name_auth_tag
        );
        const phoneNumber = decrypt(
          contact.phone_number_encrypted,
          contact.phone_number_iv,
          contact.phone_number_auth_tag
        );

        return {
          id: contact.id,
          contactName,
          phoneNumber,
          relationship: contact.relationship,
          priority: contact.priority,
          email: contact.email,
          notes: contact.notes,
          isActive: contact.is_active,
          createdAt: contact.created_at,
          updatedAt: contact.updated_at
        };
      } catch (error) {
        console.error('Failed to decrypt contact:', error);
        return null;
      }
    }).filter(contact => contact !== null);

    return res.status(200).json({
      success: true,
      data: {
        contacts: decryptedContacts
      }
    });

  } catch (error) {
    console.error('Get emergency contacts error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get emergency contacts'
    });
  }
});

/**
 * POST /api/emergency-contacts
 * Add a new emergency contact
 * Requires authentication
 * 
 * Body:
 * - contactName: string (required)
 * - phoneNumber: string (required)
 * - relationship: string (required)
 * - priority: number (optional, auto-assigned if not provided)
 * - email: string (optional)
 * - notes: string (optional)
 */
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { contactName, phoneNumber, relationship, priority, email, notes } = req.body;

    // Validate required fields
    if (!contactName || !phoneNumber || !relationship) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: contactName, phoneNumber, relationship'
      });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // Get current contact count to determine priority
    let finalPriority = priority;
    if (!finalPriority) {
      const { count } = await supabase
        .from('emergency_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.userId)
        .eq('is_active', true);

      finalPriority = (count || 0) + 1;
    }

    // Encrypt contact name and phone number
    const encryptedName = encrypt(contactName);
    const encryptedPhone = encrypt(phoneNumber);

    // Insert new contact
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert([
        {
          user_id: req.userId,
          contact_name_encrypted: encryptedName.encrypted,
          contact_name_iv: encryptedName.iv,
          contact_name_auth_tag: encryptedName.authTag,
          phone_number_encrypted: encryptedPhone.encrypted,
          phone_number_iv: encryptedPhone.iv,
          phone_number_auth_tag: encryptedPhone.authTag,
          relationship,
          priority: finalPriority,
          email: email || null,
          notes: notes || null
        }
      ])
      .select()
      .single();

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
          action: 'emergency_contact_added',
          resource_type: 'emergency_contact',
          resource_id: data.id,
          metadata: { relationship, priority: finalPriority }
        }
      ]);

    // Return decrypted data
    return res.status(201).json({
      success: true,
      message: 'Emergency contact added successfully',
      data: {
        contact: {
          id: data.id,
          contactName,
          phoneNumber,
          relationship,
          priority: finalPriority,
          email: email || null,
          notes: notes || null,
          createdAt: data.created_at
        }
      }
    });

  } catch (error) {
    console.error('Add emergency contact error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add emergency contact'
    });
  }
});

/**
 * PUT /api/emergency-contacts/:id
 * Update an emergency contact
 * Requires authentication
 * 
 * Body:
 * - contactName: string (optional)
 * - phoneNumber: string (optional)
 * - relationship: string (optional)
 * - priority: number (optional)
 * - email: string (optional)
 * - notes: string (optional)
 */
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { contactName, phoneNumber, relationship, priority, email, notes } = req.body;

    // Verify contact belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from('emergency_contacts')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        error: 'Emergency contact not found'
      });
    }

    // Prepare update data
    const updates = {};
    if (relationship !== undefined) updates.relationship = relationship;
    if (priority !== undefined) updates.priority = priority;
    if (email !== undefined) updates.email = email;
    if (notes !== undefined) updates.notes = notes;

    // Encrypt new contact name if provided
    if (contactName !== undefined) {
      const encryptedName = encrypt(contactName);
      updates.contact_name_encrypted = encryptedName.encrypted;
      updates.contact_name_iv = encryptedName.iv;
      updates.contact_name_auth_tag = encryptedName.authTag;
    }

    // Encrypt new phone number if provided
    if (phoneNumber !== undefined) {
      const encryptedPhone = encrypt(phoneNumber);
      updates.phone_number_encrypted = encryptedPhone.encrypted;
      updates.phone_number_iv = encryptedPhone.iv;
      updates.phone_number_auth_tag = encryptedPhone.authTag;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    // Update contact
    const { data, error } = await supabase
      .from('emergency_contacts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single();

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
          action: 'emergency_contact_updated',
          resource_type: 'emergency_contact',
          resource_id: id,
          metadata: { updated_fields: Object.keys(updates) }
        }
      ]);

    // Decrypt and return data
    const decryptedData = {
      id: data.id,
      contactName: contactName || decrypt(data.contact_name_encrypted, data.contact_name_iv, data.contact_name_auth_tag),
      phoneNumber: phoneNumber || decrypt(data.phone_number_encrypted, data.phone_number_iv, data.phone_number_auth_tag),
      relationship: data.relationship,
      priority: data.priority,
      email: data.email,
      notes: data.notes,
      updatedAt: data.updated_at
    };

    return res.status(200).json({
      success: true,
      message: 'Emergency contact updated successfully',
      data: {
        contact: decryptedData
      }
    });

  } catch (error) {
    console.error('Update emergency contact error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update emergency contact'
    });
  }
});

/**
 * DELETE /api/emergency-contacts/:id
 * Delete an emergency contact (soft delete)
 * Requires authentication
 */
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify contact belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from('emergency_contacts')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        error: 'Emergency contact not found'
      });
    }

    // Soft delete (set is_active to false)
    const { error } = await supabase
      .from('emergency_contacts')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', req.userId);

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
          action: 'emergency_contact_deleted',
          resource_type: 'emergency_contact',
          resource_id: id
        }
      ]);

    return res.status(200).json({
      success: true,
      message: 'Emergency contact deleted successfully'
    });

  } catch (error) {
    console.error('Delete emergency contact error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete emergency contact'
    });
  }
});

/**
 * GET /api/emergency-contacts/:id
 * Get a specific emergency contact
 * Requires authentication
 */
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Emergency contact not found'
      });
    }

    // Decrypt contact information
    const contactName = decrypt(
      data.contact_name_encrypted,
      data.contact_name_iv,
      data.contact_name_auth_tag
    );
    const phoneNumber = decrypt(
      data.phone_number_encrypted,
      data.phone_number_iv,
      data.phone_number_auth_tag
    );

    return res.status(200).json({
      success: true,
      data: {
        contact: {
          id: data.id,
          contactName,
          phoneNumber,
          relationship: data.relationship,
          priority: data.priority,
          email: data.email,
          notes: data.notes,
          isActive: data.is_active,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Get emergency contact error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get emergency contact'
    });
  }
});

module.exports = router;