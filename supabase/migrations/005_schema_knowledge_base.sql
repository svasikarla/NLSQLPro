-- Migration: Schema Knowledge Base
-- Description: Stores enriched schema metadata with semantic types and cardinality estimates
-- This supports the RAG pipeline for intelligent chart recommendations

-- Create schema_knowledge_base table
CREATE TABLE IF NOT EXISTS schema_knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES user_connections(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,

  -- Database metadata
  db_type TEXT NOT NULL,
  is_nullable BOOLEAN NOT NULL DEFAULT false,
  is_primary_key BOOLEAN NOT NULL DEFAULT false,
  is_foreign_key BOOLEAN NOT NULL DEFAULT false,
  is_unique BOOLEAN DEFAULT false,
  is_auto_increment BOOLEAN DEFAULT false,
  has_default BOOLEAN DEFAULT false,
  max_length INTEGER,

  -- Foreign key relationship
  fk_table TEXT,
  fk_column TEXT,

  -- Semantic enrichment (RAG extracted knowledge)
  semantic_type TEXT NOT NULL, -- 'identifier', 'temporal', 'currency', etc.
  cardinality_estimate TEXT NOT NULL, -- 'unique', 'very_high', 'high', 'medium', 'low', 'very_low'

  -- Confidence and reasoning
  confidence TEXT NOT NULL, -- 'high', 'medium', 'low'
  reasoning JSONB NOT NULL DEFAULT '[]', -- Array of reasoning strings

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Ensure one entry per column per connection
  UNIQUE(connection_id, table_name, column_name)
);

-- Indexes for fast lookups
CREATE INDEX idx_knowledge_connection ON schema_knowledge_base(connection_id);
CREATE INDEX idx_knowledge_table ON schema_knowledge_base(connection_id, table_name);
CREATE INDEX idx_knowledge_semantic_type ON schema_knowledge_base(semantic_type);
CREATE INDEX idx_knowledge_cardinality ON schema_knowledge_base(cardinality_estimate);

-- Index for finding columns by semantic characteristics
CREATE INDEX idx_knowledge_semantic_search ON schema_knowledge_base(connection_id, semantic_type, cardinality_estimate);

-- Comments for documentation
COMMENT ON TABLE schema_knowledge_base IS 'Enriched schema metadata with semantic types for intelligent visualizations';
COMMENT ON COLUMN schema_knowledge_base.semantic_type IS 'Business meaning of the column (e.g., currency, email, rating)';
COMMENT ON COLUMN schema_knowledge_base.cardinality_estimate IS 'Estimated number of distinct values (unique, very_high, high, medium, low, very_low)';
COMMENT ON COLUMN schema_knowledge_base.reasoning IS 'JSON array of strings explaining semantic type inference';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_schema_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_schema_knowledge_updated_at
  BEFORE UPDATE ON schema_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_schema_knowledge_updated_at();

-- Row Level Security (RLS)
ALTER TABLE schema_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access knowledge for their own connections
CREATE POLICY schema_knowledge_user_policy ON schema_knowledge_base
  FOR ALL
  USING (
    connection_id IN (
      SELECT id FROM user_connections WHERE user_id = auth.uid()
    )
  );

-- Helper view: Get all enriched columns for a connection
CREATE OR REPLACE VIEW v_enriched_schema AS
SELECT
  skb.connection_id,
  skb.table_name,
  skb.column_name,
  skb.db_type,
  skb.semantic_type,
  skb.cardinality_estimate,
  skb.is_primary_key,
  skb.is_foreign_key,
  skb.fk_table,
  skb.fk_column,
  skb.confidence,
  skb.reasoning,
  dc.name as connection_name,
  dc.db_type as database_type
FROM schema_knowledge_base skb
JOIN user_connections dc ON skb.connection_id = dc.id;

COMMENT ON VIEW v_enriched_schema IS 'User-friendly view of enriched schema metadata with connection details';
