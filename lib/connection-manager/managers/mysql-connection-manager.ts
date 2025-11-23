/**
 * MySQL Connection Manager
 * Handles MySQL-specific connection logic and optimizations
 */

import { BaseConnectionManager } from '../core/base-connection-manager'
import type { DatabaseConnection } from '@/lib/connection-manager'

/**
 * MySQL Connection Manager
 * Optimized for MySQL/MariaDB databases including AWS RDS, Azure, PlanetScale, etc.
 */
export class MySQLConnectionManager extends BaseConnectionManager {
  getDatabaseType(): string {
    return 'MySQL'
  }

  getDefaultPort(): number {
    return 3306
  }

  getRecommendedTimeout(connection: DatabaseConnection): number {
    const host = connection.host.toLowerCase()

    // AWS RDS MySQL
    if (host.includes('rds.amazonaws.com')) {
      return 20000
    }

    // Azure MySQL
    if (host.includes('mysql.database.azure.com')) {
      return 25000
    }

    // Google Cloud SQL
    if (host.includes('cloudsql') || host.includes('gcp')) {
      return 20000
    }

    // PlanetScale
    if (host.includes('psdb.cloud') || host.includes('planetscale')) {
      return 15000
    }

    // DigitalOcean
    if (host.includes('digitalocean') || host.includes('db.ondigitalocean.com')) {
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

    // AWS RDS MySQL requires SSL
    if (host.includes('rds.amazonaws.com')) {
      return { rejectUnauthorized: true }
    }

    // Azure MySQL requires SSL
    if (host.includes('mysql.database.azure.com')) {
      return { rejectUnauthorized: true }
    }

    // Google Cloud SQL requires SSL
    if (host.includes('cloudsql')) {
      return { rejectUnauthorized: true }
    }

    // PlanetScale requires SSL
    if (host.includes('psdb.cloud') || host.includes('planetscale')) {
      return { rejectUnauthorized: true }
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
    if (connection.port !== 3306) {
      errors.push(`⚠️ Non-standard port ${connection.port}. MySQL default is 3306`)
    }

    // PlanetScale-specific validation
    if (connection.host.includes('planetscale') || connection.host.includes('psdb.cloud')) {
      if (!connection.host.includes('aws')) {
        errors.push('💡 Ensure you\'re using the correct PlanetScale region endpoint')
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  getConnectionHelp(): string {
    return `
MySQL Connection Guide
=====================

Standard Connection:
  Host: your-server.com
  Port: 3306
  Database: your-database
  Username: your-username
  Password: your-password

AWS RDS MySQL:
  Host: {instance-id}.{region}.rds.amazonaws.com
  Port: 3306
  Database: your-database
  Username: admin
  Password: [master-password]

Azure MySQL:
  Host: {server-name}.mysql.database.azure.com
  Port: 3306
  Database: your-database
  Username: {username}@{server-name}
  Password: [your-password]

PlanetScale:
  Host: aws.connect.psdb.cloud
  Port: 3306
  Database: {database-name}
  Username: [from PlanetScale dashboard]
  Password: [from PlanetScale dashboard]
  Note: SSL is required

Google Cloud SQL:
  Host: {instance-connection-name}
  Port: 3306
  Database: your-database
  Username: root
  Password: [root-password]

Common Issues:
• Port 3306 → Standard MySQL
• SSL errors → Check if provider requires SSL (AWS RDS, Azure, PlanetScale do)
• Azure MySQL → Username must include @{server-name}
• PlanetScale → Always use SSL, credentials from dashboard
`
  }

  /**
   * Detect if this is a managed cloud database
   */
  isCloudDatabase(connection: DatabaseConnection): boolean {
    const host = connection.host.toLowerCase()
    const cloudProviders = [
      'rds.amazonaws.com',
      'mysql.database.azure.com',
      'cloudsql',
      'planetscale',
      'psdb.cloud',
      'digitalocean',
      'railway.app',
    ]

    return cloudProviders.some(provider => host.includes(provider))
  }

  /**
   * Get provider name from host
   */
  getProvider(connection: DatabaseConnection): string {
    const host = connection.host.toLowerCase()

    if (host.includes('rds.amazonaws.com')) return 'AWS RDS MySQL'
    if (host.includes('mysql.database.azure.com')) return 'Azure MySQL'
    if (host.includes('cloudsql')) return 'Google Cloud SQL'
    if (host.includes('planetscale') || host.includes('psdb.cloud')) return 'PlanetScale'
    if (host.includes('digitalocean')) return 'DigitalOcean'
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
      case 'AWS RDS MySQL':
        hints.push('💡 Consider enabling Performance Insights for monitoring')
        hints.push('💡 Use RDS Proxy for connection pooling at scale')
        hints.push('📚 SSL is enabled automatically')
        break

      case 'Azure MySQL':
        hints.push('💡 Username must include @{server-name}')
        hints.push('💡 Enable firewall rules to allow your IP')
        hints.push('📚 SSL is required for security')
        break

      case 'PlanetScale':
        hints.push('✅ Serverless MySQL with automatic scaling')
        hints.push('💡 Use database branching for development')
        hints.push('📚 Connection pooling built-in')
        hints.push('⚠️ SSL is required')
        break

      case 'Google Cloud SQL':
        hints.push('💡 Use Cloud SQL Proxy for secure connections')
        hints.push('💡 Enable automated backups')
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

  /**
   * Check if Azure MySQL username format is correct
   */
  isValidAzureUsername(connection: DatabaseConnection): boolean {
    if (!connection.host.includes('mysql.database.azure.com')) {
      return true // Not Azure, so format doesn't matter
    }

    // Azure MySQL usernames must include @{server-name}
    return connection.username.includes('@')
  }

  /**
   * Get corrected Azure username if format is wrong
   */
  getSuggestedAzureUsername(connection: DatabaseConnection): string | null {
    if (this.isValidAzureUsername(connection)) {
      return null // Already correct
    }

    // Extract server name from host
    const serverName = connection.host.split('.')[0]
    return `${connection.username}@${serverName}`
  }
}
