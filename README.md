# NLSQL Pro

Transform natural language into optimized SQL queries instantly. Enterprise-grade security, real-time insights, and zero SQL knowledge required.

**Status**: ✅ **Production-Ready** | **Build**: ✅ Passing (0 errors) | **Version**: Phase 3+ MVP Complete

---

## 🎯 What is NLSQL Pro?

NLSQL Pro is a production-ready Natural Language to SQL platform that uses AI (Claude Sonnet 4.5) to convert plain English into secure, optimized SQL queries. Built with Next.js 16, TypeScript, and Supabase, it delivers enterprise-grade performance and security.

### Key Features

- 🤖 **AI-Powered SQL Generation** - Claude Sonnet 4.5 with automatic retry
- 🗄️ **Multi-Database Support** - PostgreSQL, MySQL, SQLite, SQL Server
- ⚡ **10-100x Faster** - Schema caching with 24-hour TTL and MD5 fingerprinting
- 🔒 **Enterprise Security** - AES-256-GCM encryption, prompt injection defense, rate limiting
- 🛡️ **30+ Attack Patterns Blocked** - Jailbreaks, SQL injection, LLM manipulation
- 📊 **Auto Schema Detection** - Tables, columns, relationships, constraints
- 🎛️ **Connection Management** - Secure multi-database CRUD with pooling
- 🔐 **Authentication** - Supabase Auth with Row-Level Security

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Database (PostgreSQL, MySQL, SQLite, or SQL Server)
- Anthropic API key ([Get one here](https://console.anthropic.com/))
- Supabase account ([Sign up here](https://supabase.com/))

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
ENCRYPTION_KEY=64_hex_characters_here

# Optional (for enhanced features)
# OPENAI_API_KEY=sk-...                   # Multi-LLM fallback
# UPSTASH_REDIS_REST_URL=...              # Rate limiting
# UPSTASH_REDIS_REST_TOKEN=...            # Rate limiting
# SENTRY_DSN=https://...                  # Error tracking
```

**Generate Encryption Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set Up Supabase

1. Create a new Supabase project
2. Run migrations to create required tables:
   ```bash
   supabase db push
   ```

3. Enable Row-Level Security (RLS) policies in Supabase dashboard

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Try It Out!

1. Sign up or log in
2. Go to Settings → Connections
3. Add a database connection (PostgreSQL, MySQL, SQLite, or SQL Server)
4. Navigate to Query page
5. Enter natural language like:
   - "Show me all users who signed up last month"
   - "What are the top 5 products by revenue?"
   - "Count the number of orders by status"
6. Click "Generate SQL" to see AI-generated query
7. Click "Execute Query" to run it
8. View results in the table below

---

## 📊 Production Features

### Performance Metrics

| Metric | Without Cache | With Cache | Improvement |
|--------|--------------|------------|-------------|
| **Schema Loading** | 2-5 seconds | 50-200ms | **10-100x faster** |
| **Query Generation** | N/A | 50-200ms | Sub-second |
| **Cache Hit Rate** | 0% | 90%+ | Expected in production |

### Security Features

- ✅ **AES-256-GCM Encryption** - Database credentials encrypted at rest
- ✅ **Prompt Injection Defense** - 30+ attack patterns blocked
- ✅ **Multi-Tier Rate Limiting** - 5 rate limiters (generation, execution, schema, connection, global)
- ✅ **Multi-Layer Validation** - SQL syntax, schema verification, safety checks
- ✅ **Read-Only Enforcement** - Dangerous operations (DROP, DELETE, UPDATE) blocked
- ✅ **Row-Level Security** - Supabase RLS isolates user data
- ✅ **Security Incident Logging** - Audit trail for attacks

### Attack Patterns Detected

- ✅ Jailbreak attempts (15 patterns)
- ✅ SQL injection (8 patterns)
- ✅ LLM manipulation (5 patterns)
- ✅ Fake system messages (2 patterns)

---

## 🏗️ Tech Stack

- **Framework**: Next.js 16.0.0 (App Router, Turbopack)
- **Language**: TypeScript (strict mode)
- **UI**: shadcn/ui + Tailwind CSS v4 (OKLCH colors)
- **Database**: Supabase (PostgreSQL) + multi-DB adapters
- **Auth**: Supabase Auth with Row-Level Security
- **AI**: Anthropic Claude 3.5 Sonnet
- **Caching**: Schema caching with MD5 fingerprinting
- **Rate Limiting**: Upstash Redis (optional)
- **Deployment**: Vercel
- **Fonts**: Geist Sans & Geist Mono

---

## 📁 Project Structure

```
app/
├── api/
│   ├── generate/route.ts          # SQL generation (with prompt injection protection)
│   ├── execute/route.ts           # Query execution (with safety validation)
│   ├── schema/route.ts            # Schema introspection (with caching)
│   └── connections/               # Connection CRUD operations
├── query/page.tsx                 # Main query interface
├── settings/connections/page.tsx  # Connection management
├── auth/                          # Login/Signup pages
└── page.tsx                       # Landing page

components/
├── hero-section.tsx               # Landing page hero
├── features-section.tsx           # Features showcase
├── security-section.tsx           # Security features
├── performance-section.tsx        # Performance metrics
└── ui/                            # shadcn/ui components

lib/
├── database/
│   └── adapters/                  # PostgreSQL, MySQL, SQLite, SQL Server
├── cache/schema-cache.ts          # 24h caching with MD5 fingerprinting
├── security/
│   ├── encryption.ts              # AES-256-GCM encryption
│   └── prompt-injection-detector.ts  # 30+ attack patterns
├── ratelimit/rate-limiter.ts      # Multi-tier rate limiting
├── llm/claude-client.ts           # Claude API integration
├── validation/
│   ├── sql-validator.ts           # SQL syntax validation
│   └── query-safety.ts            # Safety checks
└── env.ts                         # Environment validation

supabase/migrations/
├── 001_initial_schema.sql         # Database connections, query history
└── 002_schema_cache.sql           # Schema cache table
```

---

## 🔒 Security Best Practices

### Database Connection Security

**Recommended**: Create a read-only database user for maximum security:

**PostgreSQL:**
```sql
CREATE USER nlsql_readonly WITH PASSWORD 'your_secure_password';
GRANT CONNECT ON DATABASE your_database TO nlsql_readonly;
GRANT USAGE ON SCHEMA public TO nlsql_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO nlsql_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO nlsql_readonly;
```

**MySQL:**
```sql
CREATE USER 'nlsql_readonly'@'%' IDENTIFIED BY 'your_secure_password';
GRANT SELECT ON your_database.* TO 'nlsql_readonly'@'%';
FLUSH PRIVILEGES;
```

### Security Layers

1. **Query Whitelisting**: Only SELECT queries allowed
2. **Keyword Blocking**: Dangerous keywords (DROP, DELETE, INSERT, etc.) blocked
3. **Prompt Injection Defense**: 30+ attack patterns detected and blocked
4. **Query Timeout**: 30-second timeout prevents long-running queries
5. **Row Limits**: LIMIT 1000 automatically appended
6. **Connection Pooling**: Efficient database connection management
7. **Encryption**: AES-256-GCM for credentials at rest
8. **Rate Limiting**: Multi-tier limits prevent abuse and cost overruns

---

## 🚢 Deployment

### Deploy to Vercel

1. **Connect GitHub Repository**
   - Push code to GitHub
   - Import project in Vercel dashboard

2. **Set Environment Variables** in Vercel dashboard:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
   SUPABASE_SERVICE_ROLE_KEY=eyJh...
   ENCRYPTION_KEY=64_hex_characters_here

   # Optional
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

4. **Run Supabase Migrations**:
   ```bash
   supabase db push
   ```

5. **Verify Deployment**:
   - Test schema caching (should see 10-100x improvement)
   - Test prompt injection detection (try "ignore previous instructions")
   - Test rate limiting (make 11 queries in 1 minute)
   - Test all 4 database types
   - Check environment validation logs

### Pre-Deployment Checklist

- [x] TypeScript build passes with 0 errors
- [x] All production features implemented
- [x] Security measures in place
- [x] Environment validation configured
- [x] Landing page updated
- [x] Documentation complete
- [ ] Production environment variables set (deployment step)
- [ ] Supabase migrations run (deployment step)
- [ ] Domain configured (deployment step)

---

## 💰 Cost Estimates

### LLM API Costs (Claude Sonnet 4.5)
- **Input**: ~$3 per million tokens
- **Output**: ~$15 per million tokens
- **Estimated Cost per Query**: $0.02-0.05
- **With 90% cache hit rate**: Average cost drops to $0.005-0.01 per query

### Infrastructure Costs
- **Vercel**: Free tier for MVP, $20/month Pro
- **Supabase**: Free tier for MVP, $25/month Pro
- **Upstash Redis**: Free tier (10K commands/day), $0.20 per 100K commands

**Total Estimated Monthly Cost** (100 users, 10 queries/day):
- **MVP** (free tiers): $50-100/month
- **Pro** (paid tiers): $200-400/month

---

## 🛠️ Development

### Build for Production

```bash
pnpm build
pnpm start
```

### Commands

```bash
pnpm dev          # Start development server
pnpm build        # Build production bundle
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

### Adding UI Components

Use shadcn/ui CLI:
```bash
npx shadcn@latest add [component-name]
```

---

## 🐛 Troubleshooting

### "ANTHROPIC_API_KEY not configured"
Make sure you've added your Anthropic API key to `.env.local`. Get one at [https://console.anthropic.com/](https://console.anthropic.com/)

### "ENCRYPTION_KEY not configured"
Generate a secure 64-character hex key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### "Table does not exist"
The AI might be generating queries for tables that don't exist. Try being more specific, or check that your database has data.

### Connection refused / Cannot connect to database
1. Verify database is running
2. Check connection string format
3. Verify firewall settings allow connections
4. Ensure you're using the correct port

### TypeScript errors during build
Run `pnpm install` again to ensure all type definitions are installed.

---

## 🗺️ Roadmap

### ✅ Completed (Phase 0-3)
- Multi-database support (PostgreSQL, MySQL, SQLite, SQL Server)
- AI-powered SQL generation with Claude Sonnet 4.5
- Schema caching (24h TTL, 10-100x performance)
- Prompt injection detection (30+ patterns)
- Rate limiting (multi-tier, optional Upstash Redis)
- Environment validation
- User authentication
- Connection management
- Query execution with safety validation

### 🔜 Next (Phase 4+)
- SQL syntax highlighting with Monaco Editor
- Query examples/templates
- Better error messages with fuzzy matching
- Query result pagination
- Conversational query refinement
- Multi-LLM support (OpenAI fallback)
- Query cost estimation with EXPLAIN
- Saved queries/templates
- Business glossary (domain-specific terms)
- Team/organization features
- Usage analytics dashboard

See [CLAUDE.md](./CLAUDE.md) for detailed roadmap and development guidelines.

---

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Project guidelines for development
- **[lib/database/README.md](./lib/database/README.md)** - Database adapter architecture
- **[.env.example](.env.example)** - Environment variables documentation

---

## 🎯 Key Differentiators

### vs. Traditional Query Builders
- ✅ **10-100x faster** with schema caching
- ✅ **Natural language input** - no SQL knowledge required
- ✅ **AI-powered generation** with automatic retry

### vs. Other NL-to-SQL Tools
- ✅ **Advanced security** - prompt injection protection (30+ patterns)
- ✅ **Multi-database support** - 4 database types in one platform
- ✅ **Production-hardened** - comprehensive validation and safety

### vs. Database-Specific Tools
- ✅ **Database agnostic** - switch between databases seamlessly
- ✅ **Enterprise-grade** - encryption, RLS, audit logging
- ✅ **Developer-friendly** - transparent SQL generation, manual editing

---

## 📄 License

MIT

---

## 💬 Support

For issues or questions:
- Open an issue on GitHub
- Contact: [contact@nlsqlpro.com](mailto:contact@nlsqlpro.com)

---

**Built with ❤️ using Next.js 16, TypeScript, Claude AI, and Supabase**
