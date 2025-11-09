"use client"

import { AlertCircle, Database, Lightbulb, WifiOff, XCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ErrorDisplayProps {
  error: string
  context?: "generation" | "execution" | "schema"
}

interface ErrorInfo {
  type: "connection" | "sql" | "llm" | "validation" | "unknown"
  title: string
  message: string
  suggestion?: string
  icon: React.ComponentType<{ className?: string }>
}

function categorizeError(error: string, context?: string): ErrorInfo {
  const errorLower = error.toLowerCase()

  // Connection errors
  if (
    errorLower.includes("connect") ||
    errorLower.includes("timeout") ||
    errorLower.includes("econnrefused") ||
    errorLower.includes("etimedout") ||
    errorLower.includes("network") ||
    errorLower.includes("database_url")
  ) {
    return {
      type: "connection",
      title: "Connection Error",
      message: error,
      suggestion: "Check your database connection string in .env.local and ensure your database is running.",
      icon: WifiOff,
    }
  }

  // Authentication errors
  if (
    errorLower.includes("password authentication failed") ||
    errorLower.includes("authentication") ||
    errorLower.includes("sasl") ||
    errorLower.includes("credentials")
  ) {
    return {
      type: "connection",
      title: "Authentication Failed",
      message: error,
      suggestion: "Verify your database username and password are correct. You may need to reset your database password.",
      icon: WifiOff,
    }
  }

  // SQL syntax errors
  if (
    errorLower.includes("syntax error") ||
    errorLower.includes("column") && errorLower.includes("does not exist") ||
    errorLower.includes("table") && errorLower.includes("does not exist") ||
    errorLower.includes("relation") && errorLower.includes("does not exist")
  ) {
    return {
      type: "sql",
      title: "SQL Error",
      message: error,
      suggestion: context === "execution"
        ? "Check the generated SQL for errors. You can edit the SQL before executing, or try rephrasing your question."
        : "The table or column referenced doesn't exist. Check the schema viewer above to see available tables and columns.",
      icon: Database,
    }
  }

  // Permission errors
  if (
    errorLower.includes("permission denied") ||
    errorLower.includes("access denied") ||
    errorLower.includes("insufficient privilege")
  ) {
    return {
      type: "sql",
      title: "Permission Denied",
      message: error,
      suggestion: "Your database user doesn't have permission to perform this operation. Contact your database administrator.",
      icon: XCircle,
    }
  }

  // LLM/API errors
  if (
    errorLower.includes("anthropic") ||
    errorLower.includes("api_key") ||
    errorLower.includes("model") ||
    errorLower.includes("rate limit")
  ) {
    return {
      type: "llm",
      title: "AI Service Error",
      message: error,
      suggestion: "Check your ANTHROPIC_API_KEY in .env.local. If using a rate-limited plan, try again in a moment.",
      icon: AlertCircle,
    }
  }

  // Validation errors
  if (
    errorLower.includes("only select queries") ||
    errorLower.includes("read-only") ||
    errorLower.includes("not allowed")
  ) {
    return {
      type: "validation",
      title: "Query Not Allowed",
      message: error,
      suggestion: "For security, only SELECT queries are allowed. Modify your question to request data instead of changing it.",
      icon: XCircle,
    }
  }

  // Generic error
  return {
    type: "unknown",
    title: "Error",
    message: error,
    icon: AlertCircle,
  }
}

export function ErrorDisplay({ error, context }: ErrorDisplayProps) {
  if (!error) return null

  const errorInfo = categorizeError(error, context)
  const Icon = errorInfo.icon

  return (
    <Alert variant="destructive" className="border-destructive/50">
      <Icon className="h-4 w-4" />
      <AlertTitle className="font-semibold">{errorInfo.title}</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p className="text-sm">{errorInfo.message}</p>
        {errorInfo.suggestion && (
          <div className="flex gap-2 items-start p-2 rounded bg-background/50 border border-border/50">
            <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
            <p className="text-sm text-muted-foreground">{errorInfo.suggestion}</p>
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}
