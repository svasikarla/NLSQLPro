"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Database, Loader2, Copy, Check, Download, Edit3, RotateCcw, Settings, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { SchemaViewer } from "@/components/schema-viewer"
import { ErrorDisplay } from "@/components/error-display"
import { QueryHistory } from "@/components/query-history"
import { QueryResultsViewer } from "@/components/query-results-viewer"
import { useQueryHistory } from "@/hooks/use-query-history"
import { createClient } from "@/lib/supabase/client"
import { ClarificationDialog } from "@/components/clarification-dialog"
import { GlossaryManager } from "@/components/glossary-manager"

interface QueryResult {
  sql: string
  confidence?: number
  assumptions?: string[]
  results?: any[]
  error?: string
}

export default function QueryPage() {
  const router = useRouter()
  const supabase = createClient()

  const [naturalQuery, setNaturalQuery] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [generatedSQL, setGeneratedSQL] = useState("")
  const [editedSQL, setEditedSQL] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [queryResults, setQueryResults] = useState<any[] | null>(null)
  const [executionTime, setExecutionTime] = useState<number | undefined>(undefined)
  const [resultFields, setResultFields] = useState<any[] | undefined>(undefined)
  const [rowCount, setRowCount] = useState<number | undefined>(undefined)
  const [schemaKnowledge, setSchemaKnowledge] = useState<any>(null)
  const [primaryTable, setPrimaryTable] = useState<string | undefined>(undefined)
  const [error, setError] = useState("")
  const [errorContext, setErrorContext] = useState<"generation" | "execution" | "schema">("generation")
  const [copied, setCopied] = useState(false)
  const [activeConnection, setActiveConnection] = useState<string | null>(null)
  const [loadingConnection, setLoadingConnection] = useState(true)

  // Clarification State
  const [clarificationOpen, setClarificationOpen] = useState(false)
  const [clarificationOptions, setClarificationOptions] = useState<string[]>([])
  const [clarificationReasoning, setClarificationReasoning] = useState("")
  const [explanation, setExplanation] = useState("")

  const { history, addToHistory, clearHistory, deleteItem } = useQueryHistory()

  // Fetch active connection on mount
  useEffect(() => {
    fetchActiveConnection()
  }, [])

  const fetchActiveConnection = async () => {
    try {
      const response = await fetch("/api/connections/list")
      if (response.ok) {
        const data = await response.json()
        const active = data.connections?.find((c: any) => c.is_active)
        if (active) {
          setActiveConnection(`${active.name} (${active.database})`)
        } else {
          setActiveConnection(null)
        }
      }
    } catch (err) {
      console.error("Failed to fetch active connection:", err)
    } finally {
      setLoadingConnection(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

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

      // Handle Clarification Request
      if (data.status === 'clarification_needed') {
        setClarificationOptions(data.options)
        setClarificationReasoning(data.reasoning)
        setClarificationOpen(true)
        setIsGenerating(false)
        return
      }

      setGeneratedSQL(data.sql)
      setEditedSQL(data.sql)
      setExplanation(data.explanation || "")

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
    setExecutionTime(undefined)
    setResultFields(undefined)
    setRowCount(undefined)
    setSchemaKnowledge(null)
    setPrimaryTable(undefined)

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
      setExecutionTime(data.executionTime)
      setResultFields(data.fields)
      setRowCount(data.rowCount)

      // NEW: Capture schema knowledge for V2 visualizations
      if (data.schemaKnowledge) {
        // Convert serialized schema knowledge back to Map structure
        const schemaKnowledgeWithMaps = {
          connectionId: data.schemaKnowledge.connectionId,
          tables: new Map(
            data.schemaKnowledge.tables.map((table: any) => [
              table.name,
              table.columns
            ])
          ),
          relationships: data.schemaKnowledge.relationships,
          lastUpdated: new Date(data.schemaKnowledge.lastUpdated)
        }
        setSchemaKnowledge(schemaKnowledgeWithMaps)
        console.log('[Query Page] Schema knowledge loaded:', schemaKnowledgeWithMaps)
      }

      if (data.primaryTable) {
        setPrimaryTable(data.primaryTable)
        console.log('[Query Page] Primary table detected:', data.primaryTable)
      }
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

  const handleClarificationSelect = (option: string) => {
    setClarificationOpen(false)
    // Append clarification to query and re-submit
    const clarifiedQuery = `${naturalQuery} (Clarification: ${option})`
    setNaturalQuery(clarifiedQuery)
    // Trigger generation immediately with new query
    setTimeout(() => {
      // We need to call handleGenerate but with the new query state.
      // Since state updates are async, we can't just call handleGenerate() immediately if it uses state.
      // Better approach: Refactor handleGenerate to accept an optional query arg.
      // For now, let's just update the state and let the user click generate, OR simpler:
      // Just call the API directly here to avoid state complexity.
      submitClarifiedQuery(clarifiedQuery)
    }, 100)
  }

  const submitClarifiedQuery = async (query: string) => {
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
        body: JSON.stringify({ query }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate SQL")
      }

      setGeneratedSQL(data.sql)
      setEditedSQL(data.sql)
      setExplanation(data.explanation || "")

      addToHistory(query, data.sql)
    } catch (err: any) {
      setError(err.message)
      setErrorContext("generation")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <ClarificationDialog
        isOpen={clarificationOpen}
        onClose={() => setClarificationOpen(false)}
        options={clarificationOptions}
        reasoning={clarificationReasoning}
        onSelect={handleClarificationSelect}
      />
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Database className="text-primary" size={24} />
              <span className="font-bold text-xl">NLSQL Pro</span>
            </div>
            {!loadingConnection && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Connection:</span>
                {activeConnection ? (
                  <span className="font-medium text-primary">{activeConnection}</span>
                ) : (
                  <span className="text-amber-600">No active connection</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <QueryHistory
              history={history}
              onSelectQuery={handleSelectFromHistory}
              onClearHistory={clearHistory}
              onDeleteItem={deleteItem}
            />
            <GlossaryManager />
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/settings/connections")}
            >
              <Settings size={16} className="mr-2" />
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut size={16} className="mr-2" />
              Logout
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

        {/* No Active Connection Warning */}
        {!loadingConnection && !activeConnection && (
          <Card className="mb-8 p-6 bg-amber-500/10 border-amber-500/20">
            <div className="flex items-center gap-3">
              <Database className="text-amber-600" size={24} />
              <div>
                <h3 className="font-semibold text-amber-600">No Active Database Connection</h3>
                <p className="text-sm text-amber-600/80 mt-1">
                  Please configure and activate a database connection in Settings to start querying.
                </p>
              </div>
              <Button
                variant="outline"
                className="ml-auto border-amber-500/30 hover:bg-amber-500/20"
                onClick={() => router.push("/settings/connections")}
              >
                <Settings size={16} className="mr-2" />
                Go to Settings
              </Button>
            </div>
          </Card>
        )}

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

        {/* Results Section - Enhanced with V2 System */}
        {queryResults && queryResults.length > 0 && (
          <div className="mt-8">
            <QueryResultsViewer
              results={queryResults}
              sql={editedSQL || generatedSQL}
              fields={resultFields}
              rowCount={rowCount}
              executionTime={executionTime}
              onExportCSV={handleExportCSV}
              onExportJSON={handleExportJSON}
              schemaKnowledge={schemaKnowledge}
              tableName={primaryTable}
              useSchemaAwareness={true}
              explanation={explanation}
              query={naturalQuery}
            />
          </div>
        )}
      </main>
    </div>
  )
}
