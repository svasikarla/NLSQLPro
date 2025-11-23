"use client"

import { useState } from "react"
import { DatabaseConnectionForm } from "./database-connection-form"
import { getProvidersForDatabase } from "@/lib/connection-manager/provider-configs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Database, Cylinder, Server, FileText } from "lucide-react"

type DatabaseType = "postgresql" | "mysql" | "sqlserver" | "sqlite"

interface ConnectionFormData {
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl?: boolean
}

interface MultiDatabaseConnectionFormProps {
  defaultDbType?: DatabaseType
  initialData?: Partial<ConnectionFormData>
  initialDbType?: DatabaseType
  onSubmit: (dbType: DatabaseType, data: ConnectionFormData) => Promise<void>
  onTest?: (dbType: DatabaseType, data: ConnectionFormData) => Promise<{ success: boolean; message: string }>
}

export function MultiDatabaseConnectionForm({
  defaultDbType = "postgresql",
  initialData,
  initialDbType,
  onSubmit,
  onTest,
}: MultiDatabaseConnectionFormProps) {
  const [activeTab, setActiveTab] = useState<DatabaseType>(initialDbType || defaultDbType)

  const handleSubmit = async (data: ConnectionFormData) => {
    await onSubmit(activeTab, data)
  }

  const handleTest = async (data: ConnectionFormData) => {
    if (!onTest) return { success: false, message: "Test not available" }
    return await onTest(activeTab, data)
  }

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DatabaseType)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="postgresql" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">PostgreSQL</span>
            <span className="sm:hidden">PG</span>
          </TabsTrigger>
          <TabsTrigger value="mysql" className="flex items-center gap-2">
            <Cylinder className="h-4 w-4" />
            <span className="hidden sm:inline">MySQL</span>
            <span className="sm:hidden">MySQL</span>
          </TabsTrigger>
          <TabsTrigger value="sqlserver" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">SQL Server</span>
            <span className="sm:hidden">MSSQL</span>
          </TabsTrigger>
          <TabsTrigger value="sqlite" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">SQLite</span>
            <span className="sm:hidden">SQLite</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="postgresql" className="mt-6">
          <DatabaseConnectionForm
            dbType="postgresql"
            providers={getProvidersForDatabase("postgresql")}
            defaultValues={initialData}
            onSubmit={handleSubmit}
            onTest={onTest ? handleTest : undefined}
          />
        </TabsContent>

        <TabsContent value="mysql" className="mt-6">
          <DatabaseConnectionForm
            dbType="mysql"
            providers={getProvidersForDatabase("mysql")}
            defaultValues={initialData}
            onSubmit={handleSubmit}
            onTest={onTest ? handleTest : undefined}
          />
        </TabsContent>

        <TabsContent value="sqlserver" className="mt-6">
          <DatabaseConnectionForm
            dbType="sqlserver"
            providers={getProvidersForDatabase("sqlserver")}
            defaultValues={initialData}
            onSubmit={handleSubmit}
            onTest={onTest ? handleTest : undefined}
          />
        </TabsContent>

        <TabsContent value="sqlite" className="mt-6">
          <DatabaseConnectionForm
            dbType="sqlite"
            providers={getProvidersForDatabase("sqlite")}
            defaultValues={initialData}
            onSubmit={handleSubmit}
            onTest={onTest ? handleTest : undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
