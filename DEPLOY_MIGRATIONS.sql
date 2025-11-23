-- ============================================================================
-- NLSQL Pro - Database Migration Script
-- ============================================================================
-- Run this script in your Supabase SQL Editor to set up all required tables
-- URL: https://app.supabase.com/ → Your Project → SQL Editor
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. User Connections Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Connection details
  name VARCHAR(255) NOT NULL,
  db_type VARCHAR(50) NOT NULL CHECK (db_type IN ('postgresql', 'mysql', 'sqlite', 'sqlserver')),
  host VARCHAR(255),
  port INTEGER,
  database_name VARCHAR(255),
  username VARCHAR(255),
  password TEXT,  -- Deprecated: use password_encrypted instead

  -- Encrypted password (added in migration 001)
  password_encrypted TEXT,
  encrypted_at TIMESTAMP,

  -- SSL Configuration (added in migration 006)
  ssl_enabled BOOLEAN DEFAULT false,
  ssl_reject_unauthorized BOOLEAN DEFAULT true,
  ssl BOOLEAN,
  ssl_config JSONB,

  -- Metadata
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  is_active BOOLEAN DEFAULT false,
  last_tested_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_connections_user ON user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_active ON user_connections(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_connections_encrypted ON user_connections(password_encrypted) WHERE password_encrypted IS NOT NULL;

-- Comments
COMMENT ON TABLE user_connections IS 'User database connections with encrypted credentials';
COMMENT ON COLUMN user_connections.password IS 'Deprecated: Use password_encrypted instead';
COMMENT ON COLUMN user_connections.password_encrypted IS 'AES-256-GCM encrypted password (base64 encoded)';
COMMENT ON COLUMN user_connections.encrypted_at IS 'Timestamp when password was encrypted';
COMMENT ON COLUMN user_connections.ssl IS 'Whether to use SSL/TLS for connection (null = auto-detect)';
COMMENT ON COLUMN user_connections.ssl_config IS 'SSL configuration options (e.g., rejectUnauthorized, ca, cert, key)';
COMMENT ON COLUMN user_connections.is_active IS 'Only one connection can be active per user at a time';

-- ============================================================================
-- 2. Query History Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS query_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES user_connections(id) ON DELETE CASCADE,

  -- Query details
  nl_query TEXT NOT NULL,
  generated_sql TEXT NOT NULL,

  -- Execution details
  executed BOOLEAN DEFAULT false,
  execution_time_ms INTEGER,
  row_count INTEGER,

  -- Error tracking
  error_message TEXT,

  -- Conversation threading (for query refinement)
  parent_query_id UUID REFERENCES query_history(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_query_history_user ON query_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_history_connection ON query_history(connection_id);
CREATE INDEX IF NOT EXISTS idx_query_history_parent ON query_history(parent_query_id);

-- Comments
COMMENT ON TABLE query_history IS 'History of natural language queries and generated SQL';
COMMENT ON COLUMN query_history.parent_query_id IS 'Link to previous query for conversation threading';

-- ============================================================================
-- 3. Schema Cache Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS schema_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES user_connections(id) ON DELETE CASCADE,

  -- Schema data
  schema_data JSONB NOT NULL,
  schema_hash VARCHAR(64) NOT NULL,

  -- Metadata
  table_count INTEGER NOT NULL,
  total_columns INTEGER NOT NULL,

  -- Timestamps
  cached_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  last_accessed_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_connection_cache UNIQUE(connection_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schema_cache_expires ON schema_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_schema_cache_last_accessed ON schema_cache(last_accessed_at);

-- Comments
COMMENT ON TABLE schema_cache IS 'Cached database schema metadata with 24h TTL to reduce introspection overhead';
COMMENT ON COLUMN schema_cache.schema_hash IS 'MD5 hash of sorted table and column names for detecting schema changes';
COMMENT ON COLUMN schema_cache.expires_at IS 'Cache expiration time (24 hours from creation)';

-- ============================================================================
-- 4. Schema Knowledge Base Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS schema_knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES user_connections(id) ON DELETE CASCADE,

  -- Table-level metadata
  table_name VARCHAR(255) NOT NULL,
  table_description TEXT,

  -- Column-level metadata
  column_name VARCHAR(255),
  column_description TEXT,

  -- Business context
  business_term VARCHAR(255),
  example_values TEXT[],

  -- Relationships
  related_tables VARCHAR(255)[],

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(connection_id, table_name, column_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schema_knowledge_connection ON schema_knowledge_base(connection_id);
CREATE INDEX IF NOT EXISTS idx_schema_knowledge_table ON schema_knowledge_base(connection_id, table_name);

-- Comments
COMMENT ON TABLE schema_knowledge_base IS 'User-provided metadata and business context for database schemas';
COMMENT ON COLUMN schema_knowledge_base.business_term IS 'Business-friendly name for technical terms';

-- ============================================================================
-- 5. Row-Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid duplicates)
DO $$
BEGIN
  -- User Connections
  DROP POLICY IF EXISTS "Users can view their own connections" ON user_connections;
  DROP POLICY IF EXISTS "Users can create their own connections" ON user_connections;
  DROP POLICY IF EXISTS "Users can update their own connections" ON user_connections;
  DROP POLICY IF EXISTS "Users can delete their own connections" ON user_connections;

  -- Query History
  DROP POLICY IF EXISTS "Users can view their own query history" ON query_history;
  DROP POLICY IF EXISTS "Users can create their own query history" ON query_history;
  DROP POLICY IF EXISTS "Users can delete their own query history" ON query_history;

  -- Schema Cache
  DROP POLICY IF EXISTS "Users can view cache for their connections" ON schema_cache;
  DROP POLICY IF EXISTS "Users can create cache for their connections" ON schema_cache;
  DROP POLICY IF EXISTS "Users can update cache for their connections" ON schema_cache;
  DROP POLICY IF EXISTS "Users can delete cache for their connections" ON schema_cache;

  -- Schema Knowledge Base
  DROP POLICY IF EXISTS "Users can view knowledge for their connections" ON schema_knowledge_base;
  DROP POLICY IF EXISTS "Users can create knowledge for their connections" ON schema_knowledge_base;
  DROP POLICY IF EXISTS "Users can update knowledge for their connections" ON schema_knowledge_base;
  DROP POLICY IF EXISTS "Users can delete knowledge for their connections" ON schema_knowledge_base;
END $$;

-- User Connections Policies
CREATE POLICY "Users can view their own connections" ON user_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own connections" ON user_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections" ON user_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections" ON user_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Query History Policies
CREATE POLICY "Users can view their own query history" ON query_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own query history" ON query_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own query history" ON query_history
  FOR DELETE USING (auth.uid() = user_id);

-- Schema Cache Policies
CREATE POLICY "Users can view cache for their connections" ON schema_cache
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE user_connections.id = schema_cache.connection_id
      AND user_connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create cache for their connections" ON schema_cache
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE user_connections.id = schema_cache.connection_id
      AND user_connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update cache for their connections" ON schema_cache
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE user_connections.id = schema_cache.connection_id
      AND user_connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete cache for their connections" ON schema_cache
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE user_connections.id = schema_cache.connection_id
      AND user_connections.user_id = auth.uid()
    )
  );

-- Schema Knowledge Base Policies
CREATE POLICY "Users can view knowledge for their connections" ON schema_knowledge_base
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE user_connections.id = schema_knowledge_base.connection_id
      AND user_connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create knowledge for their connections" ON schema_knowledge_base
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE user_connections.id = schema_knowledge_base.connection_id
      AND user_connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update knowledge for their connections" ON schema_knowledge_base
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE user_connections.id = schema_knowledge_base.connection_id
      AND user_connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete knowledge for their connections" ON schema_knowledge_base
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE user_connections.id = schema_knowledge_base.connection_id
      AND user_connections.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. Triggers
-- ============================================================================

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS user_connections_updated_at ON user_connections;
DROP TRIGGER IF EXISTS schema_knowledge_base_updated_at ON schema_knowledge_base;

-- Create triggers
CREATE TRIGGER user_connections_updated_at
  BEFORE UPDATE ON user_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER schema_knowledge_base_updated_at
  BEFORE UPDATE ON schema_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. Verification
-- ============================================================================

-- Check that all tables exist
DO $$
DECLARE
  missing_tables TEXT[];
BEGIN
  SELECT ARRAY_AGG(table_name)
  INTO missing_tables
  FROM (
    SELECT unnest(ARRAY['user_connections', 'query_history', 'schema_cache', 'schema_knowledge_base']) AS table_name
  ) expected
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = expected.table_name
  );

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Missing tables: %', missing_tables;
  ELSE
    RAISE NOTICE '✅ All tables created successfully';
  END IF;
END $$;

-- ============================================================================
-- DEPLOYMENT COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Verify all tables exist in Supabase Dashboard → Table Editor
-- 2. Test database connection in your app
-- 3. The schema_cache table is now ready to use
-- ============================================================================
