-- Migration: Add SQL Server support to db_type column
-- Date: 2025-01-16
-- Description: Update db_type constraint to include 'sqlserver' option

-- Step 1: Drop the existing check constraint if it exists
-- (The constraint name may vary, so we'll handle it safely)
DO $$
BEGIN
    -- Drop any existing check constraint on db_type column
    ALTER TABLE user_connections
    DROP CONSTRAINT IF EXISTS user_connections_db_type_check;
EXCEPTION
    WHEN undefined_object THEN
        NULL; -- Constraint doesn't exist, no problem
END $$;

-- Step 2: Add new check constraint with all supported database types
ALTER TABLE user_connections
  ADD CONSTRAINT user_connections_db_type_check
  CHECK (db_type IN ('postgresql', 'mysql', 'sqlite', 'sqlserver'));

-- Step 3: Add comment for documentation
COMMENT ON COLUMN user_connections.db_type IS 'Database type: postgresql, mysql, sqlite, or sqlserver';

-- Step 4: Verify the migration
-- This will show the current constraint
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'user_connections_db_type_check';
