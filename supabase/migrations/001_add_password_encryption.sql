-- Migration: Add encrypted password column to user_connections
-- Date: 2025-01-14
-- Description: Migrate from plain text passwords to encrypted passwords

-- Step 1: Add new column for encrypted password
ALTER TABLE user_connections
  ADD COLUMN password_encrypted TEXT,
  ADD COLUMN encrypted_at TIMESTAMP;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN user_connections.password_encrypted IS 'AES-256-GCM encrypted password (base64 encoded)';
COMMENT ON COLUMN user_connections.encrypted_at IS 'Timestamp when password was encrypted';

-- Step 3: Keep old password column temporarily for backward compatibility
-- We'll remove it after confirming encryption works

-- Step 4: Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_connections_encrypted ON user_connections(password_encrypted) WHERE password_encrypted IS NOT NULL;

-- Note: Actual data migration will happen in the application code
-- This is because encryption requires the ENCRYPTION_KEY from environment variables
-- which is not available in SQL migrations
