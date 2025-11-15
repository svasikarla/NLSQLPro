/**
 * Database Adapter Factory
 * Creates the appropriate adapter instance based on database type
 */

import type { ConnectionConfig } from '../types/database'
import { DatabaseType } from '../types/database'
import type { BaseDatabaseAdapter } from './base-adapter'

// Import adapters
import { PostgreSQLAdapter } from './postgresql-adapter'
import { MySQLAdapter } from './mysql-adapter'
import { SQLiteAdapter } from './sqlite-adapter'
import { SQLServerAdapter } from './sqlserver-adapter'

/**
 * Adapter factory class
 * Instantiates the correct adapter based on db_type
 */
export class AdapterFactory {
  /**
   * Create adapter instance
   * @throws Error if database type is not supported
   */
  static createAdapter(config: ConnectionConfig): BaseDatabaseAdapter {
    const dbType = config.db_type

    switch (dbType) {
      case DatabaseType.POSTGRESQL:
        return new PostgreSQLAdapter(config)

      case DatabaseType.MYSQL:
        return new MySQLAdapter(config)

      case DatabaseType.SQLITE:
        return new SQLiteAdapter(config)

      case DatabaseType.SQLSERVER:
        return new SQLServerAdapter(config)

      case DatabaseType.MONGODB:
        // TODO: Implement in Week 7+ (if needed)
        throw new Error('MongoDB adapter not yet implemented')

      default:
        throw new Error(`Unsupported database type: ${dbType}`)
    }
  }

  /**
   * Check if a database type is supported
   */
  static isSupported(dbType: DatabaseType): boolean {
    return Object.values(DatabaseType).includes(dbType)
  }

  /**
   * Get list of supported database types
   */
  static getSupportedDatabases(): DatabaseType[] {
    return [
      DatabaseType.POSTGRESQL,
      DatabaseType.MYSQL,
      DatabaseType.SQLITE,
      DatabaseType.SQLSERVER,
    ]
  }

  /**
   * Get human-readable name for database type
   */
  static getDatabaseName(dbType: DatabaseType): string {
    const names: Record<DatabaseType, string> = {
      [DatabaseType.POSTGRESQL]: 'PostgreSQL',
      [DatabaseType.MYSQL]: 'MySQL',
      [DatabaseType.SQLITE]: 'SQLite',
      [DatabaseType.SQLSERVER]: 'Microsoft SQL Server',
      [DatabaseType.MONGODB]: 'MongoDB',
    }

    return names[dbType] || 'Unknown Database'
  }

  /**
   * Get default port for database type
   */
  static getDefaultPort(dbType: DatabaseType): number | undefined {
    const ports: Partial<Record<DatabaseType, number>> = {
      [DatabaseType.POSTGRESQL]: 5432,
      [DatabaseType.MYSQL]: 3306,
      [DatabaseType.SQLSERVER]: 1433,
      [DatabaseType.MONGODB]: 27017,
    }

    return ports[dbType]
  }

  /**
   * Validate connection configuration
   * Returns list of validation errors
   */
  static validateConfig(config: ConnectionConfig): string[] {
    const errors: string[] = []

    // Check required fields
    if (!config.db_type) {
      errors.push('Database type is required')
    } else if (!this.isSupported(config.db_type)) {
      errors.push(`Database type "${config.db_type}" is not supported`)
    }

    if (!config.database) {
      errors.push('Database name is required')
    }

    // For non-SQLite databases, host is usually required
    if (config.db_type !== DatabaseType.SQLITE) {
      if (!config.host && !config.connection_string) {
        errors.push('Either host or connection_string is required')
      }

      if (!config.username && !config.connection_string) {
        errors.push('Either username or connection_string is required')
      }

      if (!config.password && !config.password_encrypted && !config.connection_string) {
        errors.push('Either password, password_encrypted, or connection_string is required')
      }
    }

    // Validate port range
    if (config.port && (config.port < 1 || config.port > 65535)) {
      errors.push('Port must be between 1 and 65535')
    }

    // Validate pool sizes
    if (config.poolMin !== undefined && config.poolMin < 0) {
      errors.push('Pool minimum size cannot be negative')
    }

    if (config.poolMax !== undefined && config.poolMax < 1) {
      errors.push('Pool maximum size must be at least 1')
    }

    if (
      config.poolMin !== undefined &&
      config.poolMax !== undefined &&
      config.poolMin > config.poolMax
    ) {
      errors.push('Pool minimum size cannot be greater than maximum size')
    }

    return errors
  }
}

/**
 * Convenience function to create adapter
 */
export function createDatabaseAdapter(config: ConnectionConfig): BaseDatabaseAdapter {
  // Validate configuration
  const errors = AdapterFactory.validateConfig(config)
  if (errors.length > 0) {
    throw new Error(`Invalid configuration: ${errors.join(', ')}`)
  }

  return AdapterFactory.createAdapter(config)
}

/**
 * Type guard for ConnectionConfig
 */
export function isValidConnectionConfig(config: any): config is ConnectionConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    'db_type' in config &&
    'database' in config
  )
}
