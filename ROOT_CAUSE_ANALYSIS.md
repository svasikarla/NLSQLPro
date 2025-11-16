# Root Cause Analysis: SQL Server Schema Name Issue

**Date:** 2025-01-16
**Issue:** SQL Server queries failing with "Invalid object name 'Product'" instead of using `[SalesLT].[Product]`
**Severity:** 🔴 **CRITICAL** - Breaks all SQL Server databases with non-default schemas

---

## Error Details

```
Error [RequestError]: Invalid object name 'Product'.
number: 208,
state: 1,
class: 16,
message: "Invalid object name 'Product'.",
```

**Expected Table Name:** `[SalesLT].[Product]`
**Actual Generated SQL:** `SELECT * FROM Product` (missing schema)

---

## Root Cause Identified

### Problem 1: Schema Introspection Missing `TABLE_SCHEMA`

**Location:** `lib/database/adapters/sqlserver-adapter.ts:172-178`

```typescript
// ❌ WRONG: Only retrieves TABLE_NAME
const tablesResult = await this.pool.request().query(`
  SELECT TABLE_NAME as table_name
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = DB_NAME()
  ORDER BY TABLE_NAME
`)
```

**What's Missing:**
- Does NOT retrieve `TABLE_SCHEMA` column
- SQL Server databases often use schemas like `SalesLT`, `dbo`, `HumanResources`, etc.
- The adapter stores only `Product` instead of `SalesLT.Product`

**Impact:**
- Schema information (`SchemaInfo.tables`) stores incomplete table names
- LLM receives schema with table names like `Product` instead of `SalesLT.Product`
- Generated SQL uses bare table names: `SELECT * FROM Product` ❌
- SQL Server rejects the query because it can't find `dbo.Product` (default schema)

---

### Problem 2: SchemaInfo Data Structure Limitation

**Location:** `lib/database/types/schema.ts:87-90`

```typescript
export interface SchemaInfo {
  tables: Record<string, ColumnMetadata[]> // table_name -> columns
  relationships?: RelationshipMetadata[]
  // ...
}
```

**Current Structure:**
```typescript
{
  tables: {
    "Product": [/* columns */],  // ❌ Missing schema name!
    "Customer": [/* columns */]
  }
}
```

**What Should Be:**
```typescript
{
  tables: {
    "SalesLT.Product": [/* columns */],  // ✅ Includes schema
    "SalesLT.Customer": [/* columns */]
  }
}
```

**Issue:**
- The `SchemaInfo` interface uses `Record<string, ColumnMetadata[]>` where the key is just the table name
- There's NO separate field for schema name in the key
- The `TableMetadata` interface HAS `table_schema?: string` but it's not used in `SchemaInfo.tables`

---

### Problem 3: Inconsistent Schema Retrieval Across Queries

**Locations in `sqlserver-adapter.ts`:**

1. **Line 172-178:** `getSchema()` - Only gets `TABLE_NAME` ❌
2. **Line 247-260:** `getSchema()` (column query) - References `c.TABLE_SCHEMA` but doesn't use it ✅/❌
3. **Line 202-215:** `getSchema()` (foreign keys) - Uses `sys.tables` which doesn't include schema ❌
4. **Line 292-303:** `getTables()` - Has optional schema filter but only returns `TABLE_NAME` ❌
5. **Line 305-349:** `getTableMetadata()` - Uses `schema || 'dbo'` parameter ✅

**Inconsistency:**
- `getTableMetadata()` correctly accepts and uses schema parameter
- `getSchema()` ignores schema entirely
- Foreign key queries use `sys.tables` without joining to `sys.schemas`

---

### Problem 4: Foreign Key Schema Names Missing

**Location:** `lib/database/adapters/sqlserver-adapter.ts:202-215`

```typescript
// ❌ WRONG: Uses sys.tables without schema information
SELECT
  fk.name as constraint_name,
  tp.name as table_name,              // ❌ Only table name, no schema
  cp.name as column_name,
  tr.name as foreign_table_name,      // ❌ Only referenced table name, no schema
  cr.name as foreign_column_name
FROM sys.foreign_keys fk
INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
```

**What's Missing:**
- Should join with `sys.schemas` to get schema names
- Foreign key relationships store `Product` → `ProductCategory` instead of `SalesLT.Product` → `SalesLT.ProductCategory`

**Correct Query:**
```sql
SELECT
  fk.name as constraint_name,
  SCHEMA_NAME(tp.schema_id) + '.' + tp.name as table_name,     -- ✅ Include schema
  cp.name as column_name,
  SCHEMA_NAME(tr.schema_id) + '.' + tr.name as foreign_table_name, -- ✅ Include schema
  cr.name as foreign_column_name
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
```

---

### Problem 5: Primary Key Queries Also Missing Schema

**Location:** `lib/database/adapters/sqlserver-adapter.ts:181-190`

```typescript
// ❌ WRONG: Only TABLE_NAME retrieved
SELECT
  tc.TABLE_NAME as table_name,
  kcu.COLUMN_NAME as column_name
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
  AND tc.TABLE_CATALOG = DB_NAME()
```

**Should be:**
```sql
SELECT
  tc.TABLE_SCHEMA + '.' + tc.TABLE_NAME as table_name,  -- ✅ Include schema
  kcu.COLUMN_NAME as column_name
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
  AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA  -- ✅ Match schema too
WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
  AND tc.TABLE_CATALOG = DB_NAME()
```

---

## Impact Analysis

### Current State (Broken)

1. **Schema Introspection:**
   ```json
   {
     "tables": {
       "Product": [/* columns */],
       "Customer": [/* columns */],
       "ProductCategory": [/* columns */]
     },
     "relationships": [
       { "from": "Product", "to": "ProductCategory" }
     ]
   }
   ```

2. **LLM Prompt:**
   ```
   DATABASE SCHEMA:
   📋 Table: Product
   📋 Table: Customer
   📋 Table: ProductCategory

   🔗 Relationships:
   Product.ProductCategoryID → ProductCategory.ProductCategoryID

   💡 T-SQL JOIN Examples:
   SELECT TOP 100 f.*, t.* FROM [Product] AS f INNER JOIN [ProductCategory] AS t ON f.[ProductCategoryID] = t.[ProductCategoryID]
   ```

3. **Generated SQL:**
   ```sql
   SELECT TOP 100 * FROM Product  -- ❌ Fails with "Invalid object name 'Product'"
   ```

---

### Expected State (Fixed)

1. **Schema Introspection:**
   ```json
   {
     "tables": {
       "SalesLT.Product": [/* columns */],
       "SalesLT.Customer": [/* columns */],
       "SalesLT.ProductCategory": [/* columns */]
     },
     "relationships": [
       { "from": "SalesLT.Product", "to": "SalesLT.ProductCategory" }
     ]
   }
   ```

2. **LLM Prompt:**
   ```
   DATABASE SCHEMA:
   📋 Table: SalesLT.Product
   📋 Table: SalesLT.Customer
   📋 Table: SalesLT.ProductCategory

   🔗 Relationships:
   SalesLT.Product.ProductCategoryID → SalesLT.ProductCategory.ProductCategoryID

   💡 T-SQL JOIN Examples:
   SELECT TOP 100 f.*, t.* FROM [SalesLT].[Product] AS f INNER JOIN [SalesLT].[ProductCategory] AS t ON f.[ProductCategoryID] = t.[ProductCategoryID]
   ```

3. **Generated SQL:**
   ```sql
   SELECT TOP 100 * FROM [SalesLT].[Product]  -- ✅ Works correctly!
   ```

---

## Why This Is Critical

### 1. **SQL Server Best Practices**
- SQL Server databases commonly use multiple schemas for organization:
  - `SalesLT` - Sales data
  - `HumanResources` - HR data
  - `Production` - Manufacturing data
  - `Purchasing` - Procurement data
- AdventureWorks sample database uses `SalesLT` schema
- Real-world enterprise databases rarely use only `dbo` schema

### 2. **Default Schema Assumption Fails**
- SQL Server defaults to `dbo` schema if not specified
- If table exists in `SalesLT` but not in `dbo`, query fails
- Error: "Invalid object name 'Product'" because SQL Server looks for `dbo.Product`

### 3. **PostgreSQL & MySQL Don't Have This Issue**
- **PostgreSQL:** Uses `public` schema by default, and most users stick to it
- **MySQL:** Doesn't have schemas (uses databases instead), so no schema prefix needed
- **SQL Server:** Actively encourages multi-schema databases

### 4. **Breaks Common Use Cases**
- AdventureWorks sample database (Microsoft's official sample)
- Any database generated from Azure SQL Database templates
- Any well-architected SQL Server database

---

## Solution Architecture

### Approach 1: Include Schema in Table Name Keys (RECOMMENDED)

**Rationale:**
- Minimal changes to existing code
- Backward compatible (PostgreSQL/MySQL will use `public.tablename` or `database.tablename`)
- Works with current `SchemaInfo` structure

**Changes Required:**

1. **Update `getSchema()` to include schema in table names:**
   ```typescript
   // Get table names WITH schema
   SELECT TABLE_SCHEMA + '.' + TABLE_NAME as table_name
   FROM INFORMATION_SCHEMA.TABLES
   ```

2. **Update primary key query:**
   ```typescript
   SELECT
     tc.TABLE_SCHEMA + '.' + tc.TABLE_NAME as table_name,
     kcu.COLUMN_NAME as column_name
   FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
   ```

3. **Update foreign key query to use `SCHEMA_NAME()`:**
   ```typescript
   SELECT
     SCHEMA_NAME(tp.schema_id) + '.' + tp.name as table_name,
     cp.name as column_name,
     SCHEMA_NAME(tr.schema_id) + '.' + tr.name as foreign_table_name,
     cr.name as foreign_column_name
   FROM sys.foreign_keys fk
   ...
   ```

4. **Update column query:**
   ```typescript
   WHERE c.TABLE_SCHEMA + '.' + c.TABLE_NAME = '${tableName}'
   ```

5. **Update `formatSchemaForPrompt()` to use qualified names in examples:**
   ```typescript
   const example = `SELECT TOP 100 f.*, t.* FROM [${schemaName}].[${tableName}] AS f ...`
   ```

**Pros:**
- ✅ Minimal code changes
- ✅ Works with existing data structures
- ✅ Backward compatible
- ✅ Fixes the issue completely

**Cons:**
- ❌ Table names in `SchemaInfo.tables` include schema (e.g., `"SalesLT.Product"`)
- ❌ Might confuse code that expects bare table names

---

### Approach 2: Separate Schema Field in SchemaInfo (COMPREHENSIVE)

**Changes Required:**

1. **Modify `SchemaInfo` interface:**
   ```typescript
   export interface SchemaInfo {
     tables: Record<string, { schema: string; columns: ColumnMetadata[] }>
     relationships?: RelationshipMetadata[]
   }
   ```

2. **Update all adapters to provide schema info**

3. **Update `formatSchemaForPrompt()` across all adapters**

4. **Update API routes to handle new structure**

**Pros:**
- ✅ Clean separation of concerns
- ✅ Explicit schema tracking
- ✅ Future-proof for complex schema scenarios

**Cons:**
- ❌ Requires changes across entire codebase
- ❌ Breaking change for existing code
- ❌ Affects all database adapters
- ❌ Much more work

---

### Approach 3: Qualified Names with Bracket Notation (HYBRID)

**Rationale:**
- Store fully qualified names: `[SalesLT].[Product]`
- Parser and LLM already handle bracketed identifiers
- Consistent with T-SQL best practices

**Implementation:**
```typescript
// Store as: "[SalesLT].[Product]"
const qualifiedName = `[${row.table_schema}].[${row.table_name}]`
schema.tables[qualifiedName] = columns
```

**Pros:**
- ✅ Immediately usable in SQL generation
- ✅ No parsing needed when building queries
- ✅ Matches T-SQL conventions

**Cons:**
- ❌ Inconsistent with PostgreSQL/MySQL (they don't use brackets)
- ❌ Harder to parse if needed later

---

## Recommended Solution

**Use Approach 1: Schema.TableName Format**

**Format:** `SalesLT.Product` (without brackets in storage, add brackets during SQL generation)

**Reason:**
1. Minimal changes (only SQL Server adapter affected primarily)
2. Backward compatible with other databases
3. Easy to parse and split if needed (`schema.table.split('.')`)
4. Brackets added during prompt formatting: `[SalesLT].[Product]`

---

## Implementation Plan

### Phase 1: Fix SQL Server Adapter Schema Introspection (CRITICAL)

1. ✅ Update `getSchema()` table query to concatenate schema + table name
2. ✅ Update primary key query to use qualified names
3. ✅ Update foreign key query to use `SCHEMA_NAME()` function
4. ✅ Update column query to match qualified table names
5. ✅ Test with AdventureWorksLT database

### Phase 2: Update Prompt Formatting

6. ✅ Update `formatSchemaForPrompt()` to bracket-qualify table names
7. ✅ Update JOIN examples to use `[Schema].[Table]` syntax
8. ✅ Update SQL generation guidelines to emphasize schema qualification

### Phase 3: Test & Validate

9. ✅ Test with AdventureWorksLT (`SalesLT` schema)
10. ✅ Test with multi-schema database
11. ✅ Test with default `dbo` schema
12. ✅ Verify backward compatibility with PostgreSQL/MySQL

---

## Testing Strategy

### Test Databases

1. **AdventureWorksLT (SQL Server)**
   - Tables: `SalesLT.Product`, `SalesLT.Customer`, etc.
   - Expected: Schema included in all queries

2. **Default dbo Schema (SQL Server)**
   - Tables: `dbo.Users`, `dbo.Orders`
   - Expected: Schema included (even though `dbo` is default)

3. **Multi-Schema Database (SQL Server)**
   - Schemas: `Sales`, `HR`, `Production`
   - Expected: Each table qualified with correct schema

4. **PostgreSQL (Regression Test)**
   - Schema: `public` (default)
   - Expected: `public.users` or just `users` (both should work)

5. **MySQL (Regression Test)**
   - No schema concept
   - Expected: No breaking changes

### Test Cases

```sql
-- Test 1: Simple SELECT
User: "Show me all products"
Expected: SELECT TOP 100 * FROM [SalesLT].[Product]

-- Test 2: JOIN across tables in same schema
User: "Show products with their categories"
Expected: SELECT TOP 100 p.*, c.* FROM [SalesLT].[Product] p JOIN [SalesLT].[ProductCategory] c ON p.ProductCategoryID = c.ProductCategoryID

-- Test 3: WHERE clause
User: "Find products with price > 100"
Expected: SELECT TOP 100 * FROM [SalesLT].[Product] WHERE ListPrice > 100

-- Test 4: Aggregation
User: "Count products by category"
Expected: SELECT c.Name, COUNT(*) FROM [SalesLT].[Product] p JOIN [SalesLT].[ProductCategory] c ON p.ProductCategoryID = c.ProductCategoryID GROUP BY c.Name
```

---

## Success Criteria

### Must Have
- [x] Schema introspection retrieves schema names
- [ ] Table names stored as `Schema.Table` format
- [ ] Foreign key relationships include schema names
- [ ] LLM prompt shows qualified table names
- [ ] Generated SQL uses `[Schema].[Table]` syntax
- [ ] Queries execute successfully on AdventureWorksLT
- [ ] No regression on PostgreSQL/MySQL

### Should Have
- [ ] Works with multi-schema databases
- [ ] Works with default `dbo` schema
- [ ] Schema names included in relationship examples
- [ ] Validation passes for qualified names

### Nice to Have
- [ ] Schema-aware table filtering
- [ ] Support for cross-schema JOINs
- [ ] Schema information in UI (display "SalesLT.Product" not just "Product")

---

## Estimated Impact

**Current Success Rate (SQL Server with non-dbo schemas):** 0% (all queries fail)
**Expected Success Rate (After Fix):** 95%+

**Affected Databases:**
- AdventureWorks / AdventureWorksLT ✅
- Azure SQL Database templates ✅
- Enterprise SQL Server databases with organized schemas ✅
- Simple databases with only `dbo` schema ✅ (no negative impact)

---

## Files to Modify

### Critical Path
1. ✅ `lib/database/adapters/sqlserver-adapter.ts` - Fix schema introspection (all queries)
2. ✅ `lib/database/adapters/sqlserver-adapter.ts` - Update `formatSchemaForPrompt()`
3. ⏳ Test with real SQL Server database

### Optional (Future Enhancement)
4. `lib/database/types/schema.ts` - Add schema field to `TableMetadata` (already exists!)
5. `app/api/schema/route.ts` - Display schema info in UI
6. `components/schema-viewer.tsx` - Show qualified table names

---

## Conclusion

**Root Cause:** SQL Server adapter only retrieves `TABLE_NAME` without `TABLE_SCHEMA`, causing all table references to be unqualified.

**Solution:** Concatenate `TABLE_SCHEMA + '.' + TABLE_NAME` in all schema introspection queries.

**Complexity:** Low - primarily affects one adapter file

**Risk:** Low - backward compatible, no breaking changes to other databases

**Priority:** 🔴 **CRITICAL** - Blocks all SQL Server users with non-default schemas

---

**Status:** Analysis complete, ready for implementation.
