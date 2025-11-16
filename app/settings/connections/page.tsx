"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Database, Plus, Trash2, Power, CheckCircle2, AlertCircle, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ErrorDisplay } from "@/components/error-display"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"

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

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    db_type: "postgresql" as "postgresql" | "mysql" | "sqlite" | "sqlserver",
    host: "",
    port: "5432",
    database: "",
    username: "",
    password: "",
  })
  const [formError, setFormError] = useState("")
  const [formLoading, setFormLoading] = useState(false)
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [testMessage, setTestMessage] = useState("")

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

  // Helper to get default port for database type
  const getDefaultPort = (dbType: typeof formData.db_type): string => {
    const ports = {
      postgresql: "5432",
      mysql: "3306",
      sqlite: "",
      sqlserver: "1433",
    }
    return ports[dbType]
  }

  // Handle database type change
  const handleDbTypeChange = (newDbType: typeof formData.db_type) => {
    setFormData({
      ...formData,
      db_type: newDbType,
      port: getDefaultPort(newDbType),
    })
  }

  const handleTestConnection = async () => {
    setTestStatus("testing")
    setTestMessage("")

    try {
      const response = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: formData.host,
          port: parseInt(formData.port),
          database: formData.database,
          username: formData.username,
          password: formData.password,
          db_type: formData.db_type,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setTestStatus("success")
        setTestMessage("Connection successful!")
      } else {
        setTestStatus("error")
        setTestMessage(data.error || "Connection failed")
      }
    } catch (err) {
      setTestStatus("error")
      setTestMessage("Failed to test connection")
    }
  }

  const handleEditConnection = (connection: Connection) => {
    setEditingConnection(connection)
    setFormData({
      name: connection.name,
      db_type: connection.db_type as typeof formData.db_type,
      host: connection.host,
      port: connection.port.toString(),
      database: connection.database,
      username: connection.username,
      password: "", // Don't populate password for security
    })
    setTestStatus("idle")
    setTestMessage("")
    setIsDialogOpen(true)
  }

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setFormLoading(true)

    try {
      const endpoint = editingConnection ? "/api/connections/update" : "/api/connections/create"
      const body: any = {
        name: formData.name,
        db_type: formData.db_type,
        host: formData.host,
        port: parseInt(formData.port),
        database: formData.database,
        username: formData.username,
      }

      // Only include password if it's provided
      if (formData.password) {
        body.password = formData.password
      }

      // Add connection ID for update
      if (editingConnection) {
        body.connectionId = editingConnection.id
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to ${editingConnection ? 'update' : 'create'} connection`)
      }

      // Reset form
      setFormData({
        name: "",
        db_type: "postgresql",
        host: "",
        port: "5432",
        database: "",
        username: "",
        password: "",
      })
      setTestStatus("idle")
      setTestMessage("")
      setIsDialogOpen(false)
      setEditingConnection(null)

      // Refresh connections list
      await fetchConnections()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : `Failed to ${editingConnection ? 'update' : 'create'} connection`)
    } finally {
      setFormLoading(false)
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

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Database className="text-primary" size={32} />
            <div>
              <h1 className="text-3xl font-bold">Database Connections</h1>
              <p className="text-muted-foreground">Manage your database connections</p>
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

        {/* Add Connection Button */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="mb-6" size="lg">
              <Plus className="mr-2" size={18} />
              Add New Connection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingConnection ? 'Edit Database Connection' : 'Add Database Connection'}</DialogTitle>
              <DialogDescription>
                {editingConnection
                  ? 'Update your database connection details'
                  : 'Enter your database connection details'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateConnection} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Connection Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Production DB"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Database Type</label>
                <Select value={formData.db_type} onValueChange={handleDbTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select database type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="sqlite">SQLite</SelectItem>
                    <SelectItem value="sqlserver">SQL Server</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.db_type === 'sqlite' ? (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Database File Path</label>
                  <Input
                    value={formData.database}
                    onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                    placeholder="/path/to/database.sqlite"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Path to SQLite database file on the server
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Host</label>
                  <Input
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="localhost or pooler.supabase.com"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    For Supabase: use aws-0-[region].pooler.supabase.com
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Port</label>
                  <Input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    placeholder="5432"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use 6543 for Supabase pooler
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Database Name</label>
                <Input
                  value={formData.database}
                  onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                  placeholder="mydb"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Username</label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="postgres"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Password {editingConnection && <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>}
                  </label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    required={!editingConnection}
                  />
                </div>
              </div>
              </>
              )}

              {/* Test Connection */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testStatus === "testing"}
                >
                  {testStatus === "testing" ? "Testing..." : "Test Connection"}
                </Button>
                {testStatus === "success" && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 size={18} />
                    <span className="text-sm">{testMessage}</span>
                  </div>
                )}
                {testStatus === "error" && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle size={18} />
                    <span className="text-sm">{testMessage}</span>
                  </div>
                )}
              </div>

              {formError && <ErrorDisplay error={formError} context="generation" />}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={formLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={formLoading || (testStatus !== "success" && testStatus !== "idle")}>
                  {formLoading
                    ? (editingConnection ? "Updating..." : "Creating...")
                    : (editingConnection ? "Update Connection" : "Create Connection")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Connections List */}
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
          </Card>
        ) : (
          <div className="grid gap-4">
            {connections.map((connection) => (
              <Card key={connection.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{connection.name}</h3>
                      {connection.is_active && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-600/20 text-green-600">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Host:</span> {connection.host}:{connection.port}
                      </div>
                      <div>
                        <span className="font-medium">Database:</span> {connection.database}
                      </div>
                      <div>
                        <span className="font-medium">Username:</span> {connection.username}
                      </div>
                      <div>
                        <span className="font-medium">Type:</span> {connection.db_type}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                      onClick={() => handleEditConnection(connection)}
                    >
                      <Edit size={16} />
                    </Button>
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
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
