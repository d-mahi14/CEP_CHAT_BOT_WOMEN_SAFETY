// =====================================================
// ENCRYPTION UTILITIES
// =====================================================
// Provides AES-256-GCM encryption for sensitive data
// Used for encrypting phone numbers and emergency contacts
// =====================================================

const crypto = require('crypto');
require('dotenv').config();

// Validate encryption key
if (!process.env.ENCRYPTION_KEY) {
  throw new Error('Missing ENCRYPTION_KEY environment variable');
}

// Convert hex string to buffer
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

// Validate key length (must be 32 bytes for AES-256)
if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16 bytes
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a string using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {Object} - { encrypted: string, iv: string, authTag: string }
 */
function encrypt(text) {
  try {
    // Generate random IV (Initialization Vector)
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string using AES-256-GCM
 * @param {string} encrypted - Encrypted text in hex
 * @param {string} ivHex - IV in hex
 * @param {string} authTagHex - Auth tag in hex
 * @returns {string} - Decrypted plain text
 */
function decrypt(encrypted, ivHex, authTagHex) {
  try {
    // Convert hex strings to buffers
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt phone number for storage
 * @param {string} phoneNumber - Phone number to encrypt
 * @returns {Object} - { encrypted: string, iv: string }
 */
function encryptPhoneNumber(phoneNumber) {
  const result = encrypt(phoneNumber);
  return {
    encrypted: result.encrypted,
    iv: result.iv,
    authTag: result.authTag
  };
}

/**
 * Decrypt phone number from storage
 * @param {string} encrypted - Encrypted phone number
 * @param {string} iv - Initialization vector
 * @param {string} authTag - Authentication tag
 * @returns {string} - Decrypted phone number
 */
function decryptPhoneNumber(encrypted, iv, authTag) {
  return decrypt(encrypted, iv, authTag);
}

/**
 * Hash a string using SHA-256 (for non-reversible hashing)
 * @param {string} text - Text to hash
 * @returns {string} - Hex hash
 */
function hash(text) {
  return crypto
    .createHash('sha256')
    .update(text)
    .digest('hex');
}

/**
 * Generate a secure random token
 * @param {number} length - Length in bytes
 * @returns {string} - Hex token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Middleware to decrypt sensitive fields in response
 * Automatically decrypts fields ending with _encrypted
 */
function decryptMiddleware(req, res, next) {
  // Store original json method
  const originalJson = res.json.bind(res);
  
  // Override json method
  res.json = function(data) {
    // Decrypt data if needed
    if (data && typeof data === 'object') {
      decryptObject(data);
    }
    
    // Call original json method
    return originalJson(data);
  };
  
  next();
}

/**
 * Recursively decrypt object fields
 * @param {Object} obj - Object to decrypt
 */
function decryptObject(obj) {
  if (!obj || typeof obj !== 'object') return;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    obj.forEach(item => decryptObject(item));
    return;
  }
  
  // Handle objects
  Object.keys(obj).forEach(key => {
    // Check if this is an encrypted field
    if (key.endsWith('_encrypted') && obj[key]) {
      const baseKey = key.replace('_encrypted', '');
      const ivKey = baseKey + '_iv';
      const authTagKey = baseKey + '_auth_tag';
      
      // Only decrypt if we have all required fields
      if (obj[ivKey] && obj[authTagKey]) {
        try {
          // Decrypt the value
          obj[baseKey] = decrypt(obj[key], obj[ivKey], obj[authTagKey]);
          
          // Remove encrypted fields from response
          delete obj[key];
          delete obj[ivKey];
          delete obj[authTagKey];
        } catch (error) {
          console.error(`Failed to decrypt ${key}:`, error.message);
        }
      }
    } else if (typeof obj[key] === 'object') {
      // Recursively decrypt nested objects
      decryptObject(obj[key]);
    }
  });
}

module.exports = {
  encrypt,
  decrypt,
  encryptPhoneNumber,
  decryptPhoneNumber,
  hash,
  generateToken,
  decryptMiddleware
};