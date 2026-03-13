// =====================================================
// ENCRYPTION UTILITIES
// =====================================================
// FIX SUMMARY:
//   1. IV_LENGTH changed from 16 → 12 (GCM standard; also matches Python side)
//      The old 16-byte IV worked for encryption but mismatched the FastAPI
//      Python side which used 12 bytes — cross-service decryption would fail.
//   2. No other changes needed here, but READ the DB schema fix below:
//      The users and emergency_contacts tables are missing *_auth_tag columns.
//      Run the SQL in SCHEMA_FIX.sql (provided separately) to add them.
// =====================================================

const crypto = require('crypto');
require('dotenv').config();

if (!process.env.ENCRYPTION_KEY) {
  throw new Error('Missing ENCRYPTION_KEY environment variable');
}

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // FIX: GCM standard is 12 bytes (was incorrectly 16)
                      // This also makes Node.js match the Python/FastAPI side

/**
 * Encrypt a string using AES-256-GCM
 * @returns {{ encrypted: string, iv: string, authTag: string }}
 */
function encrypt(text) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted,
      iv:        iv.toString('hex'),
      authTag:   authTag.toString('hex')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string using AES-256-GCM
 * @param {string} encrypted - hex ciphertext
 * @param {string} ivHex     - hex IV
 * @param {string} authTagHex - hex auth tag
 */
function decrypt(encrypted, ivHex, authTagHex) {
  try {
    const iv      = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

function encryptPhoneNumber(phoneNumber) {
  return encrypt(phoneNumber);
}

function decryptPhoneNumber(encrypted, iv, authTag) {
  return decrypt(encrypted, iv, authTag);
}

function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function decryptMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (data && typeof data === 'object') decryptObject(data);
    return originalJson(data);
  };
  next();
}

function decryptObject(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { obj.forEach(item => decryptObject(item)); return; }

  Object.keys(obj).forEach(key => {
    if (key.endsWith('_encrypted') && obj[key]) {
      const baseKey    = key.replace('_encrypted', '');
      const ivKey      = baseKey + '_iv';
      const authTagKey = baseKey + '_auth_tag';

      if (obj[ivKey] && obj[authTagKey]) {
        try {
          obj[baseKey] = decrypt(obj[key], obj[ivKey], obj[authTagKey]);
          delete obj[key];
          delete obj[ivKey];
          delete obj[authTagKey];
        } catch (error) {
          console.error(`Failed to decrypt ${key}:`, error.message);
        }
      }
    } else if (typeof obj[key] === 'object') {
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