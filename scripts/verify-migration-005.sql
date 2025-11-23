-- Verification Script for Migration 005
-- Run this in Supabase SQL Editor AFTER applying the migration

-- 1. Check if schema_knowledge_base table exists
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'schema_knowledge_base';

-- Expected: 1 row showing the table exists

-- 2. Check table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'schema_knowledge_base'
ORDER BY ordinal_position;

-- Expected: 16 columns (id, connection_id, table_name, column_name, etc.)

-- 3. Verify foreign key constraint to user_connections
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'schema_knowledge_base';

-- Expected: foreign key pointing to user_connections(id)

-- 4. Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'schema_knowledge_base'
ORDER BY indexname;

-- Expected: 4 indexes (idx_knowledge_connection, idx_knowledge_table, idx_knowledge_semantic_type, idx_knowledge_semantic_search)

-- 5. Verify RLS is enabled
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'schema_knowledge_base';

-- Expected: rowsecurity = true

-- 6. Check RLS policies
SELECT
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'schema_knowledge_base';

-- Expected: 1 policy (schema_knowledge_user_policy)

-- 7. Verify the view exists
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'v_enriched_schema';

-- Expected: 1 row showing the view exists

-- 8. Count rows (should be 0 initially)
SELECT COUNT(*) as row_count FROM schema_knowledge_base;

-- Expected: 0 (empty until first schema introspection)

-- ✅ If all queries above return expected results, migration was successful!
