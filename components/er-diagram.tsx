"use client"

import { useEffect, useRef, useState } from "react"
import mermaid from "mermaid"
import { Network, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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

interface ERDiagramProps {
  schema: SchemaInfo
}

function generateMermaidERD(schema: SchemaInfo): string {
  console.log("🔍 generateMermaidERD called with schema:", schema)
  console.log("🔍 Schema tables count:", schema?.tables?.length)

  let mermaidCode = "erDiagram\n"

  // Add tables with columns
  schema.tables.forEach((table) => {
    // Sanitize table name (remove special chars)
    const tableName = table.name.replace(/[^a-zA-Z0-9_]/g, "_")

    mermaidCode += `  ${tableName} {\n`
    table.columns.forEach((col) => {
      // Sanitize column name and type
      const colName = col.name.replace(/[^a-zA-Z0-9_]/g, "_")
      const type = col.type.replace(/[^a-zA-Z0-9_]/g, "_")

      let attributes = ""
      if (col.isPrimaryKey) attributes += " PK"
      if (col.isForeignKey) attributes += " FK"

      mermaidCode += `    ${type} ${colName}${attributes}\n`
    })
    mermaidCode += `  }\n`
  })

  // Add relationships
  schema.relationships.forEach((rel) => {
    // Sanitize table names
    const fromTable = rel.fromTable.replace(/[^a-zA-Z0-9_]/g, "_")
    const toTable = rel.toTable.replace(/[^a-zA-Z0-9_]/g, "_")
    const label = rel.fromColumn.replace(/[^a-zA-Z0-9_]/g, "_")

    // Use zero-or-more (o{) for foreign key relationships
    mermaidCode += `  ${toTable} ||--o{ ${fromTable} : "${label}"\n`
  })

  return mermaidCode
}

export function ERDiagram({ schema }: ERDiagramProps) {
  console.log("🔍 ERDiagram component rendered with schema:", schema)
  console.log("🔍 Schema tables:", schema?.tables?.length || 0)

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mermaidCode, setMermaidCode] = useState("")
  const [isRendering, setIsRendering] = useState(false)

  useEffect(() => {
    // Initialize Mermaid only once
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
        er: {
          useMaxWidth: true,
        },
      })
    } catch (error) {
      console.error("Mermaid initialization error:", error)
    }
  }, [])

  useEffect(() => {
    console.log("🔍 useEffect triggered - isOpen:", isOpen, "hasContainer:", !!containerRef.current)

    if (isOpen && containerRef.current) {
      console.log("🔍 Generating Mermaid code for schema:", schema)
      const code = generateMermaidERD(schema)
      console.log("🔍 Generated Mermaid code length:", code.length)
      console.log("🔍 Generated Mermaid code:", code)
      setMermaidCode(code)
      setIsRendering(true)

      // Clear previous content
      if (containerRef.current) {
        containerRef.current.innerHTML = '<div class="flex items-center justify-center py-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>'
      }

      // Render mermaid diagram
      const renderDiagram = async () => {
        try {
          // Use timestamp to ensure unique ID
          const id = `er-diagram-${Date.now()}`
          const { svg } = await mermaid.render(id, code)
          if (containerRef.current) {
            containerRef.current.innerHTML = svg
          }
          setIsRendering(false)
        } catch (error) {
          console.error("Mermaid rendering error:", error)
          console.log("Generated Mermaid code:", code)
          if (containerRef.current) {
            containerRef.current.innerHTML = `<div class="text-destructive p-4"><p class="font-semibold mb-2">Failed to render diagram</p><p class="text-sm">${error instanceof Error ? error.message : 'Unknown error'}</p></div>`
          }
          setIsRendering(false)
        }
      }

      // Small delay to ensure DOM is ready
      setTimeout(renderDiagram, 100)
    }
  }, [isOpen, schema])

  const handleExportSVG = () => {
    if (containerRef.current) {
      const svgElement = containerRef.current.querySelector("svg")
      if (svgElement) {
        const svgData = new XMLSerializer().serializeToString(svgElement)
        const blob = new Blob([svgData], { type: "image/svg+xml" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `er-diagram-${Date.now()}.svg`
        link.click()
        URL.revokeObjectURL(url)
      }
    }
  }

  if (schema.tables.length === 0) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Network size={16} />
          View ER Diagram
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Entity Relationship Diagram</DialogTitle>
          <DialogDescription>
            Visual representation of your database schema with {schema.tables.length} tables and{" "}
            {schema.relationships.length} relationships
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportSVG} className="gap-2">
              <Download size={16} />
              Export SVG
            </Button>
          </div>

          <div
            ref={containerRef}
            className="bg-muted/30 rounded-lg p-4 overflow-auto min-h-[400px] flex items-center justify-center"
          />

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground mb-2">
              Show Mermaid Code
            </summary>
            <pre className="bg-muted/50 rounded p-3 overflow-x-auto">
              {mermaidCode}
            </pre>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  )
}
