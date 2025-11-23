/**
 * PostgreSQL Connection Manager
 * Handles PostgreSQL-specific connection logic and optimizations
 */

import { BaseConnectionManager } from '../core/base-connection-manager'
import type { DatabaseConnection } from '@/lib/connection-manager'

/**
 * PostgreSQL Connection Manager
 * Optimized for PostgreSQL databases including Supabase, AWS RDS, Heroku, etc.
 */
export class PostgreSQLConnectionManager extends BaseConnectionManager {
  getDatabaseType(): string {
    return 'PostgreSQL'
  }

  getDefaultPort(): number {
    return 5432
  }

  getRecommendedTimeout(connection: DatabaseConnection): number {
    const host = connection.host.toLowerCase()

    // Supabase pooler uses port 6543 and needs 15s
    if (host.includes('supabase.co')) {
      return connection.port === 6543 ? 15000 : 15000
    }

    // AWS RDS
    if (host.includes('rds.amazonaws.com')) {
      return 20000
    }

    // Google Cloud SQL
    if (host.includes('cloudsql') || host.includes('gcp')) {
      return 20000
    }

    // Azure PostgreSQL
    if (host.includes('postgres.database.azure.com')) {
      return 25000
    }

    // Heroku
    if (host.includes('heroku')) {
      return 15000
    }

    // DigitalOcean
    if (host.includes('digitalocean') || host.includes('db.ondigitalocean.com')) {
      return 15000
    }

    // Render.com
    if (host.includes('render.com')) {
      return 15000
    }

    // Railway
    if (host.includes('railway.app')) {
      return 15000
    }

    // Local database
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.')) {
      return 5000
    }

    // Default for unknown cloud providers
    return 20000
  }

  getSSLConfig(connection: DatabaseConnection): any {
    const host = connection.host.toLowerCase()

    // Supabase requires SSL but uses self-signed certificates
    if (host.includes('supabase.co')) {
      return { rejectUnauthorized: false }
    }

    // AWS RDS requires SSL
    if (host.includes('rds.amazonaws.com')) {
      return { rejectUnauthorized: true }
    }

    // Azure PostgreSQL requires SSL
    if (host.includes('postgres.database.azure.com')) {
      return { rejectUnauthorized: true }
    }

    // Google Cloud SQL requires SSL
    if (host.includes('cloudsql')) {
      return { rejectUnauthorized: true }
    }

    // Heroku requires SSL
    if (host.includes('heroku')) {
      return { rejectUnauthorized: false } // Heroku uses self-signed certs
    }

    // DigitalOcean requires SSL
    if (host.includes('digitalocean')) {
      return { rejectUnauthorized: true }
    }

    // Local database - no SSL
    if (host === 'localhost' || host === '127.0.0.1') {
      return undefined
    }

    // Default: enable SSL but don't verify
    return { rejectUnauthorized: false }
  }

  validateConnection(connection: DatabaseConnection): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate host
    if (!connection.host || connection.host.trim().length === 0) {
      errors.push('Host is required')
    }

    // Validate database name
    if (!connection.database || connection.database.trim().length === 0) {
      errors.push('Database name is required')
    }

    // Validate username
    if (!connection.username || connection.username.trim().length === 0) {
      errors.push('Username is required')
    }

    // Validate port
    if (connection.port < 1 || connection.port > 65535) {
      errors.push('Port must be between 1 and 65535')
    }

    // Warn about non-standard ports
    if (connection.port !== 5432 && connection.port !== 6543) {
      errors.push(`⚠️ Non-standard port ${connection.port}. PostgreSQL default is 5432, Supabase pooler uses 6543`)
    }

    // Supabase-specific validation
    if (connection.host.includes('supabase.co')) {
      if (connection.port === 6543) {
        // Pooler connection
        if (!connection.username.includes('.')) {
          errors.push('Supabase pooler requires username format: postgres.{project-ref}')
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  getConnectionHelp(): string {
    return `
PostgreSQL Connection Guide
==========================

Standard Connection:
  Host: your-server.com
  Port: 5432
  Database: your-database
  Username: your-username
  Password: your-password

Supabase (Direct):
  Host: db.{project-ref}.supabase.co
  Port: 5432
  Database: postgres
  Username: postgres
  Password: [your-database-password]

Supabase (Pooler - Recommended for serverless):
  Host: aws-0-{region}.pooler.supabase.com
  Port: 6543
  Database: postgres
  Username: postgres.{project-ref}
  Password: [your-database-password]

AWS RDS PostgreSQL:
  Host: {instance-id}.{region}.rds.amazonaws.com
  Port: 5432
  Database: postgres
  Username: postgres
  Password: [master-password]

Heroku PostgreSQL:
  Use DATABASE_URL from Heroku config vars
  Format: postgres://user:pass@host:port/dbname

Common Issues:
• Port 6543 → Supabase pooler (use for serverless)
• Port 5432 → Standard PostgreSQL
• SSL errors → Check if provider requires SSL
• Authentication failed → Verify username format (especially Supabase)
`
  }

  /**
   * Detect Supabase pooler connection
   */
  isSupabasePooler(connection: DatabaseConnection): boolean {
    return connection.host.includes('pooler.supabase.com') || connection.port === 6543
  }

  /**
   * Detect if this is a managed cloud database
   */
  isCloudDatabase(connection: DatabaseConnection): boolean {
    const host = connection.host.toLowerCase()
    const cloudProviders = [
      'supabase.co',
      'rds.amazonaws.com',
      'postgres.database.azure.com',
      'cloudsql',
      'heroku',
      'digitalocean',
      'render.com',
      'railway.app',
    ]

    return cloudProviders.some(provider => host.includes(provider))
  }

  /**
   * Get provider name from host
   */
  getProvider(connection: DatabaseConnection): string {
    const host = connection.host.toLowerCase()

    if (host.includes('supabase.co')) return 'Supabase'
    if (host.includes('rds.amazonaws.com')) return 'AWS RDS'
    if (host.includes('postgres.database.azure.com')) return 'Azure PostgreSQL'
    if (host.includes('cloudsql')) return 'Google Cloud SQL'
    if (host.includes('heroku')) return 'Heroku'
    if (host.includes('digitalocean')) return 'DigitalOcean'
    if (host.includes('render.com')) return 'Render'
    if (host.includes('railway.app')) return 'Railway'
    if (host === 'localhost' || host === '127.0.0.1') return 'Local'

    return 'Unknown Provider'
  }

  /**
   * Get provider-specific optimization hints
   */
  getProviderHints(connection: DatabaseConnection): string[] {
    const provider = this.getProvider(connection)
    const hints: string[] = []

    switch (provider) {
      case 'Supabase':
        if (connection.port === 6543) {
          hints.push('✅ Using Supabase pooler (recommended for serverless)')
        } else {
          hints.push('💡 Consider using pooler (port 6543) for better performance with serverless')
        }
        hints.push('📚 Connection pooling enabled automatically')
        break

      case 'AWS RDS':
        hints.push('💡 Consider enabling Performance Insights for monitoring')
        hints.push('💡 Use RDS Proxy for connection pooling at scale')
        break

      case 'Heroku':
        hints.push('💡 Connection credentials may rotate automatically')
        hints.push('💡 Use connection pooling (PgBouncer) for better performance')
        break

      case 'Local':
        hints.push('⚡ Fast connection (local database)')
        hints.push('💡 Great for development and testing')
        break

      default:
        hints.push('💡 Cloud database detected - ensure firewall allows your IP')
    }

    return hints
  }
}
