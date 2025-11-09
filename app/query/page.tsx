"use client"

import { useState } from "react"
import { ArrowRight, Database, Loader2, Copy, Check, Download, Edit3, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { SchemaViewer } from "@/components/schema-viewer"
import { ErrorDisplay } from "@/components/error-display"
import { QueryHistory } from "@/components/query-history"
import { useQueryHistory } from "@/hooks/use-query-history"

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
  const [editedSQL, setEditedSQL] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [queryResults, setQueryResults] = useState<any[] | null>(null)
  const [error, setError] = useState("")
  const [errorContext, setErrorContext] = useState<"generation" | "execution" | "schema">("generation")
  const [copied, setCopied] = useState(false)

  const { history, addToHistory, clearHistory, deleteItem } = useQueryHistory()

  const handleGenerate = async () => {
    if (!naturalQuery.trim()) return

    setIsGenerating(true)
    setError("")
    setGeneratedSQL("")
    setEditedSQL("")
    setIsEditing(false)
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
      setEditedSQL(data.sql)

      // Save to history
      addToHistory(naturalQuery, data.sql)
    } catch (err: any) {
      setError(err.message)
      setErrorContext("generation")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSelectFromHistory = (item: { naturalQuery: string; generatedSQL: string }) => {
    setNaturalQuery(item.naturalQuery)
    setGeneratedSQL(item.generatedSQL)
    setEditedSQL(item.generatedSQL)
    setError("")
    setQueryResults(null)
  }

  const handleExecute = async () => {
    const sqlToExecute = editedSQL || generatedSQL
    if (!sqlToExecute) return

    setIsExecuting(true)
    setError("")
    setQueryResults(null)

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: sqlToExecute }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute query")
      }

      setQueryResults(data.results)
    } catch (err: any) {
      setError(err.message)
      setErrorContext("execution")
    } finally {
      setIsExecuting(false)
    }
  }

  const handleCopy = () => {
    const sqlToCopy = editedSQL || generatedSQL
    navigator.clipboard.writeText(sqlToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleEdit = () => {
    setIsEditing(!isEditing)
  }

  const handleResetSQL = () => {
    setEditedSQL(generatedSQL)
    setIsEditing(false)
  }

  const hasEdits = editedSQL !== generatedSQL

  const handleExportCSV = () => {
    if (!queryResults || queryResults.length === 0) return

    // Get headers
    const headers = Object.keys(queryResults[0])

    // Convert to CSV format
    const csvRows = []
    csvRows.push(headers.join(','))

    for (const row of queryResults) {
      const values = headers.map(header => {
        const value = row[header]
        // Handle null, objects, and strings with commas/quotes
        if (value === null) return 'NULL'
        if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`
        const stringValue = String(value)
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      })
      csvRows.push(values.join(','))
    }

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `query-results-${Date.now()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportJSON = () => {
    if (!queryResults || queryResults.length === 0) return

    const jsonContent = JSON.stringify(queryResults, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `query-results-${Date.now()}.json`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
          <div className="flex items-center gap-2">
            <QueryHistory
              history={history}
              onSelectQuery={handleSelectFromHistory}
              onClearHistory={clearHistory}
              onDeleteItem={deleteItem}
            />
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/"}>
              Back to Home
            </Button>
          </div>
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

        {/* Schema Viewer */}
        <SchemaViewer />

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

            {error && <ErrorDisplay error={error} context={errorContext} />}
          </Card>

          {/* SQL Output Section */}
          <Card className="p-6 space-y-4 card-hover-effect">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-foreground">Generated SQL</label>
                {hasEdits && (
                  <span className="text-xs text-amber-500 font-medium">
                    (Edited)
                  </span>
                )}
              </div>
              {generatedSQL && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleEdit}
                    className="text-xs"
                  >
                    <Edit3 size={14} className="mr-1" />
                    {isEditing ? "View" : "Edit"}
                  </Button>
                  {hasEdits && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetSQL}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw size={14} className="mr-1" />
                      Reset
                    </Button>
                  )}
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
                </div>
              )}
            </div>

            <div className="relative">
              {isEditing ? (
                <Textarea
                  value={editedSQL}
                  onChange={(e) => setEditedSQL(e.target.value)}
                  className="min-h-[150px] font-mono text-sm resize-none"
                  placeholder="// SQL query will appear here..."
                />
              ) : (
                <pre className="bg-muted/50 rounded-lg p-4 min-h-[150px] overflow-x-auto text-sm font-mono">
                  {editedSQL || generatedSQL || "// SQL query will appear here..."}
                </pre>
              )}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Query Results ({queryResults.length} rows)
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="gap-2"
                >
                  <Download size={16} />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJSON}
                  className="gap-2"
                >
                  <Download size={16} />
                  Export JSON
                </Button>
              </div>
            </div>
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
