-- Migration: Add SSL configuration columns to user_connections
-- Date: 2025-01-22
-- Description: Add ssl and ssl_config columns for explicit SSL configuration

-- Add SSL configuration columns
ALTER TABLE user_connections
  ADD COLUMN IF NOT EXISTS ssl BOOLEAN,
  ADD COLUMN IF NOT EXISTS ssl_config JSONB;

-- Add comments for documentation
COMMENT ON COLUMN user_connections.ssl IS 'Whether to use SSL/TLS for connection (null = auto-detect)';
COMMENT ON COLUMN user_connections.ssl_config IS 'SSL configuration options (e.g., rejectUnauthorized, ca, cert, key)';
