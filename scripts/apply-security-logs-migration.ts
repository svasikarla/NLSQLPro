/**
 * Migration Script: Apply Security Logs Table
 *
 * This script creates the security_logs table in your Supabase database.
 *
 * Usage:
 *   npx tsx scripts/apply-security-logs-migration.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Manually load .env.local
function loadEnv() {
    try {
        const envPath = path.join(process.cwd(), '.env.local')
        if (fs.existsSync(envPath)) {
            const envConfig = fs.readFileSync(envPath, 'utf-8')
            envConfig.split('\n').forEach((line) => {
                const match = line.match(/^([^=]+)=(.*)$/)
                if (match) {
                    const key = match[1].trim()
                    const value = match[2].trim().replace(/^["']|["']$/g, '') // Remove quotes
                    process.env[key] = value
                }
            })
        }
    } catch (e) {
        console.warn('Could not load .env.local')
    }
}

loadEnv()

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

    console.log('🚀 Starting security_logs migration...\n')

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../supabase/migrations/009_create_security_logs.sql')

    if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Error: Migration file not found at ${migrationPath}`)
        process.exit(1)
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    console.log('📄 Migration file loaded:')
    console.log('   File: 009_create_security_logs.sql')
    console.log(`   Size: ${migrationSQL.length} bytes\n`)

    try {
        // Execute the migration
        console.log('⏳ Executing migration...')

        // Try to use exec_sql RPC if available
        const { error } = await supabase.rpc('exec_sql', {
            sql: migrationSQL
        })

        if (error) {
            console.log('⚠️  RPC method exec_sql not available or failed:', error.message)
            console.log('\n💡 Manual Migration Required:')
            console.log('   1. Open Supabase Dashboard → SQL Editor')
            console.log('   2. Copy contents of: supabase/migrations/009_create_security_logs.sql')
            console.log('   3. Paste and execute in SQL Editor\n')
        } else {
            console.log('✅ Migration executed successfully via RPC!')
        }

    } catch (err: any) {
        console.error('❌ Error executing migration:', err.message)
    }

    console.log('🎉 Migration script finished.\n')
}

applyMigration()
    .then(() => {
        process.exit(0)
    })
    .catch((err) => {
        console.error('Fatal error:', err)
        process.exit(1)
    })
