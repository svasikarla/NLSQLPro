"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Database, Plus, Trash2, Power, Edit, BarChart3, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorDisplay } from "@/components/error-display"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { MultiDatabaseConnectionForm } from "@/components/multi-database-connection-form"
import { ConnectionTemplates } from "@/components/connection-templates"
import { ConnectionHealthDashboard } from "@/components/connection-health-dashboard"
import { ConnectionStatusIndicator, ConnectionStatusListItem } from "@/components/connection-status-indicator"
import { ConnectionMetricsChart } from "@/components/connection-metrics-chart"

interface Connection {
  id: string
  name: string
  db_type: string
  host: string
  port: number
  database: string
  username: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ConnectionFormData {
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl?: boolean
  ssl_config?: any
}

export default function EnhancedConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<"list" | "dashboard" | "templates">("list")
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [showMetrics, setShowMetrics] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchConnections()
  }, [])

  const fetchConnections = async () => {
    try {
      const response = await fetch("/api/connections/list")
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/auth/login?redirect=/settings/connections")
          return
        }
        throw new Error("Failed to fetch connections")
      }
      const data = await response.json()
      setConnections(data.connections || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connections")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateConnection = async (
    dbType: "postgresql" | "mysql" | "sqlserver" | "sqlite",
    data: ConnectionFormData
  ) => {
    try {
      const response = await fetch("/api/connections/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          db_type: dbType,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create connection")
      }

      setIsFormDialogOpen(false)
      setSelectedConnection(null)
      await fetchConnections()
    } catch (err) {
      throw err // Let the form component handle the error
    }
  }

  const handleUpdateConnection = async (
    dbType: "postgresql" | "mysql" | "sqlserver" | "sqlite",
    data: ConnectionFormData
  ) => {
    if (!selectedConnection) return

    try {
      const response = await fetch("/api/connections/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnection.id,
          ...data,
          db_type: dbType,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update connection")
      }

      setIsFormDialogOpen(false)
      setSelectedConnection(null)
      await fetchConnections()
    } catch (err) {
      throw err // Let the form component handle the error
    }
  }

  const handleTestConnection = async (
    dbType: "postgresql" | "mysql" | "sqlserver" | "sqlite",
    data: ConnectionFormData
  ) => {
    try {
      const response = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          db_type: dbType,
        }),
      })

      const result = await response.json()

      if (result.success) {
        return { success: true, message: "Connection successful!" }
      } else {
        return { success: false, message: result.error || "Connection failed" }
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Failed to test connection",
      }
    }
  }

  const handleActivateConnection = async (connectionId: string) => {
    try {
      const response = await fetch("/api/connections/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      })

      if (!response.ok) {
        throw new Error("Failed to activate connection")
      }

      await fetchConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate connection")
    }
  }

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm("Are you sure you want to delete this connection?")) {
      return
    }

    try {
      const response = await fetch(`/api/connections/delete?id=${connectionId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete connection")
      }

      await fetchConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete connection")
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const handleTemplateSelect = (template: any) => {
    // Open form dialog with template pre-filled
    setIsFormDialogOpen(true)
    // Template will be applied by the form component
  }

  const groupedConnections = connections.reduce((acc, conn) => {
    if (!acc[conn.db_type]) {
      acc[conn.db_type] = []
    }
    acc[conn.db_type].push(conn)
    return acc
  }, {} as Record<string, Connection[]>)

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Database className="text-primary" size={32} />
            <div>
              <h1 className="text-3xl font-bold">Database Connections</h1>
              <p className="text-muted-foreground">Manage connections with health monitoring</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push("/query")}>
              Back to Query
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorDisplay error={error} context="generation" />
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="list">
                <Database className="h-4 w-4 mr-2" />
                Connections
              </TabsTrigger>
              <TabsTrigger value="dashboard">
                <BarChart3 className="h-4 w-4 mr-2" />
                Health Dashboard
              </TabsTrigger>
              <TabsTrigger value="templates">
                <Plus className="h-4 w-4 mr-2" />
                Templates
              </TabsTrigger>
            </TabsList>
            <Button onClick={() => setIsFormDialogOpen(true)} size="lg">
              <Plus className="mr-2" size={18} />
              Add Connection
            </Button>
          </div>

          {/* Connections List Tab */}
          <TabsContent value="list" className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-4">Loading connections...</p>
              </div>
            ) : connections.length === 0 ? (
              <Card className="p-12 text-center">
                <Database className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-xl font-semibold mb-2">No connections yet</h3>
                <p className="text-muted-foreground mb-6">
                  Add your first database connection to get started
                </p>
                <Button onClick={() => setActiveTab("templates")}>
                  Browse Templates
                </Button>
              </Card>
            ) : (
              <>
                {/* Grouped by Database Type */}
                {Object.entries(groupedConnections).map(([dbType, conns]) => (
                  <div key={dbType} className="space-y-3">
                    <h2 className="text-lg font-semibold capitalize flex items-center gap-2">
                      {dbType === "postgresql" && <Database className="h-5 w-5" />}
                      {dbType === "mysql" && <Database className="h-5 w-5" />}
                      {dbType === "sqlserver" && <Database className="h-5 w-5" />}
                      {dbType === "sqlite" && <Database className="h-5 w-5" />}
                      {dbType} ({conns.length})
                    </h2>
                    <div className="grid gap-4">
                      {conns.map((connection) => (
                        <Card key={connection.id}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <CardTitle className="text-xl">{connection.name}</CardTitle>
                                  {connection.is_active && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-600/20 text-green-600">
                                      Active
                                    </span>
                                  )}
                                  <ConnectionStatusIndicator
                                    connectionId={connection.id}
                                    autoRefresh={connection.is_active}
                                    showLabel={false}
                                    size="sm"
                                  />
                                </div>
                                <CardDescription>
                                  {connection.host}:{connection.port} • {connection.database}
                                </CardDescription>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setShowMetrics(showMetrics === connection.id ? null : connection.id)
                                  }
                                >
                                  {showMetrics === connection.id ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedConnection(connection)
                                    setIsFormDialogOpen(true)
                                  }}
                                >
                                  <Edit className="mr-2" size={16} />
                                  Edit
                                </Button>
                                {!connection.is_active && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleActivateConnection(connection.id)}
                                  >
                                    <Power className="mr-2" size={16} />
                                    Activate
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteConnection(connection.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          {showMetrics === connection.id && (
                            <CardContent>
                              <ConnectionHealthDashboard
                                connectionId={connection.id}
                                autoRefresh={true}
                                refreshInterval={30000}
                              />
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </TabsContent>

          {/* Health Dashboard Tab */}
          <TabsContent value="dashboard">
            {connections.filter(c => c.is_active).length === 0 ? (
              <Card className="p-12 text-center">
                <BarChart3 className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-xl font-semibold mb-2">No active connection</h3>
                <p className="text-muted-foreground mb-6">
                  Activate a connection to view health metrics
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                {connections
                  .filter((c) => c.is_active)
                  .map((connection) => (
                    <div key={connection.id} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold">{connection.name}</h2>
                          <p className="text-muted-foreground">
                            {connection.db_type} • {connection.host}:{connection.port}
                          </p>
                        </div>
                        <ConnectionStatusIndicator
                          connectionId={connection.id}
                          autoRefresh={true}
                          showLabel={true}
                          size="lg"
                        />
                      </div>
                      <ConnectionHealthDashboard
                        connectionId={connection.id}
                        autoRefresh={true}
                        refreshInterval={30000}
                      />
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <ConnectionTemplates onSelectTemplate={handleTemplateSelect} />
          </TabsContent>
        </Tabs>

        {/* Connection Form Dialog */}
        <Dialog
          open={isFormDialogOpen}
          onOpenChange={(open) => {
            setIsFormDialogOpen(open)
            if (!open) setSelectedConnection(null)
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedConnection ? 'Edit Database Connection' : 'Add Database Connection'}
              </DialogTitle>
              <DialogDescription>
                {selectedConnection
                  ? 'Update your database connection settings'
                  : 'Choose your database type and configure the connection'
                }
              </DialogDescription>
            </DialogHeader>
            <MultiDatabaseConnectionForm
              initialData={selectedConnection ? {
                name: selectedConnection.name,
                host: selectedConnection.host,
                port: selectedConnection.port,
                database: selectedConnection.database,
                username: selectedConnection.username,
                password: '', // Don't pre-fill password for security
              } : undefined}
              initialDbType={selectedConnection?.db_type as any}
              onSubmit={selectedConnection ? handleUpdateConnection : handleCreateConnection}
              onTest={handleTestConnection}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
