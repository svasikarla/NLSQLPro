
import { detectAmbiguity, generateExplanation } from '../lib/llm/sql-generator'
import { LLMProvider, LLMResponse } from '../lib/llm/llm-provider'

// Mock Provider
class MockLLMProvider implements LLMProvider {
    async generateCompletion(prompt: string): Promise<LLMResponse> {
        // console.log('[MockLLM] Received prompt:', prompt.substring(0, 50) + '...')

        // Mock Ambiguity Detection
        if (prompt.includes('is ambiguous')) {
            // Check if the USER QUESTION specifically asks for top products
            if (prompt.includes('USER QUESTION: "Show me top products"')) {
                return {
                    content: JSON.stringify({
                        isAmbiguous: true,
                        options: ['Top products by Sales Volume', 'Top products by Revenue'],
                        reasoning: 'The term "top" is vague and could refer to sales count or total revenue.'
                    }),
                    model: 'mock-model',
                    provider: 'mock'
                }
            }
            // Default to clear query for other inputs
            return {
                content: JSON.stringify({ isAmbiguous: false }),
                model: 'mock-model',
                provider: 'mock'
            }
        }

        // Mock Explanation
        if (prompt.includes('Explain the following SQL')) {
            return {
                content: 'I calculated the total sales amount for each product and listed the top 5 products.',
                model: 'mock-model',
                provider: 'mock'
            }
        }

        return { content: '', model: 'mock', provider: 'mock' }
    }

    getName() { return 'Mock Provider' }
}

async function runTests() {
    const mockProvider = new MockLLMProvider()
    const schemaText = "Table: products (id, name, price, stock)\nTable: orders (id, product_id, amount, created_at)"

    console.log('\n--- Test 1: Ambiguous Query ---')
    const result1 = await detectAmbiguity("Show me top products", schemaText, mockProvider)
    console.log('Result:', result1)
    if (result1.isAmbiguous && result1.options?.length === 2) {
        console.log('✅ PASS: Detected ambiguity correctly')
    } else {
        console.error('❌ FAIL: Failed to detect ambiguity')
    }

    console.log('\n--- Test 2: Clear Query ---')
    const result2 = await detectAmbiguity("Show me users created yesterday", schemaText, mockProvider)
    console.log('Result:', result2)
    if (!result2.isAmbiguous) {
        console.log('✅ PASS: Correctly identified clear query')
    } else {
        console.error('❌ FAIL: False positive on clear query')
    }

    console.log('\n--- Test 3: Explanation Generation ---')
    const sql = "SELECT * FROM orders"
    const explanation = await generateExplanation(sql, "Show orders", mockProvider)
    console.log('Explanation:', explanation)
    if (explanation.length > 0) {
        console.log('✅ PASS: Generated explanation')
    } else {
        console.error('❌ FAIL: Empty explanation')
    }
}

runTests().catch(console.error)
