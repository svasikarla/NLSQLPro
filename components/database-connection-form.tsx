"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Check, X, AlertCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Database connection schema
const baseConnectionSchema = z.object({
  name: z.string().min(1, "Connection name is required"),
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().min(1, "Port must be a positive number"),
  database: z.string().min(1, "Database name is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  ssl: z.boolean().optional(),
})

type BaseConnectionForm = z.infer<typeof baseConnectionSchema>

interface Provider {
  id: string
  name: string
  icon?: string
  defaultPort: number
  requiresSSL: boolean
  hints: string[]
  template?: Partial<BaseConnectionForm>
}

interface DatabaseConnectionFormProps {
  dbType: "postgresql" | "mysql" | "sqlserver" | "sqlite"
  providers: Provider[]
  onSubmit: (data: BaseConnectionForm) => Promise<void>
  onTest?: (data: BaseConnectionForm) => Promise<{ success: boolean; message: string }>
  defaultValues?: Partial<BaseConnectionForm>
}

export function DatabaseConnectionForm({
  dbType,
  providers,
  onSubmit,
  onTest,
  defaultValues,
}: DatabaseConnectionFormProps) {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<BaseConnectionForm>({
    resolver: zodResolver(baseConnectionSchema),
    defaultValues: defaultValues || {
      name: "",
      host: "",
      port: providers[0]?.defaultPort || 5432,
      database: "",
      username: "",
      password: "",
      ssl: false,
    },
  })

  const handleProviderChange = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider) return

    setSelectedProvider(provider)
    setTestResult(null)

    // Apply provider template
    if (provider.template) {
      Object.entries(provider.template).forEach(([key, value]) => {
        if (value !== undefined) {
          form.setValue(key as keyof BaseConnectionForm, value)
        }
      })
    }

    // Set default port and SSL
    form.setValue("port", provider.defaultPort)
    form.setValue("ssl", provider.requiresSSL)
  }

  const handleTestConnection = async () => {
    const isValid = await form.trigger()
    if (!isValid || !onTest) return

    setIsTestingConnection(true)
    setTestResult(null)

    try {
      const data = form.getValues()
      const result = await onTest(data)
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection test failed",
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleSubmit = async (data: BaseConnectionForm) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {dbType === "postgresql" && "PostgreSQL Connection"}
          {dbType === "mysql" && "MySQL Connection"}
          {dbType === "sqlserver" && "SQL Server Connection"}
          {dbType === "sqlite" && "SQLite Connection"}
        </CardTitle>
        <CardDescription>
          Configure your database connection settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Provider Selection */}
          {providers.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select onValueChange={handleProviderChange}>
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select a provider..." />
                </SelectTrigger>
                <SelectContent>
                  {providers.map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProvider && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <span>
                    Default port: {selectedProvider.defaultPort}
                    {selectedProvider.requiresSSL && " • SSL Required"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Provider Hints */}
          {selectedProvider && selectedProvider.hints.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {selectedProvider.hints.map((hint, idx) => (
                    <div key={idx} className="text-sm">
                      {hint}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Connection Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Connection Name</Label>
            <Input
              id="name"
              placeholder="My Database"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Host */}
          <div className="space-y-2">
            <Label htmlFor="host">Host</Label>
            <Input
              id="host"
              placeholder={dbType === "sqlite" ? "/path/to/database.sqlite" : "localhost"}
              {...form.register("host")}
            />
            {form.formState.errors.host && (
              <p className="text-sm text-red-600">{form.formState.errors.host.message}</p>
            )}
          </div>

          {/* Port (hide for SQLite) */}
          {dbType !== "sqlite" && (
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                {...form.register("port")}
              />
              {form.formState.errors.port && (
                <p className="text-sm text-red-600">{form.formState.errors.port.message}</p>
              )}
            </div>
          )}

          {/* Database */}
          <div className="space-y-2">
            <Label htmlFor="database">Database</Label>
            <Input
              id="database"
              placeholder={dbType === "sqlite" ? "main" : "mydb"}
              {...form.register("database")}
            />
            {form.formState.errors.database && (
              <p className="text-sm text-red-600">{form.formState.errors.database.message}</p>
            )}
          </div>

          {/* Username (hide for SQLite) */}
          {dbType !== "sqlite" && (
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="admin"
                {...form.register("username")}
              />
              {form.formState.errors.username && (
                <p className="text-sm text-red-600">{form.formState.errors.username.message}</p>
              )}
            </div>
          )}

          {/* Password (hide for SQLite) */}
          {dbType !== "sqlite" && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
              )}
            </div>
          )}

          {/* SSL Toggle (hide for SQLite) */}
          {dbType !== "sqlite" && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="ssl"
                {...form.register("ssl")}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="ssl" className="font-normal">
                Use SSL/TLS encryption
              </Label>
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4" />
              )}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {onTest && (
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Connection"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
