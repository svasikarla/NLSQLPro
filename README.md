# NLSQL Pro

Transform natural language into optimized SQL queries instantly. Enterprise-grade security, real-time insights, and zero SQL knowledge required.

## Phase 0 MVP - Getting Started

This is the minimal viable product (MVP) implementation focusing on core natural language to SQL functionality.

### Features

- Natural language query input
- AI-powered SQL generation using Claude 3.5 Sonnet
- Real-time database schema introspection
- Secure query execution (SELECT-only)
- Results display in table format
- Professional UI with animations and modern design

## Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL database (local or remote)
- Anthropic API key ([Get one here](https://console.anthropic.com/))

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your credentials:

```bash
# Your PostgreSQL connection string
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# Your Anthropic API key from https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
```

### 3. Prepare Your Database

Make sure your PostgreSQL database is running and accessible. The app will automatically introspect your database schema.

**Security Recommendation**: Create a read-only database user for maximum security:

```sql
-- Create read-only user
CREATE USER nlsql_readonly WITH PASSWORD 'your_secure_password';

-- Grant connection to database
GRANT CONNECT ON DATABASE your_database TO nlsql_readonly;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO nlsql_readonly;

-- Grant SELECT on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO nlsql_readonly;

-- Grant SELECT on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO nlsql_readonly;
```

Then use this connection string:
```bash
DATABASE_URL=postgresql://nlsql_readonly:your_secure_password@localhost:5432/your_database
```

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Try It Out!

1. Click "Try Free Demo" on the landing page
2. Enter a natural language query like:
   - "Show me all users who signed up last month"
   - "What are the top 5 products by revenue?"
   - "Count the number of orders by status"
3. Click "Generate SQL" to see the AI-generated query
4. Click "Execute Query" to run it against your database
5. View the results in the table below

## Example Queries to Try

```
Show me the first 10 rows from the users table
List all products with price greater than 100
Count orders grouped by status
Show me recent sales from the last 7 days
What are the top 5 customers by total purchases?
```

## Project Structure

```
app/
├── page.tsx              # Landing page
├── query/
│   └── page.tsx          # Query interface
├── api/
│   ├── generate/
│   │   └── route.ts      # SQL generation endpoint (Claude API)
│   └── execute/
│       └── route.ts      # Query execution endpoint
components/
├── hero-section.tsx      # Landing page hero
├── features-section.tsx  # Features showcase
└── footer.tsx            # Footer component
```

## Security Features

The MVP includes multiple layers of security:

1. **Query Whitelisting**: Only SELECT queries are allowed
2. **Keyword Blocking**: Dangerous keywords (DROP, DELETE, INSERT, etc.) are blocked
3. **Query Timeout**: 30-second timeout prevents long-running queries
4. **Connection Pooling**: Efficient database connection management
5. **Read-only Recommendation**: Encourages using read-only database users

## Troubleshooting

### "DATABASE_URL not configured"

Make sure you've created `.env.local` and added your PostgreSQL connection string.

### "ANTHROPIC_API_KEY not configured"

Make sure you've added your Anthropic API key to `.env.local`. Get one at [https://console.anthropic.com/](https://console.anthropic.com/)

### "Table does not exist"

The AI might be generating queries for tables that don't exist in your schema. Try being more specific in your query, or check that your database has data.

### Connection refused / Cannot connect to database

1. Verify PostgreSQL is running: `psql -U username -d database_name`
2. Check your connection string format: `postgresql://username:password@host:port/database`
3. Verify firewall settings allow connections to PostgreSQL port (default 5432)

### TypeScript errors during build

Run `pnpm install` again to ensure all type definitions are installed, including `@types/pg`.

## Build for Production

```bash
pnpm build
pnpm start
```

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict mode)
- **UI**: shadcn/ui + Tailwind CSS v4 (OKLCH colors)
- **Database**: PostgreSQL with node-postgres
- **AI**: Anthropic Claude 3.5 Sonnet
- **Fonts**: Geist Sans & Geist Mono

## What's Next?

This is Phase 0 of the NLSQL Pro roadmap. Future phases include:

- **Phase 1**: User authentication, query history, multiple database connections
- **Phase 2**: Query validation, explain plans, CSV export
- **Phase 3**: Team collaboration, saved queries, API access

See [CLAUDE.md](./CLAUDE.md) for the complete development roadmap.

## License

MIT

## Support

For issues or questions, please open an issue on GitHub or contact [contact@nlsqlpro.com](mailto:contact@nlsqlpro.com).
