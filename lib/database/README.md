# Database Adapter Architecture

This directory contains the database adapter pattern implementation for NLSQL Pro, enabling support for multiple database types with a unified interface.

## Supported Databases

✅ **PostgreSQL** - Full support (all 34 methods implemented)
✅ **MySQL** - Full support (all 34 methods implemented)
✅ **SQLite** - Full support (all 34 methods implemented)
✅ **SQL Server** - Full support (all 34 methods implemented)
⏳ **MongoDB** - Coming in Week 8+ (if needed)

## Architecture Overview

```
lib/database/
├── adapters/
│   ├── base-adapter.ts          # Abstract base class for all adapters
│   ├── adapter-factory.ts       # Factory for creating adapters
│   ├── postgresql-adapter.ts    # PostgreSQL implementation ✅
│   ├── mysql-adapter.ts         # MySQL implementation ✅
│   ├── sqlite-adapter.ts        # SQLite implementation ✅
│   └── sqlserver-adapter.ts     # SQL Server implementation ✅
├── types/
│   ├── database.ts              # Core database types
│   └── schema.ts                # Schema metadata types
├── pool-cache.ts                # Connection pool caching ✅
└── README.md                    # This file
```

## Design Principles

### 1. **Abstraction**
All database-specific logic is encapsulated in adapter classes that extend `BaseDatabaseAdapter`. This allows the rest of the application to work with a consistent interface regardless of the underlying database.

### 2. **Type Safety**
Comprehensive TypeScript types ensure compile-time safety and excellent IDE support.

### 3. **Separation of Concerns**
- **Connection Management**: Pool creation, testing, statistics
- **Schema Introspection**: Table/column metadata, relationships
- **Query Execution**: Safe query execution with timeouts
- **SQL Generation**: Database-specific syntax handling
- **Error Handling**: Standardized error mapping

### 4. **Extensibility**
Adding support for a new database type only requires:
1. Create a new adapter class extending `BaseDatabaseAdapter`
2. Implement all abstract methods
3. Register it in `AdapterFactory`

## Core Components

### BaseDatabaseAdapter

Abstract class defining the interface all adapters must implement.

**Key Methods:**
- `createPool()` / `closePool()` - Connection lifecycle
- `getSchema()` - Complete schema introspection
- `executeQuery()` - Safe query execution
- `formatSchemaForPrompt()` - LLM-ready schema formatting
- `mapError()` - Standardized error handling

### AdapterFactory

Factory class for creating adapter instances based on database type.

**Usage:**
```typescript
import { AdapterFactory } from '@/lib/database/adapters/adapter-factory'
import { DatabaseType } from '@/lib/database/types/database'

const config = {
  db_type: DatabaseType.POSTGRESQL,
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'user',
  password_encrypted: '...',
}

const adapter = AdapterFactory.createAdapter(config)
await adapter.createPool()

const schema = await adapter.getSchema()
const result = await adapter.executeQuery('SELECT * FROM users LIMIT 10')

await adapter.closePool()
```

### Type Definitions

#### `database.ts`
- `DatabaseType` - Enum of supported databases
- `ConnectionConfig` - Generic connection configuration
- `QueryResult<T>` - Standardized query result format
- `TestConnectionResult` - Connection test response
- `DatabaseError` - Standardized error class

#### `schema.ts`
- `SchemaInfo` - Complete database schema
- `TableMetadata` - Table-level metadata
- `ColumnMetadata` - Column-level metadata
- `RelationshipMetadata` - Foreign key relationships
- `PromptContext` - LLM-formatted schema

## Implementation Roadmap

### ✅ Week 3: Architecture Design (COMPLETED)
- [x] Create base adapter interface
- [x] Define type system
- [x] Implement adapter factory
- [x] Write comprehensive documentation

### ✅ Week 4: PostgreSQL Adapter (COMPLETED)
- [x] Extract existing PostgreSQL logic into adapter class
- [x] Implement all 34 abstract methods
- [x] Add PostgreSQL-specific optimizations
- [x] Create comprehensive tests (8/8 passing)

### ✅ Week 5: Adapter Factory Integration (COMPLETED)
- [x] Update API routes to use adapters
- [x] Migrate to adapter pattern
- [x] Ensure backward compatibility
- [x] Integration testing

### ✅ Week 6: MySQL & SQLite Adapters (COMPLETED)
- [x] MySQL adapter (all 34 methods)
- [x] SQLite adapter (all 34 methods)
- [x] Connection pool caching mechanism
- [x] Comprehensive test suites for both

### ✅ Week 7: SQL Server Adapter (COMPLETED)
- [x] SQL Server adapter (all 34 methods)
- [x] T-SQL syntax support (TOP, IDENTITY, square brackets)
- [x] sys.* catalog views integration
- [x] Comprehensive test suite

### ⏳ Week 8+: Additional Features
- [ ] MongoDB adapter (NoSQL translation)
- [ ] Schema caching with TTL
- [ ] Advanced pool monitoring
- [ ] Query result caching

## Adapter Implementation Guide

When implementing a new adapter, you must implement ALL methods from `BaseDatabaseAdapter`. Here's a checklist:

### Connection Management
- [ ] `createPool()` - Initialize connection pool
- [ ] `closePool()` - Cleanup resources
- [ ] `testConnection()` - Test connectivity
- [ ] `getPoolStats()` - Pool statistics

### Schema Introspection
- [ ] `getSchema()` - Full schema with options support
- [ ] `getTables()` - List all tables
- [ ] `getTableMetadata()` - Detailed table info
- [ ] `getRelationships()` - Foreign keys
- [ ] `sampleTable()` - Sample data

### Query Execution
- [ ] `executeQuery()` - Execute with options
- [ ] `executeWithTimeout()` - With timeout handling
- [ ] `explainQuery()` - Query plan analysis

### SQL Generation & Validation
- [ ] `getSQLDialect()` - Dialect identifier
- [ ] `validateQuery()` - Syntax validation
- [ ] `sanitizeQuery()` - Security sanitization
- [ ] `enforceRowLimit()` - Database-specific LIMIT syntax
- [ ] `getTimeoutSQL()` - Database-specific timeout

### LLM Integration
- [ ] `formatSchemaForPrompt()` - Human-readable schema
- [ ] `getSQLGenerationGuidelines()` - Database-specific rules
- [ ] `getExampleQueries()` - Sample queries

### Error Handling
- [ ] `mapError()` - Standardized error mapping
- [ ] `isConnectionError()` - Detect connection failures
- [ ] `isTimeoutError()` - Detect timeouts
- [ ] `isSyntaxError()` - Detect syntax errors

### Utilities
- [ ] `getServerVersion()` - Database version
- [ ] `getCurrentDatabase()` - Current database name
- [ ] `tableExists()` - Check table existence
- [ ] `columnExists()` - Check column existence

## Example: PostgreSQL Adapter Structure

```typescript
import { BaseDatabaseAdapter } from './base-adapter'
import { Pool } from 'pg'
import type { ConnectionConfig, QueryResult } from '../types/database'

export class PostgreSQLAdapter extends BaseDatabaseAdapter {
  private pool: Pool | null = null

  async createPool(): Promise<void> {
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port || 5432,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      // ... pool options
    })
    this.isConnected = true
  }

  async executeQuery<T>(sql: string, options?: QueryOptions): Promise<QueryResult<T>> {
    if (!this.pool) throw new Error('Pool not initialized')

    const client = await this.pool.connect()
    try {
      const result = await client.query(sql)
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
      }
    } finally {
      client.release()
    }
  }

  // ... implement all other abstract methods
}
```

## Testing Guidelines

Each adapter should have comprehensive tests covering:

1. **Connection Tests**
   - Successful connection
   - Failed connection handling
   - Pool statistics
   - Connection timeout

2. **Schema Tests**
   - Table listing
   - Column metadata
   - Foreign key detection
   - Index information

3. **Query Tests**
   - Simple SELECT
   - JOIN queries
   - Timeout enforcement
   - Row limit enforcement

4. **Error Handling Tests**
   - Syntax errors
   - Invalid table names
   - Connection errors
   - Timeout errors

5. **SQL Generation Tests**
   - Row limit enforcement
   - Timeout SQL generation
   - Query sanitization

## Migration from Legacy Code

The adapter pattern replaces direct database calls throughout the codebase:

**Before:**
```typescript
import { Pool } from 'pg'

const pool = new Pool({ ... })
const result = await pool.query('SELECT * FROM users')
```

**After:**
```typescript
import { AdapterFactory } from '@/lib/database/adapters/adapter-factory'

const adapter = AdapterFactory.createAdapter(config)
await adapter.createPool()
const result = await adapter.executeQuery('SELECT * FROM users')
```

**Benefits:**
- Database-agnostic code
- Standardized error handling
- Built-in safety measures
- Easy to test with mocks

## Performance Considerations

1. **Connection Pooling**
   - Adapters manage their own connection pools
   - Pool sizes configurable per database type
   - Automatic cleanup on close

2. **Schema Caching**
   - Schema introspection can be expensive
   - Consider implementing caching in the adapter
   - TTL-based cache invalidation

3. **Query Optimization**
   - `explainQuery()` provides query plan analysis
   - Use to detect expensive queries before execution

## Connection Pool Caching

The pool cache manager allows reusing adapter instances across requests, reducing connection overhead.

### Usage

**Basic Usage:**
```typescript
import { getCachedAdapter } from '@/lib/database'

// Get adapter from cache or create new one
const adapter = await getCachedAdapter(config)

// Use adapter (pool already initialized)
const result = await adapter.executeQuery('SELECT * FROM users LIMIT 10')

// Don't close! Cache will manage lifecycle
```

**Cache Management:**
```typescript
import { PoolCacheManager, getCacheStats, clearCache } from '@/lib/database'

// Get cache statistics
const stats = getCacheStats()
console.log(`Cached adapters: ${stats.totalAdapters}`)
console.log(`Cache limit: ${stats.maxCacheSize}`)

// Clear all cached connections
await clearCache()

// Configure cache (optional)
const cache = PoolCacheManager.getInstance({
  maxCacheSize: 20,           // Max number of cached adapters
  idleTimeoutMs: 5 * 60 * 1000,  // 5 minutes idle timeout
  cleanupIntervalMs: 60 * 1000    // Cleanup every minute
})
```

### Features

- **LRU Eviction**: Least recently used adapters are evicted when cache is full
- **Automatic Cleanup**: Idle connections are automatically closed
- **Connection Reuse**: Reduces overhead of creating new connections
- **Per-Connection Caching**: Keyed by connection ID or config hash

### Best Practices

1. **Use in API Routes**: Cache adapters in serverless/API route handlers
2. **Don't Close Cached Adapters**: Let the cache manage lifecycle
3. **Monitor Cache Stats**: Check for excessive cache evictions
4. **Tune Cache Size**: Balance between performance and resource usage

### Example: API Route with Cache

```typescript
import { getCachedAdapter } from '@/lib/database'

export async function GET(request: Request) {
  // Get from cache (fast!)
  const adapter = await getCachedAdapter(connectionConfig)

  // Execute query
  const result = await adapter.executeQuery('SELECT * FROM users LIMIT 10')

  // Return response (adapter stays in cache)
  return NextResponse.json(result)
}
```

## Security Notes

1. **Credential Encryption**
   - Always use `password_encrypted` field
   - Decrypt only when creating connection pool
   - Never log decrypted credentials

2. **SQL Injection Prevention**
   - `sanitizeQuery()` must block dangerous patterns
   - Always validate before execution
   - Use parameterized queries when possible

3. **Read-Only Mode**
   - Enforce SELECT-only in `validateQuery()`
   - Block DDL/DML operations
   - Return errors for non-SELECT queries

## Troubleshooting

### "Adapter not yet implemented" Error
**Cause**: Requesting an adapter that hasn't been implemented yet

**Solution**: Check `AdapterFactory.getSupportedDatabases()` for currently supported databases

### Connection Pool Exhaustion
**Cause**: Too many concurrent queries

**Solution**: Increase `poolMax` in connection config or implement query queuing

### Schema Introspection Slow
**Cause**: Large databases with many tables

**Solution**: Use `SchemaOptions` to filter specific tables or implement caching

## Contributing

When adding a new adapter:

1. Create adapter file in `adapters/`
2. Extend `BaseDatabaseAdapter`
3. Implement ALL abstract methods
4. Add to `AdapterFactory.createAdapter()`
5. Update `AdapterFactory.getSupportedDatabases()`
6. Write comprehensive tests
7. Update this README

## Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [SQL Server Documentation](https://docs.microsoft.com/en-us/sql/)
- [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser)
