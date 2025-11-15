/**
 * Database Adapter Module
 * Main entry point for database adapter functionality
 */

// Export types
export type {
  ConnectionConfig,
  QueryResult,
  TestConnectionResult,
  QueryValidationResult,
  PoolStats,
  QueryOptions,
  FieldInfo,
} from './types/database'

export type {
  SchemaInfo,
  SchemaOptions,
  PromptContext,
  TableMetadata,
  ColumnMetadata,
  RelationshipMetadata,
  IndexMetadata,
} from './types/schema'

// Export enums
export { DatabaseType } from './types/database'

// Export errors
export { DatabaseError } from './types/database'

// Export base adapter
export { BaseDatabaseAdapter } from './adapters/base-adapter'
export type { AdapterFactory as AdapterFactoryInterface } from './adapters/base-adapter'

// Export factory
export {
  AdapterFactory,
  createDatabaseAdapter,
  isValidConnectionConfig,
} from './adapters/adapter-factory'

// Re-export adapters as they are implemented
export { PostgreSQLAdapter } from './adapters/postgresql-adapter'
export { MySQLAdapter } from './adapters/mysql-adapter'
export { SQLiteAdapter } from './adapters/sqlite-adapter'
export { SQLServerAdapter } from './adapters/sqlserver-adapter'

// Export pool cache
export {
  PoolCacheManager,
  getCachedAdapter,
  invalidateCache,
  getCacheStats,
  clearCache,
} from './pool-cache'
