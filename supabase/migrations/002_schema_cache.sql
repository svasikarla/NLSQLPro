-- Schema Cache Table
-- Stores cached schema metadata to avoid repeated introspection

CREATE TABLE IF NOT EXISTS schema_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES user_connections(id) ON DELETE CASCADE,

  -- Schema data
  schema_data JSONB NOT NULL,
  schema_hash VARCHAR(64) NOT NULL, -- MD5 hash of table/column names for staleness detection

  -- Metadata
  table_count INTEGER NOT NULL,
  total_columns INTEGER NOT NULL,

  -- Timestamps
  cached_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  last_accessed_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Indexes for performance
  CONSTRAINT unique_connection_cache UNIQUE(connection_id)
);

-- Index for finding expired caches
CREATE INDEX idx_schema_cache_expires ON schema_cache(expires_at);

-- Index for cleanup queries
CREATE INDEX idx_schema_cache_last_accessed ON schema_cache(last_accessed_at);

-- Auto-update last_accessed_at on SELECT
CREATE OR REPLACE FUNCTION update_schema_cache_access_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON TABLE schema_cache IS 'Caches database schema metadata with 24h TTL to reduce introspection overhead';
COMMENT ON COLUMN schema_cache.schema_hash IS 'MD5 hash of sorted table and column names for detecting schema changes';
COMMENT ON COLUMN schema_cache.expires_at IS 'Cache expiration time (24 hours from creation)';
