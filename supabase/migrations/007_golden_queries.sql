-- Create golden_queries table for RAG
CREATE TABLE IF NOT EXISTS golden_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  natural_query TEXT NOT NULL,
  sql_query TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Add a simple text search index for MVP (can be upgraded to vector later)
  CONSTRAINT golden_queries_query_length_check CHECK (char_length(natural_query) > 0)
);

-- Enable RLS
ALTER TABLE golden_queries ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users (shared memory)
CREATE POLICY "Allow read access to authenticated users"
  ON golden_queries FOR SELECT
  TO authenticated
  USING (true);

-- Allow insert access to authenticated users
CREATE POLICY "Allow insert access to authenticated users"
  ON golden_queries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create index for text search
CREATE INDEX IF NOT EXISTS idx_golden_queries_natural_query_trgm 
ON golden_queries USING GIN (to_tsvector('english', natural_query));
