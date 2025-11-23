"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Database, Cloud, Server, FileText, Search, Star, Plus, CheckCircle2 } from "lucide-react"
import { getProvidersForDatabase, type ProviderConfig } from "@/lib/connection-manager/provider-configs"

interface ConnectionTemplate {
  id: string
  name: string
  description: string
  dbType: "postgresql" | "mysql" | "sqlserver" | "sqlite"
  provider: string
  icon: typeof Database
  popular?: boolean
  config: {
    host?: string
    port?: number
    ssl?: boolean
  }
}

const TEMPLATES: ConnectionTemplate[] = [
  {
    id: "supabase",
    name: "Supabase PostgreSQL",
    description: "Managed PostgreSQL with built-in connection pooling",
    dbType: "postgresql",
    provider: "supabase",
    icon: Database,
    popular: true,
    config: {
      port: 5432,
      ssl: true,
    },
  },
  {
    id: "supabase-pooler",
    name: "Supabase Pooler",
    description: "Transaction pooler for serverless environments",
    dbType: "postgresql",
    provider: "supabase-pooler",
    icon: Cloud,
    popular: true,
    config: {
      port: 6543,
      ssl: true,
    },
  },
  {
    id: "azure-sql",
    name: "Azure SQL Database",
    description: "Microsoft Azure managed SQL Server",
    dbType: "sqlserver",
    provider: "azure-sql",
    icon: Cloud,
    popular: true,
    config: {
      port: 1433,
      ssl: true,
    },
  },
  {
    id: "aws-rds-postgres",
    name: "AWS RDS PostgreSQL",
    description: "Amazon managed PostgreSQL database",
    dbType: "postgresql",
    provider: "aws-rds",
    icon: Cloud,
    popular: true,
    config: {
      port: 5432,
      ssl: true,
    },
  },
  {
    id: "aws-rds-mysql",
    name: "AWS RDS MySQL",
    description: "Amazon managed MySQL database",
    dbType: "mysql",
    provider: "aws-rds-mysql",
    icon: Cloud,
    popular: true,
    config: {
      port: 3306,
      ssl: true,
    },
  },
  {
    id: "planetscale",
    name: "PlanetScale",
    description: "Serverless MySQL platform with branching",
    dbType: "mysql",
    provider: "planetscale",
    icon: Cloud,
    popular: true,
    config: {
      port: 3306,
      ssl: true,
    },
  },
  {
    id: "local-postgres",
    name: "Local PostgreSQL",
    description: "PostgreSQL running on localhost",
    dbType: "postgresql",
    provider: "local",
    icon: Server,
    config: {
      host: "localhost",
      port: 5432,
      ssl: false,
    },
  },
  {
    id: "local-mysql",
    name: "Local MySQL",
    description: "MySQL running on localhost",
    dbType: "mysql",
    provider: "local-mysql",
    icon: Server,
    config: {
      host: "localhost",
      port: 3306,
      ssl: false,
    },
  },
  {
    id: "sqlite-file",
    name: "SQLite File",
    description: "File-based SQLite database",
    dbType: "sqlite",
    provider: "file",
    icon: FileText,
    config: {},
  },
]

interface ConnectionTemplatesProps {
  onSelectTemplate: (template: ConnectionTemplate) => void
  selectedDbType?: "postgresql" | "mysql" | "sqlserver" | "sqlite"
}

export function ConnectionTemplates({
  onSelectTemplate,
  selectedDbType,
}: ConnectionTemplatesProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterDbType, setFilterDbType] = useState<string | null>(selectedDbType || null)

  const filteredTemplates = TEMPLATES.filter((template) => {
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesType = !filterDbType || template.dbType === filterDbType

    return matchesSearch && matchesType
  })

  const popularTemplates = filteredTemplates.filter((t) => t.popular)
  const otherTemplates = filteredTemplates.filter((t) => !t.popular)

  const dbTypeFilters = [
    { value: null, label: "All", icon: Database },
    { value: "postgresql", label: "PostgreSQL", icon: Database },
    { value: "mysql", label: "MySQL", icon: Database },
    { value: "sqlserver", label: "SQL Server", icon: Server },
    { value: "sqlite", label: "SQLite", icon: FileText },
  ]

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {dbTypeFilters.map((filter) => (
            <Button
              key={filter.value || "all"}
              variant={filterDbType === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterDbType(filter.value)}
            >
              <filter.icon className="h-4 w-4 mr-2" />
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Popular Templates */}
      {popularTemplates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-600" />
            <h3 className="font-semibold">Popular Templates</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {popularTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => onSelectTemplate(template)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Templates */}
      {otherTemplates.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">All Templates</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {otherTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => onSelectTemplate(template)}
              />
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No templates found</h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  )
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: ConnectionTemplate
  onSelect: () => void
}) {
  const Icon = template.icon
  const [showDetails, setShowDetails] = useState(false)

  const providerConfig = getProvidersForDatabase(template.dbType).find(
    (p) => p.id === template.provider
  )

  return (
    <Dialog open={showDetails} onOpenChange={setShowDetails}>
      <Card className="hover:border-primary transition-colors cursor-pointer group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{template.name}</CardTitle>
                <Badge variant="outline" className="mt-1 text-xs">
                  {template.dbType}
                </Badge>
              </div>
            </div>
            {template.popular && (
              <Star className="h-4 w-4 text-yellow-600 fill-yellow-600" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <CardDescription className="text-sm">
            {template.description}
          </CardDescription>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowDetails(true)}
            >
              Details
            </Button>
            <Button size="sm" className="flex-1" onClick={onSelect}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Use Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Icon className="h-6 w-6 text-primary" />
            {template.name}
          </DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Database Type</h4>
            <Badge>{template.dbType}</Badge>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Default Configuration</h4>
            <div className="space-y-2 text-sm">
              {template.config.host && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Host:</span>
                  <code className="bg-muted px-2 py-1 rounded">{template.config.host}</code>
                </div>
              )}
              {template.config.port && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Port:</span>
                  <code className="bg-muted px-2 py-1 rounded">{template.config.port}</code>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">SSL:</span>
                <Badge variant={template.config.ssl ? "default" : "outline"}>
                  {template.config.ssl ? "Required" : "Optional"}
                </Badge>
              </div>
            </div>
          </div>
          {providerConfig && providerConfig.hints.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Provider Hints</h4>
              <ul className="space-y-1 text-sm">
                {providerConfig.hints.map((hint, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    {hint}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button className="w-full" onClick={() => {
            onSelect()
            setShowDetails(false)
          }}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Use This Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Quick template selector for inline use
 */
export function QuickTemplateSelector({
  dbType,
  onSelect,
}: {
  dbType: "postgresql" | "mysql" | "sqlserver" | "sqlite"
  onSelect: (template: ConnectionTemplate) => void
}) {
  const templates = TEMPLATES.filter((t) => t.dbType === dbType && t.popular)

  if (templates.length === 0) return null

  return (
    <div className="space-y-2">
      <Label>Quick Start Templates</Label>
      <div className="grid gap-2 grid-cols-2">
        {templates.map((template) => (
          <Button
            key={template.id}
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => onSelect(template)}
          >
            <template.icon className="h-4 w-4 mr-2" />
            <div className="text-left">
              <div className="font-medium text-sm">{template.name}</div>
              <div className="text-xs text-muted-foreground">{template.provider}</div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  )
}
