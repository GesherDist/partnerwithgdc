/**
 * Token Encryption Utilities
 *
 * AES-256-GCM encryption for storing OAuth tokens securely.
 * Uses Web Crypto API for Node.js compatibility.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { QBO_ERRORS } from './constants';

// ============================================
// CONSTANTS
// ============================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

// ============================================
// CONFIGURATION
// ============================================

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.QBO_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error('Missing environment variable: QBO_ENCRYPTION_KEY');
  }

  // Key should be 64 hex characters (32 bytes)
  if (keyHex.length !== 64) {
    throw new Error('QBO_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(keyHex, 'hex');
}

// ============================================
// ENCRYPTION
// ============================================

/**
 * Encrypt a plaintext string using AES-256-GCM
 *
 * Output format: base64(iv + authTag + ciphertext)
 *
 * @param plaintext - String to encrypt
 * @returns Base64-encoded encrypted string
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Combine: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);

    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error(QBO_ERRORS.ENCRYPTION_FAILED);
  }
}

// ============================================
// DECRYPTION
// ============================================

/**
 * Decrypt an AES-256-GCM encrypted string
 *
 * @param encryptedBase64 - Base64-encoded encrypted string
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedBase64: string): string {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedBase64, 'base64');

    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error(QBO_ERRORS.DECRYPTION_FAILED);
  }
}

// ============================================
// KEY GENERATION UTILITY
// ============================================

/**
 * Generate a new 256-bit encryption key
 *
 * Use this to generate QBO_ENCRYPTION_KEY for .env:
 * ```
 * import { generateEncryptionKey } from './encryption';
 * console.log(generateEncryptionKey());
 * ```
 *
 * @returns 64-character hex string
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}
