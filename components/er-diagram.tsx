"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import mermaid from "mermaid"
import { Network, Download, ZoomIn, ZoomOut, Maximize2 } from "lucide-react"
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

  // Validate schema
  if (!schema || !schema.tables || schema.tables.length === 0) {
    console.warn("⚠️ generateMermaidERD: No tables in schema")
    return "erDiagram\n  %% No tables available\n"
  }

  let mermaidCode = "erDiagram\n"

  // Add tables with columns
  schema.tables.forEach((table) => {
    if (!table || !table.name) {
      console.warn("⚠️ Skipping invalid table:", table)
      return
    }

    // Sanitize table name (remove special chars)
    const tableName = table.name.replace(/[^a-zA-Z0-9_]/g, "_")

    if (!tableName) {
      console.warn("⚠️ Skipping table with empty sanitized name:", table.name)
      return
    }

    mermaidCode += `  ${tableName} {\n`

    if (table.columns && Array.isArray(table.columns)) {
      table.columns.forEach((col) => {
        if (!col || !col.name) {
          console.warn("⚠️ Skipping invalid column:", col)
          return
        }

        // Sanitize column name and type
        const colName = col.name.replace(/[^a-zA-Z0-9_]/g, "_")
        const type = (col.type || "unknown").replace(/[^a-zA-Z0-9_]/g, "_")

        // Build attributes for Mermaid ER syntax
        // CRITICAL: Mermaid requires comma-separated attributes, not space-separated
        // Valid: "PK,FK" | Invalid: "PK FK"
        const attributes: string[] = []
        if (col.isPrimaryKey) attributes.push("PK")
        if (col.isForeignKey) attributes.push("FK")

        // Format: type name "attr1,attr2" (quoted if multiple attributes)
        const attributeStr = attributes.length > 0 ? ` "${attributes.join(",")}"` : ""
        mermaidCode += `    ${type} ${colName}${attributeStr}\n`
      })
    }

    mermaidCode += `  }\n`
  })

  // Add relationships
  if (schema.relationships && Array.isArray(schema.relationships)) {
    schema.relationships.forEach((rel) => {
      if (!rel || !rel.fromTable || !rel.toTable || !rel.fromColumn) {
        console.warn("⚠️ Skipping invalid relationship:", rel)
        return
      }

      // Sanitize table names
      const fromTable = rel.fromTable.replace(/[^a-zA-Z0-9_]/g, "_")
      const toTable = rel.toTable.replace(/[^a-zA-Z0-9_]/g, "_")
      const label = rel.fromColumn.replace(/[^a-zA-Z0-9_]/g, "_")

      // Use zero-or-more (o{) for foreign key relationships
      mermaidCode += `  ${toTable} ||--o{ ${fromTable} : "${label}"\n`
    })
  }

  console.log("✅ Generated Mermaid ERD:", mermaidCode.substring(0, 200) + "...")
  return mermaidCode
}

export function ERDiagram({ schema }: ERDiagramProps) {
  console.log("🔍 ERDiagram component rendered with schema:", schema)
  console.log("🔍 Schema tables:", schema?.tables?.length || 0)

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Generate mermaid code and memoize it to prevent unnecessary regeneration
  const mermaidCode = useMemo(() => generateMermaidERD(schema), [schema])

  useEffect(() => {
    // Initialize Mermaid with proper configuration
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
        logLevel: 'debug',
        er: {
          useMaxWidth: true,
          layoutDirection: 'TB',
        },
      })
      console.log("✅ Mermaid initialized successfully")
    } catch (error) {
      console.error("❌ Mermaid initialization error:", error)
    }
  }, [])

  // Re-initialize mermaid when dialog opens to ensure it's ready
  useEffect(() => {
    if (isOpen) {
      console.log("🔄 Re-initializing Mermaid for dialog...")
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          logLevel: 'debug',
          er: {
            useMaxWidth: true,
            layoutDirection: 'TB',
          },
        })
        console.log("✅ Mermaid re-initialized for dialog")
      } catch (error) {
        console.error("❌ Mermaid re-initialization error:", error)
      }
    }
  }, [isOpen])

  useEffect(() => {
    console.log("🔍 useEffect triggered - isOpen:", isOpen, "hasContainer:", !!containerRef.current)

    if (!isOpen) return

    // Wait for container to be mounted in DOM
    const waitForContainer = () => {
      if (containerRef.current) {
        console.log("✅ Container found, starting render...")
        console.log("🔍 Generating Mermaid code for schema:", schema)
        console.log("🔍 Generated Mermaid code length:", mermaidCode.length)
        console.log("🔍 Generated Mermaid code:", mermaidCode)
        setIsRendering(true)

        // Render mermaid diagram
        const renderDiagram = async () => {
          try {
            // Clear previous content and show loading spinner
            if (containerRef.current) {
              containerRef.current.innerHTML = '<div class="flex items-center justify-center py-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>'
            }

            console.log("🎨 Starting mermaid render...")
            // Use timestamp to ensure unique ID
            const id = `er-diagram-${Date.now()}`
            console.log("📝 Rendering with ID:", id)
            console.log("📝 Mermaid code to render:", mermaidCode.substring(0, 100) + "...")

            // Remove any existing mermaid elements with same ID
            const existingElement = document.getElementById(id)
            if (existingElement) {
              existingElement.remove()
              console.log("🗑️ Removed existing mermaid element")
            }

            const { svg } = await mermaid.render(id, mermaidCode)
            console.log("✅ Mermaid render successful, SVG length:", svg.length)

            if (containerRef.current) {
              // Clear and inject SVG
              containerRef.current.innerHTML = ''
              containerRef.current.innerHTML = svg
              console.log("✅ SVG injected into container")
              console.log("📊 Container innerHTML length:", containerRef.current.innerHTML.length)
            } else {
              console.warn("⚠️ Container ref is null after render")
            }
            setIsRendering(false)
          } catch (error) {
            console.error("❌ Mermaid rendering error:", error)
            console.error("❌ Error details:", {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined,
              mermaidCodeLength: mermaidCode.length,
              mermaidCodePreview: mermaidCode.substring(0, 200)
            })
            if (containerRef.current) {
              containerRef.current.innerHTML = `<div class="text-destructive p-4"><p class="font-semibold mb-2">Failed to render diagram</p><p class="text-sm">${error instanceof Error ? error.message : 'Unknown error'}</p><pre class="mt-2 text-xs bg-muted/30 p-2 rounded overflow-x-auto">${mermaidCode}</pre></div>`
            }
            setIsRendering(false)
          }
        }

        // Delay to ensure mermaid is ready
        setTimeout(renderDiagram, 300)
      } else {
        console.log("⏳ Container not ready, waiting...")
        // Retry after a short delay
        setTimeout(waitForContainer, 50)
      }
    }

    // Start waiting for container
    waitForContainer()
  }, [isOpen, mermaidCode, schema])

  // Zoom controls
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 3))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5))
  }

  const handleResetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)))
  }

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

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
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleZoomIn} className="gap-2">
                <ZoomIn size={16} />
                Zoom In
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomOut} className="gap-2">
                <ZoomOut size={16} />
                Zoom Out
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetZoom} className="gap-2">
                <Maximize2 size={16} />
                Reset
              </Button>
              <span className="text-sm text-muted-foreground self-center ml-2">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportSVG} className="gap-2">
              <Download size={16} />
              Export SVG
            </Button>
          </div>

          <div
            ref={svgContainerRef}
            className="bg-muted/30 rounded-lg overflow-hidden min-h-[400px] relative"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <div
              ref={containerRef}
              className="flex items-center justify-center p-4"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            />
          </div>

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
