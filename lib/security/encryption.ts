/**
 * Encryption utilities for securing sensitive data (database credentials)
 * Uses AES-256-GCM encryption with environment variable key
 */

import crypto from 'crypto'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // AES block size
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32 // 256 bits

/**
 * Get or generate encryption key from environment
 * In production, this should be a securely stored secret
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }

  // Key should be 64 hex characters (32 bytes)
  if (key.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be 64 hex characters (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }

  return Buffer.from(key, 'hex')
}

/**
 * Encrypt sensitive data (e.g., database passwords)
 * Returns base64-encoded encrypted data with IV and auth tag
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // Combine IV + encrypted data + auth tag
    // Format: iv:encrypted:authTag (all in hex)
    const combined = `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`

    // Return as base64 for storage
    return Buffer.from(combined).toString('base64')
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt encrypted data
 * Expects base64-encoded data from encrypt() function
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey()

    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64').toString('utf8')

    // Split into components
    const parts = combined.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }

    const [ivHex, encryptedHex, authTagHex] = parts

    const iv = Buffer.from(ivHex, 'hex')
    const encrypted = Buffer.from(encryptedHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted.toString('utf8')
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Encrypt connection credentials object
 * Encrypts only the password field, leaves other fields as-is
 */
export function encryptConnectionCredentials(credentials: {
  host: string
  port: number
  database: string
  username: string
  password: string
}): {
  host: string
  port: number
  database: string
  username: string
  password_encrypted: string
} {
  return {
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    username: credentials.username,
    password_encrypted: encrypt(credentials.password),
  }
}

/**
 * Decrypt connection credentials
 * Returns credentials with decrypted password
 */
export function decryptConnectionCredentials(encryptedCredentials: {
  host: string
  port: number
  database: string
  username: string
  password_encrypted: string
}): {
  host: string
  port: number
  database: string
  username: string
  password: string
} {
  return {
    host: encryptedCredentials.host,
    port: encryptedCredentials.port,
    database: encryptedCredentials.database,
    username: encryptedCredentials.username,
    password: decrypt(encryptedCredentials.password_encrypted),
  }
}

/**
 * Generate a new encryption key (for setup)
 * Run this once and store in environment variable
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}
