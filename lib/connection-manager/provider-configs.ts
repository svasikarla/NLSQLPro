/**
 * Provider configurations for database connection forms
 * Defines available providers, their defaults, and helpful hints
 */

export interface ProviderConfig {
  id: string
  name: string
  defaultPort: number
  requiresSSL: boolean
  hints: string[]
  template?: {
    host?: string
    port?: number
    ssl?: boolean
  }
}

/**
 * PostgreSQL Providers
 */
export const POSTGRESQL_PROVIDERS: ProviderConfig[] = [
  {
    id: "supabase",
    name: "Supabase",
    defaultPort: 5432,
    requiresSSL: true,
    hints: [
      "✅ Managed PostgreSQL with connection pooling",
      "💡 Use port 6543 for pooler mode (recommended for serverless)",
      "📚 Find credentials in: Project Settings > Database",
      "🔐 Username format: postgres.[project-ref]",
    ],
    template: {
      port: 5432,
      ssl: true,
    },
  },
  {
    id: "supabase-pooler",
    name: "Supabase (Pooler)",
    defaultPort: 6543,
    requiresSSL: true,
    hints: [
      "⚡ Connection pooler for serverless environments",
      "✅ Reduces connection overhead",
      "💡 Recommended for Next.js/Vercel deployments",
      "📚 Transaction mode - no long-lived connections",
    ],
    template: {
      port: 6543,
      ssl: true,
    },
  },
  {
    id: "aws-rds",
    name: "AWS RDS PostgreSQL",
    defaultPort: 5432,
    requiresSSL: true,
    hints: [
      "☁️ AWS managed PostgreSQL service",
      "💡 Enable Performance Insights for monitoring",
      "🔐 SSL/TLS encryption recommended",
      "📍 Endpoint format: instance-name.region.rds.amazonaws.com",
    ],
    template: {
      port: 5432,
      ssl: true,
    },
  },
  {
    id: "azure-postgres",
    name: "Azure Database for PostgreSQL",
    defaultPort: 5432,
    requiresSSL: true,
    hints: [
      "☁️ Azure managed PostgreSQL service",
      "🔒 SSL enforcement required by default",
      "💡 Add firewall rule for your IP address",
      "📍 Server name format: servername.postgres.database.azure.com",
    ],
    template: {
      port: 5432,
      ssl: true,
    },
  },
  {
    id: "gcp-cloudsql",
    name: "Google Cloud SQL",
    defaultPort: 5432,
    requiresSSL: true,
    hints: [
      "☁️ Google Cloud managed PostgreSQL",
      "🔐 Use Cloud SQL Proxy for secure connections",
      "💡 Enable automated backups",
      "📍 Connection name format: project:region:instance",
    ],
    template: {
      port: 5432,
      ssl: true,
    },
  },
  {
    id: "heroku",
    name: "Heroku PostgreSQL",
    defaultPort: 5432,
    requiresSSL: true,
    hints: [
      "☁️ Heroku managed PostgreSQL",
      "⚠️ Credentials rotate regularly - use DATABASE_URL",
      "💡 SSL uses self-signed certificates",
      "📚 Connection info: heroku config --app your-app",
    ],
    template: {
      port: 5432,
      ssl: true,
    },
  },
  {
    id: "digitalocean",
    name: "DigitalOcean Managed Database",
    defaultPort: 25060,
    requiresSSL: true,
    hints: [
      "☁️ DigitalOcean managed PostgreSQL",
      "🔒 SSL required for all connections",
      "💡 Connection pooling included",
      "📍 Default port: 25060",
    ],
    template: {
      port: 25060,
      ssl: true,
    },
  },
  {
    id: "render",
    name: "Render PostgreSQL",
    defaultPort: 5432,
    requiresSSL: true,
    hints: [
      "☁️ Render managed PostgreSQL",
      "🔐 SSL required for external connections",
      "💡 Internal hostname for same-region apps",
      "📚 Find connection info in Render Dashboard",
    ],
    template: {
      port: 5432,
      ssl: true,
    },
  },
  {
    id: "railway",
    name: "Railway PostgreSQL",
    defaultPort: 5432,
    requiresSSL: false,
    hints: [
      "☁️ Railway managed PostgreSQL",
      "💡 Automatic database provisioning",
      "📍 Connection variables auto-injected",
      "🔧 Use Railway CLI for local development",
    ],
    template: {
      port: 5432,
      ssl: false,
    },
  },
  {
    id: "local",
    name: "Local PostgreSQL",
    defaultPort: 5432,
    requiresSSL: false,
    hints: [
      "💻 Local PostgreSQL installation",
      "🚀 Fast connection times (5-10ms)",
      "💡 No SSL required for localhost",
      "📚 Default user: postgres",
    ],
    template: {
      host: "localhost",
      port: 5432,
      ssl: false,
    },
  },
  {
    id: "custom",
    name: "Custom PostgreSQL",
    defaultPort: 5432,
    requiresSSL: false,
    hints: [
      "🔧 Custom PostgreSQL server",
      "💡 Configure settings based on your setup",
      "🔐 Enable SSL if connecting over internet",
    ],
    template: {
      port: 5432,
      ssl: false,
    },
  },
]

/**
 * MySQL Providers
 */
export const MYSQL_PROVIDERS: ProviderConfig[] = [
  {
    id: "aws-rds-mysql",
    name: "AWS RDS MySQL",
    defaultPort: 3306,
    requiresSSL: true,
    hints: [
      "☁️ AWS managed MySQL service",
      "🔐 SSL/TLS encryption recommended",
      "💡 Use RDS Proxy for connection pooling",
      "📍 Endpoint format: instance-name.region.rds.amazonaws.com",
    ],
    template: {
      port: 3306,
      ssl: true,
    },
  },
  {
    id: "azure-mysql",
    name: "Azure Database for MySQL",
    defaultPort: 3306,
    requiresSSL: true,
    hints: [
      "☁️ Azure managed MySQL service",
      "💡 Username format: user@servername",
      "🔒 SSL enforcement enabled by default",
      "📍 Server name: servername.mysql.database.azure.com",
    ],
    template: {
      port: 3306,
      ssl: true,
    },
  },
  {
    id: "gcp-cloudsql-mysql",
    name: "Google Cloud SQL MySQL",
    defaultPort: 3306,
    requiresSSL: true,
    hints: [
      "☁️ Google Cloud managed MySQL",
      "🔐 Use Cloud SQL Proxy for connections",
      "💡 Enable automated backups",
      "📍 Connection name: project:region:instance",
    ],
    template: {
      port: 3306,
      ssl: true,
    },
  },
  {
    id: "planetscale",
    name: "PlanetScale",
    defaultPort: 3306,
    requiresSSL: true,
    hints: [
      "⚡ Serverless MySQL platform",
      "🔐 SSL required for all connections",
      "💡 No migrations needed - schema branching",
      "📚 Uses Vitess for horizontal scaling",
    ],
    template: {
      port: 3306,
      ssl: true,
    },
  },
  {
    id: "digitalocean-mysql",
    name: "DigitalOcean MySQL",
    defaultPort: 25060,
    requiresSSL: true,
    hints: [
      "☁️ DigitalOcean managed MySQL",
      "🔒 SSL required for connections",
      "💡 Connection pooling included",
      "📍 Default port: 25060",
    ],
    template: {
      port: 25060,
      ssl: true,
    },
  },
  {
    id: "railway-mysql",
    name: "Railway MySQL",
    defaultPort: 3306,
    requiresSSL: false,
    hints: [
      "☁️ Railway managed MySQL",
      "💡 Automatic provisioning",
      "📍 Variables auto-injected",
      "🔧 Easy local development",
    ],
    template: {
      port: 3306,
      ssl: false,
    },
  },
  {
    id: "local-mysql",
    name: "Local MySQL",
    defaultPort: 3306,
    requiresSSL: false,
    hints: [
      "💻 Local MySQL installation",
      "🚀 Fast connections (localhost)",
      "💡 No SSL needed for local dev",
      "📚 Default user: root",
    ],
    template: {
      host: "localhost",
      port: 3306,
      ssl: false,
    },
  },
  {
    id: "custom-mysql",
    name: "Custom MySQL",
    defaultPort: 3306,
    requiresSSL: false,
    hints: [
      "🔧 Custom MySQL server",
      "💡 Configure based on your setup",
      "🔐 Enable SSL for remote connections",
    ],
    template: {
      port: 3306,
      ssl: false,
    },
  },
]

/**
 * SQL Server Providers
 */
export const SQLSERVER_PROVIDERS: ProviderConfig[] = [
  {
    id: "azure-sql",
    name: "Azure SQL Database",
    defaultPort: 1433,
    requiresSSL: true,
    hints: [
      "☁️ Azure managed SQL Server",
      "💡 Username format: user@server",
      "🔒 Encryption required (TDS 8.0)",
      "📚 T-SQL: Use TOP instead of LIMIT, GETDATE() instead of NOW()",
      "🔐 Add firewall rule for your IP",
    ],
    template: {
      port: 1433,
      ssl: true,
    },
  },
  {
    id: "aws-rds-sqlserver",
    name: "AWS RDS SQL Server",
    defaultPort: 1433,
    requiresSSL: true,
    hints: [
      "☁️ AWS managed SQL Server",
      "💡 Multiple editions available (Express, Web, Standard, Enterprise)",
      "🔐 SSL/TLS recommended",
      "📍 Endpoint: instance.region.rds.amazonaws.com",
    ],
    template: {
      port: 1433,
      ssl: true,
    },
  },
  {
    id: "gcp-sqlserver",
    name: "Google Cloud SQL Server",
    defaultPort: 1433,
    requiresSSL: true,
    hints: [
      "☁️ Google Cloud managed SQL Server",
      "🔐 Use Cloud SQL Proxy",
      "💡 Supports SQL Server 2017, 2019",
      "📚 High availability options",
    ],
    template: {
      port: 1433,
      ssl: true,
    },
  },
  {
    id: "local-sqlserver",
    name: "Local SQL Server",
    defaultPort: 1433,
    requiresSSL: false,
    hints: [
      "💻 Local SQL Server installation",
      "🚀 Fast local connections",
      "💡 Enable TCP/IP in SQL Server Configuration Manager",
      "📚 Default instance uses port 1433",
    ],
    template: {
      host: "localhost",
      port: 1433,
      ssl: false,
    },
  },
  {
    id: "custom-sqlserver",
    name: "Custom SQL Server",
    defaultPort: 1433,
    requiresSSL: false,
    hints: [
      "🔧 Custom SQL Server instance",
      "💡 Configure based on your setup",
      "🔐 Enable encryption for remote access",
    ],
    template: {
      port: 1433,
      ssl: false,
    },
  },
]

/**
 * SQLite Providers
 */
export const SQLITE_PROVIDERS: ProviderConfig[] = [
  {
    id: "file",
    name: "SQLite File",
    defaultPort: 0,
    requiresSSL: false,
    hints: [
      "💾 File-based database",
      "💡 Use absolute paths: /path/to/database.sqlite",
      "📁 Supported extensions: .sqlite, .sqlite3, .db, .db3",
      "🔧 Ensure write permissions for the file and directory",
    ],
    template: {
      host: "/path/to/database.sqlite",
      database: "main",
    },
  },
  {
    id: "memory",
    name: "In-Memory SQLite",
    defaultPort: 0,
    requiresSSL: false,
    hints: [
      "⚡ Temporary in-memory database",
      "⚠️ Data lost when connection closes",
      "💡 Use for testing only",
      "🚀 Extremely fast - no disk I/O",
    ],
    template: {
      host: ":memory:",
      database: "main",
    },
  },
]

/**
 * Get providers for a specific database type
 */
export function getProvidersForDatabase(
  dbType: "postgresql" | "mysql" | "sqlserver" | "sqlite"
): ProviderConfig[] {
  switch (dbType) {
    case "postgresql":
      return POSTGRESQL_PROVIDERS
    case "mysql":
      return MYSQL_PROVIDERS
    case "sqlserver":
      return SQLSERVER_PROVIDERS
    case "sqlite":
      return SQLITE_PROVIDERS
    default:
      return []
  }
}
