"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Database, Key, Link as LinkIcon, Loader2, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ERDiagram } from "@/components/er-diagram"

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  isForeignKey: boolean
  foreignKeyTo?: {
    table: string
    column: string
  }
}

interface TableInfo {
  name: string
  columns: ColumnInfo[]
}

interface SchemaInfo {
  tables: TableInfo[]
  relationships: {
    fromTable: string
    fromColumn: string
    toTable: string
    toColumn: string
  }[]
}

export function SchemaViewer() {
  const [schema, setSchema] = useState<SchemaInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [isExpanded, setIsExpanded] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  useEffect(() => {
    fetchSchema()
  }, [])

  const fetchSchema = async (forceRefresh = false) => {
    setIsLoading(true)
    setError("")

    try {
      // Add cache bypass parameter if forcing refresh
      const url = forceRefresh ? "/api/schema?refresh=true" : "/api/schema"
      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch schema")
      }

      setSchema(data)
      setLastRefresh(new Date())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchSchema(true)
  }

  if (!isExpanded) {
    return (
      <div className="mb-6">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown size={16} />
          <Database size={16} />
          <span>View Database Schema</span>
          {schema && (
            <Badge variant="secondary" className="ml-1">
              {schema.tables.length} tables
            </Badge>
          )}
        </button>
      </div>
    )
  }

  return (
    <Card className="mb-6 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-primary" />
          <h3 className="font-semibold">Database Schema</h3>
          {schema && (
            <Badge variant="secondary">
              {schema.tables.length} tables
            </Badge>
          )}
          {lastRefresh && !isLoading && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(lastRefresh).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {schema && <ERDiagram schema={schema} />}
          <button
            onClick={() => setIsExpanded(false)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Hide
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {schema && !isLoading && (
        <Accordion type="multiple" className="space-y-2">
          {schema.tables.map((table) => (
            <AccordionItem key={table.name} value={table.name} className="border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <Database size={14} className="text-primary" />
                  <span className="font-mono text-sm">{table.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {table.columns.length} columns
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-1 pl-6">
                  {table.columns.map((column) => (
                    <div
                      key={column.name}
                      className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/50"
                    >
                      {column.isPrimaryKey && (
                        <span title="Primary Key">
                          <Key size={12} className="text-amber-500" />
                        </span>
                      )}
                      {column.isForeignKey && (
                        <span title="Foreign Key">
                          <LinkIcon size={12} className="text-blue-500" />
                        </span>
                      )}
                      <span className="font-mono font-medium min-w-[120px]">
                        {column.name}
                      </span>
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {column.type}
                      </Badge>
                      {column.nullable && (
                        <span className="text-muted-foreground text-xs">nullable</span>
                      )}
                      {column.isForeignKey && column.foreignKeyTo && (
                        <span className="text-muted-foreground text-xs ml-auto">
                          → {column.foreignKeyTo.table}.{column.foreignKeyTo.column}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </Card>
  )
}
