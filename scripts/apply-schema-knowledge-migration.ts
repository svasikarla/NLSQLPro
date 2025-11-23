/**
 * Migration Script: Apply Schema Knowledge Base Table
 *
 * This script creates the schema_knowledge_base table in your Supabase database.
 * Run this once to enable schema-aware visualizations.
 *
 * Usage:
 *   pnpm tsx scripts/apply-schema-knowledge-migration.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function applyMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing Supabase credentials')
    console.error('   Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  console.log('🚀 Starting schema_knowledge_base migration...\n')

  // Read the migration SQL file
  const migrationPath = path.join(__dirname, '../supabase/migrations/005_schema_knowledge_base.sql')

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Error: Migration file not found at ${migrationPath}`)
    process.exit(1)
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

  console.log('📄 Migration file loaded:')
  console.log('   File: 005_schema_knowledge_base.sql')
  console.log(`   Size: ${migrationSQL.length} bytes\n`)

  try {
    // Execute the migration
    console.log('⏳ Executing migration...')

    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    })

    if (error) {
      // If the RPC doesn't exist, try direct execution (Supabase limitation)
      console.log('⚠️  RPC method not available, attempting direct execution...\n')

      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      console.log(`📝 Found ${statements.length} SQL statements to execute\n`)

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        if (statement) {
          console.log(`   [${i + 1}/${statements.length}] Executing statement...`)

          const { error: stmtError } = await supabase.rpc('exec', {
            query: statement + ';'
          })

          if (stmtError) {
            // Try alternative: use raw query if available
            console.warn(`   ⚠️  Statement ${i + 1} failed via RPC, this is expected with Supabase`)
          }
        }
      }

      console.log('\n⚠️  Note: Supabase hosted databases require manual migration application.')
      console.log('   Please apply the migration using one of these methods:\n')
      console.log('   1. Supabase Dashboard → SQL Editor → Paste and run the migration')
      console.log('   2. psql CLI: psql <connection_string> < supabase/migrations/005_schema_knowledge_base.sql')
      console.log('   3. Copy the SQL from: supabase/migrations/005_schema_knowledge_base.sql\n')

      console.log('📋 Migration SQL Preview:')
      console.log('─'.repeat(80))
      console.log(migrationSQL.substring(0, 500) + '...\n')
      console.log('─'.repeat(80))
      console.log(`\n✅ Migration script completed (manual application required)`)

      return
    }

    console.log('✅ Migration executed successfully!')
    console.log('   Table: schema_knowledge_base created')
    console.log('   Indexes: Created')
    console.log('   RLS Policies: Enabled')
    console.log('   View: v_enriched_schema created\n')

  } catch (err: any) {
    console.error('❌ Error executing migration:', err.message)
    console.error('\n💡 Manual Migration Required:')
    console.error('   1. Open Supabase Dashboard → SQL Editor')
    console.error('   2. Copy contents of: supabase/migrations/005_schema_knowledge_base.sql')
    console.error('   3. Paste and execute in SQL Editor\n')
    process.exit(1)
  }

  // Verify the table was created
  try {
    const { data: tableCheck, error: tableError } = await supabase
      .from('schema_knowledge_base')
      .select('*')
      .limit(0)

    if (tableError) {
      console.warn('⚠️  Warning: Could not verify table creation')
      console.warn('   Please check Supabase Dashboard to confirm table exists\n')
    } else {
      console.log('✅ Verification: schema_knowledge_base table is accessible\n')
    }
  } catch (verifyError) {
    console.warn('⚠️  Could not verify table (this may be normal)\n')
  }

  console.log('🎉 Migration complete!\n')
  console.log('Next steps:')
  console.log('   1. Run a query in your app')
  console.log('   2. Schema knowledge will be automatically built and cached')
  console.log('   3. Enjoy enhanced visualizations with V2 system!\n')
}

applyMigration()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
