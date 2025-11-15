/**
 * Schema type definitions
 * Standardized schema information across all database types
 */

/**
 * Column metadata
 */
export interface ColumnMetadata {
  column_name: string
  data_type: string
  is_nullable: string | boolean // 'YES'/'NO' or true/false
  is_primary_key?: boolean
  is_unique?: boolean
  is_auto_increment?: boolean
  default_value?: any
  max_length?: number
  precision?: number
  scale?: number

  // Foreign key information
  foreign_key?: {
    refTable: string
    refColumn: string
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
  }

  // Additional metadata
  comment?: string
  collation?: string
  character_set?: string
}

/**
 * Table metadata
 */
export interface TableMetadata {
  table_name: string
  table_schema?: string
  table_type?: 'BASE TABLE' | 'VIEW' | 'SYSTEM VIEW'
  columns: ColumnMetadata[]
  row_count?: number

  // Indexes
  indexes?: IndexMetadata[]

  // Constraints
  primaryKey?: string[]
  uniqueConstraints?: string[][]

  // Additional metadata
  comment?: string
  engine?: string // MySQL specific
  collation?: string
  created_at?: Date
  updated_at?: Date
}

/**
 * Index metadata
 */
export interface IndexMetadata {
  index_name: string
  columns: string[]
  is_unique: boolean
  is_primary: boolean
  index_type?: 'BTREE' | 'HASH' | 'GIN' | 'GIST' | 'FULLTEXT'
}

/**
 * Relationship metadata (foreign keys)
 */
export interface RelationshipMetadata {
  from: string // table name
  fromCol: string // column name
  to: string // referenced table
  toCol: string // referenced column
  constraintName?: string
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
}

/**
 * Complete schema information
 */
export interface SchemaInfo {
  tables: Record<string, ColumnMetadata[]> // table_name -> columns
  relationships?: RelationshipMetadata[]

  // Optional: More detailed table info
  tableMetadata?: TableMetadata[]

  // Database-specific metadata
  databaseVersion?: string
  characterSet?: string
  collation?: string
}

/**
 * Schema introspection options
 */
export interface SchemaOptions {
  // Filter specific tables
  includeTablePattern?: string | RegExp
  excludeTablePattern?: string | RegExp

  // Include/exclude specific schemas
  schemas?: string[]

  // Include sample data
  includeSampleData?: boolean
  sampleRows?: number

  // Include statistics
  includeRowCounts?: boolean
  includeIndexes?: boolean

  // Caching
  useCache?: boolean
  cacheTTL?: number
}

/**
 * LLM prompt context
 * Formatted schema information for LLM prompts
 */
export interface PromptContext {
  schemaText: string // Formatted schema description
  tables: string[] // List of table names
  relationships: RelationshipMetadata[]
  examples?: string[] // Sample JOIN queries
  businessGlossary?: Record<string, string> // Custom term mappings
}
