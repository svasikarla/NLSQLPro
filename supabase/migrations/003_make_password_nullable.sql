-- Migration: Make password column nullable for encrypted password transition
-- Date: 2025-01-16
-- Description: Allow password column to be NULL since we're using password_encrypted now

-- Make the legacy password column nullable
ALTER TABLE user_connections
  ALTER COLUMN password DROP NOT NULL;

-- Add comment to indicate this column is deprecated
COMMENT ON COLUMN user_connections.password IS 'DEPRECATED: Legacy plain text password field. Use password_encrypted instead. Will be removed in future migration.';
