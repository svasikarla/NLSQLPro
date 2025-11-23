/**
 * LLM Provider Abstraction Layer
 * Supports multiple LLM providers: Anthropic Claude, Azure OpenAI
 */

import Anthropic from '@anthropic-ai/sdk'
import { AzureOpenAI } from 'openai'

export interface LLMResponse {
  content: string
  model: string
  provider: string
}

export interface LLMProvider {
  generateCompletion(prompt: string): Promise<LLMResponse>
  getName(): string
}

/**
 * Anthropic Claude Provider
 */
export class AnthropicProvider implements LLMProvider {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
    })
  }

  async generateCompletion(prompt: string): Promise<LLMResponse> {
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // Extract text from response
    let content = ''
    for (const block of message.content) {
      if (block.type === 'text') {
        content = block.text.trim()
        break
      }
    }

    return {
      content,
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
    }
  }

  getName(): string {
    return 'Anthropic Claude'
  }
}

/**
 * Azure OpenAI Provider
 */
export class AzureOpenAIProvider implements LLMProvider {
  private client: AzureOpenAI
  private deploymentName: string

  constructor(config: {
    apiKey: string
    endpoint: string
    deploymentName: string
    apiVersion?: string
  }) {
    this.client = new AzureOpenAI({
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      apiVersion: config.apiVersion || '2024-02-15-preview',
    })
    this.deploymentName = config.deploymentName
  }

  async generateCompletion(prompt: string): Promise<LLMResponse> {
    const completion = await this.client.chat.completions.create({
      model: this.deploymentName,
      messages: [
        {
          role: 'system',
          content: `You are an expert SQL query generator. Follow these rules strictly:

1. Generate ONLY valid SQL queries based on the provided schema
2. Use ONLY table names and column names that appear in the DATABASE SCHEMA section
3. DO NOT treat schema qualifiers (like "public") as table names
4. If you see "public.users", the table name is "users", NOT "public"
5. Return ONLY the SQL query without explanations, markdown formatting, or code blocks
6. Do not include semicolons at the end
7. Use proper JOIN syntax with explicit ON conditions
8. Reference foreign key relationships from the schema

CRITICAL: Only use tables and columns that are explicitly listed in the schema provided by the user.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 2048, // Increased for complex queries
      temperature: 0.0, // Zero temperature for maximum determinism
    })

    const content = completion.choices[0]?.message?.content || ''

    return {
      content: content.trim(),
      model: this.deploymentName,
      provider: 'azure-openai',
    }
  }

  getName(): string {
    return 'Azure OpenAI'
  }
}

/**
 * Factory function to create LLM provider based on environment configuration
 */
export function createLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || 'anthropic'

  if (provider === 'azure-openai') {
    const apiKey = process.env.AZURE_OPENAI_API_KEY
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION

    if (!apiKey || !endpoint || !deploymentName) {
      throw new Error(
        'Azure OpenAI configuration incomplete. Required: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_NAME'
      )
    }

    return new AzureOpenAIProvider({
      apiKey,
      endpoint,
      deploymentName,
      apiVersion,
    })
  } else if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic')
    }

    return new AnthropicProvider(apiKey)
  } else {
    throw new Error(`Unsupported LLM provider: ${provider}. Use "anthropic" or "azure-openai"`)
  }
}

/**
 * Get the current LLM provider name
 */
export function getLLMProviderName(): string {
  const provider = process.env.LLM_PROVIDER || 'anthropic'
  return provider === 'azure-openai' ? 'Azure OpenAI' : 'Anthropic Claude'
}
