# =====================================================
# ENCRYPTION UTILITIES - FASTAPI
# =====================================================
# AES-256-GCM encryption for sensitive data
# Compatible with Node.js encryption
# =====================================================

import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend
from app.config import settings

# Convert hex key to bytes
ENCRYPTION_KEY = bytes.fromhex(settings.ENCRYPTION_KEY)

# Validate key length
if len(ENCRYPTION_KEY) != 32:
    raise ValueError('ENCRYPTION_KEY must be 32 bytes (64 hex characters)')

def encrypt(plaintext: str) -> dict:
    """
    Encrypt a string using AES-256-GCM
    
    Args:
        plaintext: String to encrypt
        
    Returns:
        Dictionary with encrypted data, iv, and auth_tag
    """
    try:
        # Generate random IV (nonce)
        iv = os.urandom(12)  # GCM standard nonce size is 12 bytes
        
        # Create cipher
        aesgcm = AESGCM(ENCRYPTION_KEY)
        
        # Encrypt (returns ciphertext with tag appended)
        ciphertext_with_tag = aesgcm.encrypt(iv, plaintext.encode('utf-8'), None)
        
        # Split ciphertext and tag (last 16 bytes are the tag)
        ciphertext = ciphertext_with_tag[:-16]
        auth_tag = ciphertext_with_tag[-16:]
        
        return {
            'encrypted': ciphertext.hex(),
            'iv': iv.hex(),
            'authTag': auth_tag.hex()
        }
    except Exception as e:
        raise Exception(f'Encryption failed: {str(e)}')

def decrypt(encrypted_hex: str, iv_hex: str, auth_tag_hex: str) -> str:
    """
    Decrypt a string using AES-256-GCM
    
    Args:
        encrypted_hex: Encrypted data in hex
        iv_hex: IV in hex
        auth_tag_hex: Authentication tag in hex
        
    Returns:
        Decrypted plaintext string
    """
    try:
        # Convert hex to bytes
        ciphertext = bytes.fromhex(encrypted_hex)
        iv = bytes.fromhex(iv_hex)
        auth_tag = bytes.fromhex(auth_tag_hex)
        
        # Combine ciphertext and tag
        ciphertext_with_tag = ciphertext + auth_tag
        
        # Create cipher
        aesgcm = AESGCM(ENCRYPTION_KEY)
        
        # Decrypt
        plaintext = aesgcm.decrypt(iv, ciphertext_with_tag, None)
        
        return plaintext.decode('utf-8')
    except Exception as e:
        raise Exception(f'Decryption failed: {str(e)}')

def encrypt_phone_number(phone_number: str) -> dict:
    """
    Encrypt a phone number
    
    Args:
        phone_number: Phone number to encrypt
        
    Returns:
        Dictionary with encrypted data
    """
    return encrypt(phone_number)

def decrypt_phone_number(encrypted: str, iv: str, auth_tag: str) -> str:
    """
    Decrypt a phone number
    
    Args:
        encrypted: Encrypted phone number
        iv: Initialization vector
        auth_tag: Authentication tag
        
    Returns:
        Decrypted phone number
    """
    return decrypt(encrypted, iv, auth_tag)