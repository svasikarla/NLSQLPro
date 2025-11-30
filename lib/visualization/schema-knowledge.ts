/**
 * Schema Knowledge Base
 *
 * Builds semantic understanding of database schema by analyzing metadata.
 * This RAG component uses database introspection to enrich type detection
 * and chart recommendations with context-aware intelligence.
 *
 * Key Features:
 * - Semantic type inference (e.g., "email", "currency", "percentage")
 * - Cardinality estimation from schema constraints
 * - Relationship-aware column analysis
 * - Business context enrichment
 */

import { ColumnMetadata, RelationshipMetadata, SchemaInfo } from '@/lib/database/types/schema'

/**
 * Semantic column types beyond basic SQL types
 * These represent business meaning that informs visualization choices
 */
export type SemanticType =
  | 'identifier'        // IDs, UUIDs, keys
  | 'temporal'          // Dates, timestamps
  | 'numeric_discrete'  // Counts, quantities
  | 'numeric_continuous'// Prices, percentages, measurements
  | 'categorical'       // Status, type, category
  | 'boolean'           // True/false, yes/no
  | 'text_short'        // Names, titles
  | 'text_long'         // Descriptions, notes
  | 'email'             // Email addresses
  | 'url'               // URLs
  | 'currency'          // Money values
  | 'percentage'        // 0-100 or 0.0-1.0
  | 'rating'            // Star ratings, scores
  | 'unknown'           // Fallback

/**
 * Cardinality estimate for chart recommendations
 */
export type CardinalityEstimate =
  | 'unique'            // Every value is different (e.g., ID, email)
  | 'very_high'         // >1000 distinct values
  | 'high'              // 100-1000 distinct values
  | 'medium'            // 20-100 distinct values
  | 'low'               // 5-20 distinct values
  | 'very_low'          // 2-5 distinct values (e.g., boolean, status)
  | 'constant'          // Single value

/**
 * Enriched column metadata with semantic understanding
 */
export interface EnrichedColumnMetadata {
  columnName: string
  dbType: string
  semanticType: SemanticType
  cardinality: CardinalityEstimate
  isPrimaryKey: boolean
  isForeignKey: boolean
  foreignKeyTo?: {
    table: string
    column: string
  }
  isNullable: boolean

  // Additional context
  isUnique?: boolean
  isAutoIncrement?: boolean
  hasDefault?: boolean

  // Confidence in semantic type inference
  confidence: 'high' | 'medium' | 'low'
  reasoning: string[]
}

/**
 * Schema knowledge base for a database connection
 */
export interface SchemaKnowledge {
  connectionId: string
  tables: Map<string, EnrichedColumnMetadata[]>
  relationships: RelationshipMetadata[]
  lastUpdated: Date
}

/**
 * Infer semantic type from database column metadata
 * Uses column name patterns, data types, and constraints
 */
export function inferSemanticType(column: ColumnMetadata, columnName: string): {
  type: SemanticType
  confidence: 'high' | 'medium' | 'low'
  reasoning: string[]
} {
  const reasoning: string[] = []
  const lowerName = columnName.toLowerCase()
  const lowerType = column.data_type.toLowerCase()

  // PRIMARY KEY / AUTO INCREMENT → Identifier
  if (column.is_primary_key || column.is_auto_increment) {
    reasoning.push('Column is primary key or auto-increment')
    return { type: 'identifier', confidence: 'high', reasoning }
  }

  // TEMPORAL types (timestamp, date, datetime)
  if (['timestamp', 'timestamptz', 'date', 'datetime', 'time'].some(t => lowerType.includes(t))) {
    reasoning.push(`Database type is temporal: ${column.data_type}`)
    return { type: 'temporal', confidence: 'high', reasoning }
  }

  // BOOLEAN types
  if (['bool', 'boolean', 'tinyint(1)'].some(t => lowerType.includes(t))) {
    reasoning.push(`Database type is boolean: ${column.data_type}`)
    return { type: 'boolean', confidence: 'high', reasoning }
  }

  // COLUMN NAME PATTERNS (Semantic heuristics)

  // Email
  if (lowerName.includes('email') || lowerName.includes('e_mail')) {
    reasoning.push('Column name suggests email address')
    return { type: 'email', confidence: 'high', reasoning }
  }

  // URL
  if (lowerName.includes('url') || lowerName.includes('link') || lowerName === 'website') {
    reasoning.push('Column name suggests URL')
    return { type: 'url', confidence: 'high', reasoning }
  }

  // Currency
  if (lowerName.includes('price') || lowerName.includes('cost') || lowerName.includes('amount') ||
    lowerName.includes('revenue') || lowerName.includes('salary') || lowerName === 'total') {
    if (['decimal', 'numeric', 'money'].some(t => lowerType.includes(t))) {
      reasoning.push('Column name and decimal type suggest currency')
      return { type: 'currency', confidence: 'high', reasoning }
    }
    reasoning.push('Column name suggests currency value')
    return { type: 'currency', confidence: 'medium', reasoning }
  }

  // Percentage
  if (lowerName.includes('percent') || lowerName.includes('rate') || lowerName.includes('ratio')) {
    reasoning.push('Column name suggests percentage')
    return { type: 'percentage', confidence: 'medium', reasoning }
  }

  // Rating
  if (lowerName.includes('rating') || lowerName.includes('score') || lowerName.includes('stars')) {
    reasoning.push('Column name suggests rating or score')
    return { type: 'rating', confidence: 'medium', reasoning }
  }

  // Categorical (status, type, category, enum)
  if (lowerName.includes('status') || lowerName.includes('type') || lowerName.includes('category') ||
    lowerName.includes('kind') || lowerName === 'state' || lowerType.includes('enum')) {
    reasoning.push('Column name or enum type suggests categorical data')
    return { type: 'categorical', confidence: 'high', reasoning }
  }

  // ID fields (not primary key)
  if (lowerName.endsWith('_id') || lowerName.startsWith('id_') || lowerName === 'id' ||
    lowerName.includes('uuid') || column.is_unique) {
    reasoning.push('Column name or unique constraint suggests identifier')
    return { type: 'identifier', confidence: 'high', reasoning }
  }

  // NUMERIC types
  if (['int', 'integer', 'bigint', 'smallint', 'serial', 'bigserial'].some(t => lowerType.includes(t))) {
    // Discrete numeric (counts, quantities)
    if (lowerName.includes('count') || lowerName.includes('quantity') || lowerName.includes('num') ||
      lowerName.includes('total') || lowerName.includes('age')) {
      reasoning.push('Integer type with count/quantity name pattern')
      return { type: 'numeric_discrete', confidence: 'high', reasoning }
    }
    reasoning.push('Integer type suggests discrete numeric')
    return { type: 'numeric_discrete', confidence: 'medium', reasoning }
  }

  if (['decimal', 'numeric', 'float', 'double', 'real', 'money'].some(t => lowerType.includes(t))) {
    reasoning.push('Decimal/float type suggests continuous numeric')
    return { type: 'numeric_continuous', confidence: 'high', reasoning }
  }

  // TEXT types
  if (['varchar', 'char', 'text', 'string'].some(t => lowerType.includes(t))) {
    // Long text (descriptions, notes, comments)
    if (lowerName.includes('description') || lowerName.includes('note') || lowerName.includes('comment') ||
      lowerName.includes('bio') || lowerName.includes('details') || lowerType.includes('text')) {
      reasoning.push('Text type with description/note name pattern')
      return { type: 'text_long', confidence: 'high', reasoning }
    }

    // Name/title fields
    if (lowerName.includes('name') || lowerName.includes('title') || lowerName === 'label') {
      reasoning.push('Text type with name/title pattern')
      return { type: 'text_short', confidence: 'high', reasoning }
    }

    // Short strings with length limit
    if (column.max_length && column.max_length <= 100) {
      reasoning.push(`Text type with short max length (${column.max_length})`)
      return { type: 'text_short', confidence: 'medium', reasoning }
    }

    reasoning.push('Text type without specific pattern')
    return { type: 'text_long', confidence: 'low', reasoning }
  }

  // Fallback
  reasoning.push('No semantic pattern matched')
  return { type: 'unknown', confidence: 'low', reasoning }
}

/**
 * Estimate cardinality from schema constraints
 * Uses primary key, unique constraints, and data type hints
 */
export function estimateCardinality(column: ColumnMetadata, columnName: string): {
  estimate: CardinalityEstimate
  reasoning: string[]
} {
  const reasoning: string[] = []
  const lowerName = columnName.toLowerCase()
  const lowerType = column.data_type.toLowerCase()

  // UNIQUE or PRIMARY KEY → unique cardinality
  if (column.is_primary_key || column.is_unique) {
    reasoning.push('Column has unique constraint or is primary key')
    return { estimate: 'unique', reasoning }
  }

  // FOREIGN KEY → depends on referenced table
  // For now, estimate as medium (will be refined with actual data later)
  if (column.foreign_key) {
    reasoning.push(`Foreign key to ${column.foreign_key.refTable}.${column.foreign_key.refColumn}`)
    return { estimate: 'medium', reasoning }
  }

  // BOOLEAN → very_low cardinality (2-3 values)
  if (['bool', 'boolean', 'tinyint(1)'].some(t => lowerType.includes(t))) {
    reasoning.push('Boolean type has 2-3 distinct values')
    return { estimate: 'very_low', reasoning }
  }

  // ENUM type → low to medium cardinality
  if (lowerType.includes('enum')) {
    reasoning.push('Enum type typically has 5-20 values')
    return { estimate: 'low', reasoning }
  }

  // CATEGORICAL name patterns → low cardinality
  if (lowerName.includes('status') || lowerName.includes('type') || lowerName.includes('category') ||
    lowerName.includes('kind') || lowerName === 'state') {
    reasoning.push('Categorical name pattern suggests low cardinality')
    return { estimate: 'low', reasoning }
  }

  // TEMPORAL types → could be high cardinality
  if (['timestamp', 'timestamptz', 'datetime'].some(t => lowerType.includes(t))) {
    reasoning.push('Timestamp can have high cardinality (one per record)')
    return { estimate: 'very_high', reasoning }
  }

  // Date (not timestamp) → medium to high cardinality
  if (lowerType === 'date') {
    reasoning.push('Date type typically has medium to high cardinality')
    return { estimate: 'high', reasoning }
  }

  // NUMERIC types → assume medium by default
  if (['int', 'integer', 'bigint', 'decimal', 'numeric', 'float'].some(t => lowerType.includes(t))) {
    reasoning.push('Numeric type, cardinality depends on domain')
    return { estimate: 'medium', reasoning }
  }

  // TEXT types → assume high cardinality
  if (['varchar', 'text', 'char'].some(t => lowerType.includes(t))) {
    reasoning.push('Text type typically has high cardinality')
    return { estimate: 'high', reasoning }
  }

  // Default fallback
  reasoning.push('No cardinality hints found, assuming medium')
  return { estimate: 'medium', reasoning }
}

/**
 * Build enriched schema knowledge base from raw schema metadata
 * This is the RAG pipeline's knowledge extraction step
 */
export function buildSchemaKnowledge(
  connectionId: string,
  schemaInfo: SchemaInfo
): SchemaKnowledge {
  const tables = new Map<string, EnrichedColumnMetadata[]>()

  // Process each table
  for (const [tableName, columns] of Object.entries(schemaInfo.tables)) {
    if (!Array.isArray(columns)) {
      console.warn(`[Schema Knowledge] Invalid columns for table ${tableName}:`, columns)
      continue
    }

    const enrichedColumns: EnrichedColumnMetadata[] = []

    for (const column of columns) {
      // Infer semantic type
      const semanticTypeResult = inferSemanticType(column, column.column_name)

      // Estimate cardinality
      const cardinalityResult = estimateCardinality(column, column.column_name)

      // Build enriched metadata
      const enriched: EnrichedColumnMetadata = {
        columnName: column.column_name,
        dbType: column.data_type,
        semanticType: semanticTypeResult.type,
        cardinality: cardinalityResult.estimate,
        isPrimaryKey: column.is_primary_key || false,
        isForeignKey: !!column.foreign_key,
        foreignKeyTo: column.foreign_key ? {
          table: column.foreign_key.refTable,
          column: column.foreign_key.refColumn
        } : undefined,
        isNullable: column.is_nullable === 'YES' || column.is_nullable === true,
        isUnique: column.is_unique,
        isAutoIncrement: column.is_auto_increment,
        hasDefault: column.default_value !== undefined && column.default_value !== null,
        confidence: semanticTypeResult.confidence,
        reasoning: [
          ...semanticTypeResult.reasoning,
          ...cardinalityResult.reasoning
        ]
      }

      enrichedColumns.push(enriched)
    }

    tables.set(tableName, enrichedColumns)
  }

  return {
    connectionId,
    tables,
    relationships: schemaInfo.relationships || [],
    lastUpdated: new Date()
  }
}

/**
 * Get enriched column metadata by name from schema knowledge
 */
export function getEnrichedColumn(
  schemaKnowledge: SchemaKnowledge,
  tableName: string,
  columnName: string
): EnrichedColumnMetadata | null {
  const tableColumns = schemaKnowledge.tables.get(tableName)
  if (!tableColumns) return null

  return tableColumns.find(c => c.columnName.toLowerCase() === columnName.toLowerCase()) || null
}

/**
 * Get all columns of a specific semantic type across all tables
 */
export function getColumnsBySemanticType(
  schemaKnowledge: SchemaKnowledge,
  semanticType: SemanticType
): Array<{ table: string; column: EnrichedColumnMetadata }> {
  const results: Array<{ table: string; column: EnrichedColumnMetadata }> = []

  for (const [tableName, columns] of schemaKnowledge.tables.entries()) {
    for (const column of columns) {
      if (column.semanticType === semanticType) {
        results.push({ table: tableName, column })
      }
    }
  }

  return results
}

/**
 * Find related columns through foreign key relationships
 */
export function getRelatedColumns(
  schemaKnowledge: SchemaKnowledge,
  tableName: string,
  columnName: string
): Array<{ table: string; column: string; relationship: 'references' | 'referenced_by' }> {
  const related: Array<{ table: string; column: string; relationship: 'references' | 'referenced_by' }> = []

  // Find direct foreign key references
  const tableColumns = schemaKnowledge.tables.get(tableName)
  if (tableColumns) {
    const column = tableColumns.find(c => c.columnName === columnName)
    if (column?.foreignKeyTo) {
      related.push({
        table: column.foreignKeyTo.table,
        column: column.foreignKeyTo.column,
        relationship: 'references'
      })
    }
  }

  // Find reverse relationships (columns that reference this one)
  for (const relationship of schemaKnowledge.relationships) {
    if (relationship.to === tableName && relationship.toCol === columnName) {
      related.push({
        table: relationship.from,
        column: relationship.fromCol,
        relationship: 'referenced_by'
      })
    }
  }

  return related
}
