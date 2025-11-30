
import { generateSQLWithRetry } from '../lib/llm/sql-generator'
import { LLMProvider } from '../lib/llm/llm-provider'

// Mock LLM Provider
const mockLLM: LLMProvider = {
    id: 'mock',
    name: 'Mock LLM',
    generateCompletion: async (prompt: string) => {
        console.log('\n--- Generated Prompt ---')
        console.log(prompt)
        console.log('------------------------\n')

        // Check if prompt contains glossary terms
        if (prompt.includes('BUSINESS GLOSSARY')) {
            console.log('✅ PASS: Prompt includes business glossary')
        } else {
            console.log('❌ FAIL: Prompt missing business glossary')
        }

        if (prompt.includes('Churned User')) {
            console.log('✅ PASS: Prompt includes specific term "Churned User"')
        } else {
            console.log('❌ FAIL: Prompt missing specific term')
        }

        return { content: "SELECT * FROM users WHERE status = 'inactive'" }
    },
    generate: async () => "deprecated",
    stream: async () => null as any
} as any

// Mock fetch for API calls
global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const urlString = url.toString()
    if (urlString.includes('/api/glossary')) {
        console.log(`[Mock Fetch] GET ${urlString}`)
        return {
            ok: true,
            json: async () => ({
                terms: [
                    {
                        term: "Churned User",
                        definition: "A user who has not logged in for 30 days",
                        sql_logic: "last_login < NOW() - INTERVAL '30 days'"
                    }
                ]
            })
        } as Response
    }
    // Mock golden queries as empty to isolate glossary test
    if (urlString.includes('/api/golden-queries')) {
        return {
            ok: true,
            json: async () => ({ examples: [] })
        } as Response
    }
    return { ok: false } as Response
}

// Set env var for URL
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

async function runTest() {
    console.log('Testing Business Glossary Pipeline...')

    try {
        // Mock schema info
        const mockSchema = {
            tables: {
                users: [
                    { name: 'id', type: 'uuid' },
                    { name: 'status', type: 'text' },
                    { name: 'last_login', type: 'timestamp' }
                ]
            },
            relationships: []
        }

        await generateSQLWithRetry({
            query: "Show me churned users",
            schema: mockSchema,
            schemaText: "CREATE TABLE users (id uuid, status text, last_login timestamp);",
        }, mockLLM)
    } catch (e) {
        console.error('Test failed:', e)
    }
}

runTest()
