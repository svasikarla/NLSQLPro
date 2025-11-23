/**
 * SQL Server Connection Manager
 * Handles SQL Server-specific connection logic and optimizations
 */

import { BaseConnectionManager } from '../core/base-connection-manager'
import type { DatabaseConnection } from '@/lib/connection-manager'

/**
 * SQL Server Connection Manager
 * Optimized for Microsoft SQL Server including Azure SQL, AWS RDS SQL Server, etc.
 */
export class SQLServerConnectionManager extends BaseConnectionManager {
  getDatabaseType(): string {
    return 'SQL Server'
  }

  getDefaultPort(): number {
    return 1433
  }

  getRecommendedTimeout(connection: DatabaseConnection): number {
    const host = connection.host.toLowerCase()

    // Azure SQL Database needs longest timeout
    if (host.includes('database.windows.net') || host.includes('azure')) {
      return 30000
    }

    // AWS RDS SQL Server
    if (host.includes('rds.amazonaws.com')) {
      return 25000
    }

    // Google Cloud SQL Server
    if (host.includes('cloudsql') || host.includes('gcp')) {
      return 25000
    }

    // Local database
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.')) {
      return 5000
    }

    // Default for unknown cloud providers
    return 25000
  }

  getSSLConfig(connection: DatabaseConnection): any {
    const host = connection.host.toLowerCase()

    // Azure SQL Database requires encryption
    if (host.includes('database.windows.net')) {
      return {
        encrypt: true,
        trustServerCertificate: false, // Azure SQL uses proper certs
        enableArithAbort: true,
      }
    }

    // AWS RDS SQL Server
    if (host.includes('rds.amazonaws.com')) {
      return {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
      }
    }

    // Local database
    if (host === 'localhost' || host === '127.0.0.1') {
      return {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
      }
    }

    // Default: encrypt with self-signed cert
    return {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
    }
  }

  validateConnection(connection: DatabaseConnection): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate host
    if (!connection.host || connection.host.trim().length === 0) {
      errors.push('Host/Server is required')
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
    if (connection.port !== 1433) {
      errors.push(`⚠️ Non-standard port ${connection.port}. SQL Server default is 1433`)
    }

    // Azure SQL-specific validation
    if (connection.host.includes('database.windows.net')) {
      // Check if username includes @server for Azure SQL Database
      const serverName = connection.host.split('.')[0]
      if (!connection.username.includes('@') && !connection.username.includes(serverName)) {
        errors.push(
          `💡 For Azure SQL Database, username should be: ${connection.username}@${serverName}`
        )
      }

      // Azure SQL Database requires encryption
      errors.push('📚 Azure SQL requires encryption (enabled automatically)')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  getConnectionHelp(): string {
    return `
SQL Server Connection Guide
===========================

Standard Connection:
  Host/Server: your-server.com
  Port: 1433
  Database: your-database
  Username: sa (or your-username)
  Password: your-password

Azure SQL Database:
  Host: {server-name}.database.windows.net
  Port: 1433
  Database: your-database
  Username: {username}@{server-name} (or Azure AD)
  Password: [your-password]
  Note: Encryption is required

AWS RDS SQL Server:
  Host: {instance-id}.{region}.rds.amazonaws.com
  Port: 1433
  Database: your-database
  Username: admin
  Password: [master-password]

Google Cloud SQL Server:
  Host: {instance-connection-name}
  Port: 1433
  Database: your-database
  Username: sqlserver
  Password: [sqlserver-password]

Local SQL Server:
  Host: localhost (or 127.0.0.1 or computer name)
  Port: 1433
  Database: your-database
  Username: sa
  Password: [sa-password]

SQL Server Authentication Types:
• SQL Server Authentication → Use username/password
• Windows Authentication → Not supported in web apps
• Azure AD Authentication → Use Azure AD username

Common Issues:
• Port 1433 → Standard SQL Server
• Azure SQL → Username must include @{server-name}
• Encryption → Required for Azure SQL, recommended for all
• Firewall → Ensure SQL Server allows remote connections
• TCP/IP → Must be enabled in SQL Server Configuration Manager
`
  }

  /**
   * Detect if this is a managed cloud database
   */
  isCloudDatabase(connection: DatabaseConnection): boolean {
    const host = connection.host.toLowerCase()
    const cloudProviders = [
      'database.windows.net',
      'rds.amazonaws.com',
      'cloudsql',
    ]

    return cloudProviders.some(provider => host.includes(provider))
  }

  /**
   * Get provider name from host
   */
  getProvider(connection: DatabaseConnection): string {
    const host = connection.host.toLowerCase()

    if (host.includes('database.windows.net')) return 'Azure SQL Database'
    if (host.includes('rds.amazonaws.com')) return 'AWS RDS SQL Server'
    if (host.includes('cloudsql')) return 'Google Cloud SQL Server'
    if (host === 'localhost' || host === '127.0.0.1') return 'Local SQL Server'

    return 'Unknown Provider'
  }

  /**
   * Get provider-specific optimization hints
   */
  getProviderHints(connection: DatabaseConnection): string[] {
    const provider = this.getProvider(connection)
    const hints: string[] = []

    switch (provider) {
      case 'Azure SQL Database':
        hints.push('✅ Managed SQL Server with automatic backups')
        hints.push('💡 Username format: {username}@{server-name}')
        hints.push('💡 Use Azure AD authentication for better security')
        hints.push('📚 Encryption is required and enabled automatically')
        hints.push('💡 Configure firewall rules to allow your IP')
        hints.push('💡 Consider using elastic pools for cost optimization')
        break

      case 'AWS RDS SQL Server':
        hints.push('💡 Enable automated backups')
        hints.push('💡 Use Multi-AZ deployment for high availability')
        hints.push('💡 Consider Enhanced Monitoring for detailed metrics')
        break

      case 'Google Cloud SQL Server':
        hints.push('💡 Enable automated backups')
        hints.push('💡 Use high availability configuration for production')
        break

      case 'Local SQL Server':
        hints.push('⚡ Fast connection (local database)')
        hints.push('💡 Great for development and testing')
        hints.push('💡 Ensure TCP/IP is enabled in SQL Server Configuration Manager')
        hints.push('💡 Check Windows Firewall allows port 1433')
        break

      default:
        hints.push('💡 Cloud database detected - ensure firewall allows your IP')
        hints.push('💡 Enable encryption for security')
    }

    return hints
  }

  /**
   * Check if Azure SQL username format is correct
   */
  isValidAzureUsername(connection: DatabaseConnection): boolean {
    if (!connection.host.includes('database.windows.net')) {
      return true // Not Azure, so format doesn't matter
    }

    // Azure SQL usernames should include @{server-name}
    const serverName = connection.host.split('.')[0]
    return connection.username.includes('@') || connection.username.includes(serverName)
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

  /**
   * Check if this is Azure SQL Database (vs Azure SQL Managed Instance)
   */
  isAzureSQLDatabase(connection: DatabaseConnection): boolean {
    return connection.host.toLowerCase().includes('.database.windows.net')
  }

  /**
   * Get T-SQL-specific query optimization hints
   */
  getQueryOptimizationHints(): string[] {
    return [
      'Use TOP instead of LIMIT for row limiting',
      'Use GETDATE() instead of NOW() for current timestamp',
      'Use LEN() instead of LENGTH() for string length',
      'Use CHARINDEX() instead of INSTR() for substring search',
      'Always qualify table names with schema: [dbo].[TableName]',
      'Use square brackets for identifiers: [Column Name]',
      'Consider using NOLOCK hint for read-heavy workloads (with caution)',
    ]
  }
}
