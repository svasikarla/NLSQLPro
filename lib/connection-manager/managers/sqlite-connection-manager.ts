/**
 * SQLite Connection Manager
 * Handles SQLite-specific connection logic
 */

import { BaseConnectionManager } from '../core/base-connection-manager'
import type { DatabaseConnection } from '@/lib/connection-manager'

/**
 * SQLite Connection Manager
 * Optimized for SQLite file-based databases
 */
export class SQLiteConnectionManager extends BaseConnectionManager {
  getDatabaseType(): string {
    return 'SQLite'
  }

  getDefaultPort(): number {
    return 0 // SQLite doesn't use ports (file-based)
  }

  getRecommendedTimeout(connection: DatabaseConnection): number {
    // SQLite is file-based, no network timeout needed
    // But we can have file I/O timeout
    return 5000
  }

  getSSLConfig(connection: DatabaseConnection): any {
    // SQLite doesn't use SSL (file-based, no network)
    return undefined
  }

  validateConnection(connection: DatabaseConnection): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // For SQLite, database field contains the file path
    if (!connection.database || connection.database.trim().length === 0) {
      errors.push('Database file path is required')
    }

    // Validate file path format
    if (connection.database && !this.isValidFilePath(connection.database)) {
      errors.push('Invalid file path format')
    }

    // Check if it looks like an absolute path
    if (connection.database && !this.isAbsolutePath(connection.database)) {
      errors.push('⚠️ Use absolute file path for reliability (e.g., /var/data/database.sqlite or C:\\data\\database.sqlite)')
    }

    // Host, port, username, password are not used for SQLite
    if (connection.host && connection.host !== 'localhost') {
      errors.push('💡 SQLite is file-based, host is not used')
    }

    if (connection.port && connection.port !== 0) {
      errors.push('💡 SQLite is file-based, port is not used')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  getConnectionHelp(): string {
    return `
SQLite Connection Guide
=======================

File-based Database:
  Database Path: /path/to/database.sqlite
  OR: /var/data/myapp.db
  OR (Windows): C:\\data\\database.sqlite

  Note: Host, port, username, password are NOT needed

In-Memory Database (for testing):
  Database Path: :memory:
  Note: Data is lost when connection closes

Common File Extensions:
  • .sqlite
  • .sqlite3
  • .db
  • .db3
  • .s3db

File Path Examples:

Linux/Mac (Absolute):
  /var/lib/myapp/database.sqlite
  /home/user/projects/myapp/data.db
  /opt/myapp/production.sqlite

Linux/Mac (Relative - not recommended):
  ./database.sqlite
  ../data/myapp.db

Windows (Absolute):
  C:\\data\\database.sqlite
  D:\\projects\\myapp\\data.db

Windows (Relative - not recommended):
  .\\database.sqlite
  ..\\data\\myapp.db

Server Deployment:
  • Ensure file path is accessible to server
  • Set proper file permissions (read/write)
  • Use absolute paths
  • Consider using /var/lib/{app-name}/ for production
  • Backup SQLite files regularly

Common Issues:
• File not found → Check path is correct and file exists
• Permission denied → Ensure server has read/write access
• Database locked → Another process is using the database
• Relative paths → May not work in production, use absolute paths
`
  }

  /**
   * Validate file path format
   */
  private isValidFilePath(path: string): boolean {
    // Check for special cases
    if (path === ':memory:') return true

    // Basic validation: should contain file extension or be a path
    const hasExtension = /\.(sqlite|sqlite3|db|db3|s3db)$/i.test(path)
    const looksLikePath = path.includes('/') || path.includes('\\')

    return hasExtension || looksLikePath
  }

  /**
   * Check if path is absolute
   */
  private isAbsolutePath(path: string): boolean {
    // Unix/Linux absolute path
    if (path.startsWith('/')) return true

    // Windows absolute path (C:\, D:\, etc.)
    if (/^[A-Za-z]:\\/.test(path)) return true

    // Special cases
    if (path === ':memory:') return true

    return false
  }

  /**
   * Check if this is an in-memory database
   */
  isInMemory(connection: DatabaseConnection): boolean {
    return connection.database === ':memory:'
  }

  /**
   * Get file extension from database path
   */
  getFileExtension(connection: DatabaseConnection): string | null {
    const match = connection.database.match(/\.(sqlite|sqlite3|db|db3|s3db)$/i)
    return match ? match[1] : null
  }

  /**
   * Get suggested file path based on OS
   */
  getSuggestedFilePath(filename: string = 'database.sqlite'): { linux: string; windows: string } {
    return {
      linux: `/var/lib/myapp/${filename}`,
      windows: `C:\\data\\${filename}`,
    }
  }

  /**
   * Validate file permissions (would need server-side check)
   */
  getPermissionCheckHelp(): string {
    return `
To check SQLite file permissions:

Linux/Mac:
  ls -la /path/to/database.sqlite

  Should show:
  -rw-rw-r-- 1 user group ... database.sqlite

  If not writable, run:
  chmod 664 /path/to/database.sqlite
  chown user:group /path/to/database.sqlite

Windows:
  Right-click file → Properties → Security
  Ensure your application user has Read & Write permissions
`
  }

  /**
   * Get database size estimation help
   */
  getDatabaseSizeHelp(): string {
    return `
SQLite Database Size Management:

Check database size:
  Linux/Mac: ls -lh /path/to/database.sqlite
  Windows: Right-click → Properties

Optimize database:
  sqlite3 database.sqlite "VACUUM;"

Reduce database size:
  • Run VACUUM regularly to reclaim space
  • Delete old records
  • Use AUTO_VACUUM pragma

Performance tips:
  • Keep database size under 100MB for web apps
  • Use indices for frequently queried columns
  • Consider splitting large tables
  • For > 1GB databases, consider PostgreSQL/MySQL
`
  }

  /**
   * SQLite doesn't require cloud detection
   */
  isCloudDatabase(connection: DatabaseConnection): boolean {
    return false // SQLite is always local/file-based
  }

  /**
   * Get provider (always local file system)
   */
  getProvider(connection: DatabaseConnection): string {
    if (this.isInMemory(connection)) {
      return 'In-Memory (for testing)'
    }
    return 'Local File System'
  }

  /**
   * Get SQLite-specific hints
   */
  getProviderHints(connection: DatabaseConnection): string[] {
    const hints: string[] = []

    if (this.isInMemory(connection)) {
      hints.push('⚠️ In-memory database - data will be lost when connection closes')
      hints.push('💡 Great for testing, not for production')
    } else {
      hints.push('⚡ File-based database - fast for small datasets')
      hints.push('💡 Great for development, embedded apps, and small websites')
      hints.push('💡 Consider PostgreSQL/MySQL for high-traffic production apps')
      hints.push('📚 No separate database server needed')
    }

    const ext = this.getFileExtension(connection)
    if (ext) {
      hints.push(`📁 File extension: .${ext}`)
    }

    if (!this.isAbsolutePath(connection.database)) {
      hints.push('⚠️ Using relative path - may cause issues in production')
    }

    return hints
  }
}
