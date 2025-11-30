
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

        // Check if prompt contains examples
        if (prompt.includes('VERIFIED EXAMPLES')) {
            console.log('✅ PASS: Prompt includes verified examples')
        } else {
            console.log('❌ FAIL: Prompt missing verified examples')
        }

        return { content: "SELECT * FROM products" }
    },
    // Add other required methods if any (mocking minimal interface)
    generate: async () => "deprecated",
    stream: async () => null as any
} as any

// Mock fetch for API calls
global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const urlString = url.toString()
    if (urlString.includes('/api/golden-queries')) {
        console.log(`[Mock Fetch] GET ${urlString}`)
        return {
            ok: true,
            json: async () => ({
                examples: [
                    { natural_query: "Show top products", sql_query: "SELECT * FROM products LIMIT 5" }
                ]
            })
        } as Response
    }
    return { ok: false } as Response
}

// Set env var for URL
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

async function runTest() {
    console.log('Testing RAG Pipeline...')

    try {
        // Mock schema info
        const mockSchema = {
            tables: {
                products: [
                    { name: 'id', type: 'int' },
                    { name: 'name', type: 'text' },
                    { name: 'sales', type: 'int' }
                ]
            },
            relationships: []
        }

        await generateSQLWithRetry({
            query: "Show me the best selling items",
            schema: mockSchema,
            schemaText: "CREATE TABLE products (id int, name text, sales int);",
        }, mockLLM)
    } catch (e) {
        console.error('Test failed:', e)
    }
}

runTest()
