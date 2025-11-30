/**
 * Prompt Injection Detection
 * Detects attempts to manipulate LLM prompts and bypass safety rules
 */

export interface DetectionResult {
  isSafe: boolean
  threats: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  detectedPatterns: string[]
}

/**
 * Patterns that indicate potential prompt injection attacks
 */
const INJECTION_PATTERNS = [
  // Direct instruction overrides
  {
    pattern: /ignore\s+(previous|all|above|prior)\s+(instructions?|rules?|prompts?|context)/i,
    threat: 'Attempt to override system instructions',
    risk: 'critical' as const,
  },
  {
    pattern: /disregard\s+(previous|all|above|prior)\s+(instructions?|rules?|prompts?)/i,
    threat: 'Attempt to disregard safety rules',
    risk: 'critical' as const,
  },
  {
    pattern: /forget\s+(everything|all)\s+(you\s+)?(know|learned|were\s+told)/i,
    threat: 'Attempt to reset LLM context',
    risk: 'high' as const,
  },

  // Role/persona manipulation
  {
    pattern: /(you\s+are\s+now|now\s+you\s+are|from\s+now\s+on)\s+(a\s+)?(different|new)/i,
    threat: 'Attempt to change LLM role',
    risk: 'high' as const,
  },
  {
    pattern: /system\s*:/i,
    threat: 'Fake system message injection',
    risk: 'critical' as const,
  },
  {
    pattern: /assistant\s*:/i,
    threat: 'Fake assistant message injection',
    risk: 'high' as const,
  },

  // Delimiter/encoding tricks
  {
    pattern: /```[\s\S]*?(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE)[\s\S]*?```/i,
    threat: 'Code block with dangerous SQL commands',
    risk: 'critical' as const,
  },
  {
    pattern: /<!--[\s\S]*?(DROP|DELETE|UPDATE|INSERT|ALTER)[\s\S]*?-->/i,
    threat: 'HTML comment with dangerous SQL',
    risk: 'high' as const,
  },

  // SQL injection within natural language
  {
    pattern: /(;|\n)\s*(DROP|DELETE|TRUNCATE|ALTER)\s+(TABLE|DATABASE)/i,
    threat: 'SQL injection attempt in query',
    risk: 'critical' as const,
  },
  {
    pattern: /'\s*(OR|AND)\s*'?\d*'?\s*=\s*'?\d*'?/i,
    threat: 'SQL injection (OR/AND condition)',
    risk: 'high' as const,
  },
  {
    pattern: /UNION\s+SELECT/i,
    threat: 'UNION-based SQL injection attempt',
    risk: 'critical' as const,
  },

  // Bypass keywords
  {
    pattern: /\b(bypass|override|disable|skip)\s+(safety|security|check|validation|filter)/i,
    threat: 'Attempt to bypass security measures',
    risk: 'critical' as const,
  },

  // Prompt leaking attempts
  {
    pattern: /(show|display|print|reveal|give)\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instructions|rules)/i,
    threat: 'Attempt to leak system prompt',
    risk: 'medium' as const,
  },

  // Multi-language injection
  {
    pattern: /\b(eval|exec|execute)\s*\(/i,
    threat: 'Code execution attempt',
    risk: 'critical' as const,
  },

  // Encoding tricks
  {
    pattern: /\\x[0-9a-fA-F]{2}/,
    threat: 'Hex encoding detected (possible obfuscation)',
    risk: 'medium' as const,
  },
  {
    pattern: /&#\d+;/,
    threat: 'HTML entity encoding (possible obfuscation)',
    risk: 'medium' as const,
  },

  // Jailbreak attempts
  {
    pattern: /(DAN|KEVIN|Developer Mode|Opposite Mode)/i,
    threat: 'Known jailbreak persona detected',
    risk: 'critical' as const,
  },
  {
    pattern: /pretend\s+(you\s+)?(are|to\s+be)/i,
    threat: 'Attempt to change LLM behavior',
    risk: 'high' as const,
  },
]

/**
 * Additional heuristics for detecting suspicious patterns
 */
const SUSPICIOUS_HEURISTICS = [
  {
    check: (query: string) => {
      // Check for excessive use of special characters
      const specialChars = (query.match(/[;'"\\<>{}[\]]/g) || []).length
      return specialChars > 10
    },
    threat: 'Excessive special characters (possible injection)',
    risk: 'medium' as const,
  },
  {
    check: (query: string) => {
      // Check for very long queries (>500 chars)
      return query.length > 500
    },
    threat: 'Unusually long query (possible prompt stuffing)',
    risk: 'low' as const,
  },
  {
    check: (query: string) => {
      // Check for multiple newlines (trying to separate instructions)
      const newlines = (query.match(/\n/g) || []).length
      return newlines > 5
    },
    threat: 'Multiple newlines (possible instruction injection)',
    risk: 'medium' as const,
  },
  {
    check: (query: string) => {
      // Check for SQL keywords in unusual context
      const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'DROP', 'DELETE', 'INSERT', 'UPDATE']
      const upperQuery = query.toUpperCase()
      const keywordCount = sqlKeywords.filter(kw => upperQuery.includes(kw)).length
      return keywordCount > 3
    },
    threat: 'Multiple SQL keywords in natural language query',
    risk: 'low' as const,
  },
]

/**
 * Detect prompt injection attempts in user query
 */
export function detectPromptInjection(userQuery: string): DetectionResult {
  const threats: string[] = []
  const detectedPatterns: string[] = []
  let highestRisk: 'low' | 'medium' | 'high' | 'critical' = 'low'

  // Check regex patterns
  for (const { pattern, threat, risk } of INJECTION_PATTERNS) {
    if (pattern.test(userQuery)) {
      threats.push(threat)
      detectedPatterns.push(pattern.source)

      // Update highest risk level
      if (getRiskScore(risk) > getRiskScore(highestRisk)) {
        highestRisk = risk
      }
    }
  }

  // Check heuristics
  for (const { check, threat, risk } of SUSPICIOUS_HEURISTICS) {
    if (check(userQuery)) {
      threats.push(threat)
      detectedPatterns.push('Heuristic check')

      if (getRiskScore(risk) > getRiskScore(highestRisk)) {
        highestRisk = risk
      }
    }
  }

  return {
    isSafe: threats.length === 0,
    threats,
    riskLevel: threats.length > 0 ? highestRisk : 'low',
    detectedPatterns,
  }
}

/**
 * Convert risk level to numeric score for comparison
 */
function getRiskScore(risk: 'low' | 'medium' | 'high' | 'critical'): number {
  switch (risk) {
    case 'low': return 1
    case 'medium': return 2
    case 'high': return 3
    case 'critical': return 4
    default: return 0
  }
}

/**
 * Sanitize user query by removing potentially dangerous content
 * Use with caution - may affect legitimate queries
 */
export function sanitizeQuery(userQuery: string): string {
  let sanitized = userQuery

  // Remove SQL comments
  sanitized = sanitized.replace(/--[^\n]*/g, '')
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '')

  // Remove excessive special characters
  sanitized = sanitized.replace(/[;]{2,}/g, ';')
  sanitized = sanitized.replace(/[']{2,}/g, "'")

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '')

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim()

  return sanitized
}

/**
 * Generate user-friendly error message based on detection result
 */
export function getSecurityErrorMessage(result: DetectionResult): string {
  if (result.isSafe) {
    return ''
  }

  const baseMessage = '🚨 Security Alert: Your query was blocked for safety reasons.'

  switch (result.riskLevel) {
    case 'critical':
      return `${baseMessage}\n\nCritical threat detected: ${result.threats[0]}\n\nPlease rephrase your query as a natural language question about your data.`

    case 'high':
      return `${baseMessage}\n\nHigh risk pattern detected: ${result.threats[0]}\n\nFor security, we only accept natural language questions. Please avoid using SQL syntax or special commands.`

    case 'medium':
      return `${baseMessage}\n\nSuspicious pattern detected: ${result.threats[0]}\n\nPlease simplify your query and ask in plain English.`

    case 'low':
      return `${baseMessage}\n\nYour query appears unusual. Please rephrase it as a simple question about your data.`
  }
}

import { logSecurityEvent } from '@/lib/logging/audit-logger'

/**
 * Log security incidents for audit purposes
 */
export async function logSecurityIncident(
  userId: string,
  query: string,
  result: DetectionResult
): Promise<void> {
  if (!result.isSafe) {
    console.warn('[Security] Prompt injection detected', {
      userId,
      riskLevel: result.riskLevel,
      threats: result.threats,
      queryPreview: query.substring(0, 100),
      timestamp: new Date().toISOString(),
    })

    // Persist to database
    await logSecurityEvent({
      userId,
      eventType: 'prompt_injection',
      severity: result.riskLevel,
      details: {
        threats: result.threats,
        detectedPatterns: result.detectedPatterns,
        queryPreview: query.substring(0, 500), // Store a bit more context
      },
    })
  }
}
