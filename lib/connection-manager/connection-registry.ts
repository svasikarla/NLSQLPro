/**
 * Connection Registry
 * Central registry for managing database-specific connection managers
 */

import type { BaseConnectionManager } from './core/base-connection-manager'
import type { DatabaseConnection } from '../connection-manager'
import { PostgreSQLConnectionManager } from './managers/postgresql-connection-manager'
import { MySQLConnectionManager } from './managers/mysql-connection-manager'
import { SQLServerConnectionManager } from './managers/sqlserver-connection-manager'
import { SQLiteConnectionManager } from './managers/sqlite-connection-manager'

/**
 * Connection Registry
 * Factory and registry for database-specific connection managers
 */
export class ConnectionRegistry {
  private static managers = new Map<string, BaseConnectionManager>()

  /**
   * Get connection manager for a specific database type
   */
  static getManager(dbType: string): BaseConnectionManager {
    // Return cached manager if exists
    if (this.managers.has(dbType)) {
      return this.managers.get(dbType)!
    }

    // Create new manager
    let manager: BaseConnectionManager

    switch (dbType.toLowerCase()) {
      case 'postgresql':
        manager = new PostgreSQLConnectionManager()
        break

      case 'mysql':
        manager = new MySQLConnectionManager()
        break

      case 'sqlserver':
        manager = new SQLServerConnectionManager()
        break

      case 'sqlite':
        manager = new SQLiteConnectionManager()
        break

      default:
        throw new Error(`Unsupported database type: ${dbType}`)
    }

    // Cache manager
    this.managers.set(dbType, manager)
    return manager
  }

  /**
   * Get connection manager for a database connection
   */
  static getManagerForConnection(connection: DatabaseConnection): BaseConnectionManager {
    return this.getManager(connection.db_type)
  }

  /**
   * Get all registered managers
   */
  static getAllManagers(): Map<string, BaseConnectionManager> {
    // Ensure all managers are initialized
    const types = ['postgresql', 'mysql', 'sqlserver', 'sqlite']
    types.forEach(type => this.getManager(type))

    return new Map(this.managers)
  }

  /**
   * Clear all cached managers
   */
  static clearCache(): void {
    this.managers.clear()
  }

  /**
   * Get supported database types
   */
  static getSupportedTypes(): string[] {
    return ['postgresql', 'mysql', 'sqlserver', 'sqlite']
  }

  /**
   * Check if database type is supported
   */
  static isSupported(dbType: string): boolean {
    return this.getSupportedTypes().includes(dbType.toLowerCase())
  }

  /**
   * Get database type display names
   */
  static getDatabaseDisplayNames(): Record<string, string> {
    return {
      postgresql: 'PostgreSQL',
      mysql: 'MySQL',
      sqlserver: 'SQL Server',
      sqlite: 'SQLite',
    }
  }

  /**
   * Get default ports for all database types
   */
  static getDefaultPorts(): Record<string, number> {
    const result: Record<string, number> = {}
    const types = this.getSupportedTypes()

    types.forEach(type => {
      const manager = this.getManager(type)
      result[type] = manager.getDefaultPort()
    })

    return result
  }

  /**
   * Validate connection for any database type
   */
  static validateConnection(
    connection: DatabaseConnection
  ): { valid: boolean; errors: string[] } {
    try {
      const manager = this.getManagerForConnection(connection)
      return manager.validateConnection(connection)
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      }
    }
  }

  /**
   * Get connection help for any database type
   */
  static getConnectionHelp(dbType: string): string {
    try {
      const manager = this.getManager(dbType)
      return manager.getConnectionHelp()
    } catch (error) {
      return `Database type "${dbType}" is not supported.`
    }
  }

  /**
   * Get recommended timeout for a connection
   */
  static getRecommendedTimeout(connection: DatabaseConnection): number {
    try {
      const manager = this.getManagerForConnection(connection)
      return manager.getRecommendedTimeout(connection)
    } catch (error) {
      return 20000 // Default 20 seconds
    }
  }

  /**
   * Get SSL config for a connection
   */
  static getSSLConfig(connection: DatabaseConnection): any {
    try {
      const manager = this.getManagerForConnection(connection)
      return manager.getSSLConfig(connection)
    } catch (error) {
      return undefined
    }
  }

  /**
   * Get provider information for a connection
   */
  static getProviderInfo(connection: DatabaseConnection): {
    provider: string
    hints: string[]
    isCloud: boolean
  } {
    try {
      const manager = this.getManagerForConnection(connection) as any

      // Check if manager has provider methods
      const provider = manager.getProvider ? manager.getProvider(connection) : 'Unknown'
      const hints = manager.getProviderHints ? manager.getProviderHints(connection) : []
      const isCloud = manager.isCloudDatabase ? manager.isCloudDatabase(connection) : false

      return { provider, hints, isCloud }
    } catch (error) {
      return {
        provider: 'Unknown',
        hints: [],
        isCloud: false,
      }
    }
  }

  /**
   * Get metrics for a connection
   */
  static getMetrics(dbType: string, connectionId: string) {
    try {
      const manager = this.getManager(dbType)
      return manager.getMetrics(connectionId)
    } catch (error) {
      return undefined
    }
  }

  /**
   * Get all metrics for a database type
   */
  static getAllMetricsForType(dbType: string) {
    try {
      const manager = this.getManager(dbType)
      return manager.getAllMetrics()
    } catch (error) {
      return new Map()
    }
  }

  /**
   * Reset metrics for a connection
   */
  static resetMetrics(dbType: string, connectionId?: string): void {
    try {
      const manager = this.getManager(dbType)
      if (connectionId) {
        manager.clearMetrics(connectionId)
      } else {
        manager.resetMetrics()
      }
    } catch (error) {
      console.error('Error resetting metrics:', error)
    }
  }
}

/**
 * Convenience functions
 */

export function getConnectionManager(dbType: string): BaseConnectionManager {
  return ConnectionRegistry.getManager(dbType)
}

export function getManagerForConnection(connection: DatabaseConnection): BaseConnectionManager {
  return ConnectionRegistry.getManagerForConnection(connection)
}

export function validateConnectionConfig(
  connection: DatabaseConnection
): { valid: boolean; errors: string[] } {
  return ConnectionRegistry.validateConnection(connection)
}

export function getProviderInfo(connection: DatabaseConnection) {
  return ConnectionRegistry.getProviderInfo(connection)
}
