"use client"

import { useState } from "react"
import { ArrowRight, Database, Loader2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"

interface QueryResult {
  sql: string
  confidence?: number
  assumptions?: string[]
  results?: any[]
  error?: string
}

export default function QueryPage() {
  const [naturalQuery, setNaturalQuery] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [generatedSQL, setGeneratedSQL] = useState("")
  const [queryResults, setQueryResults] = useState<any[] | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!naturalQuery.trim()) return

    setIsGenerating(true)
    setError("")
    setGeneratedSQL("")
    setQueryResults(null)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: naturalQuery }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate SQL")
      }

      setGeneratedSQL(data.sql)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExecute = async () => {
    if (!generatedSQL) return

    setIsExecuting(true)
    setError("")
    setQueryResults(null)

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: generatedSQL }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute query")
      }

      setQueryResults(data.results)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedSQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="text-primary" size={24} />
            <span className="font-bold text-xl">NLSQL Pro</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.href = "/"}>
            Back to Home
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold mb-4">
            Query Your Database with <span className="gradient-text">Natural Language</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Ask questions in plain English, get instant SQL queries
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <Card className="p-6 space-y-4 card-hover-effect">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Natural Language Query
              </label>
              <Textarea
                value={naturalQuery}
                onChange={(e) => setNaturalQuery(e.target.value)}
                placeholder='Try: "Show me all users who signed up last month" or "What are the top 5 products by revenue?"'
                className="min-h-[150px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleGenerate()
                  }
                }}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!naturalQuery.trim() || isGenerating}
              className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/50"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  Generating SQL...
                </>
              ) : (
                <>
                  Generate SQL
                  <ArrowRight className="ml-2" size={18} />
                </>
              )}
            </Button>

            {error && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}
          </Card>

          {/* SQL Output Section */}
          <Card className="p-6 space-y-4 card-hover-effect">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">Generated SQL</label>
              {generatedSQL && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="text-xs"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} className="mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="relative">
              <pre className="bg-muted/50 rounded-lg p-4 min-h-[150px] overflow-x-auto text-sm font-mono">
                {generatedSQL || "// SQL query will appear here..."}
              </pre>
            </div>

            <Button
              onClick={handleExecute}
              disabled={!generatedSQL || isExecuting}
              variant="outline"
              className="w-full border-primary/30 hover:border-primary hover:bg-primary/10"
              size="lg"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  Executing...
                </>
              ) : (
                <>
                  <Database className="mr-2" size={18} />
                  Execute Query
                </>
              )}
            </Button>
          </Card>
        </div>

        {/* Results Section */}
        {queryResults && queryResults.length > 0 && (
          <Card className="mt-8 p-6">
            <h3 className="text-lg font-semibold mb-4">
              Query Results ({queryResults.length} rows)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {Object.keys(queryResults[0]).map((key) => (
                      <th key={key} className="text-left p-3 font-semibold">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResults.map((row, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                      {Object.values(row).map((value: any, cellIdx) => (
                        <td key={cellIdx} className="p-3">
                          {value === null ? (
                            <span className="text-muted-foreground italic">null</span>
                          ) : typeof value === "object" ? (
                            JSON.stringify(value)
                          ) : (
                            String(value)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
