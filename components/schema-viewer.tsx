"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Database, Key, Link as LinkIcon, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

  useEffect(() => {
    fetchSchema()
  }, [])

  const fetchSchema = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/schema")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch schema")
      }

      setSchema(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
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
        </div>
        <div className="flex items-center gap-2">
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
                        <Key size={12} className="text-amber-500" title="Primary Key" />
                      )}
                      {column.isForeignKey && (
                        <LinkIcon size={12} className="text-blue-500" title="Foreign Key" />
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
