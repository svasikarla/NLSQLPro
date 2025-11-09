"use client"

import { History, Clock, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { QueryHistoryItem } from "@/hooks/use-query-history"

interface QueryHistoryProps {
  history: QueryHistoryItem[]
  onSelectQuery: (item: QueryHistoryItem) => void
  onClearHistory: () => void
  onDeleteItem: (id: string) => void
}

export function QueryHistory({
  history,
  onSelectQuery,
  onClearHistory,
  onDeleteItem,
}: QueryHistoryProps) {
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History size={16} />
          History
          {history.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {history.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Query History</SheetTitle>
          <SheetDescription>
            Your last {history.length} queries
          </SheetDescription>
        </SheetHeader>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History size={48} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No query history yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your queries will appear here
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Showing {history.length} {history.length === 1 ? "query" : "queries"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearHistory}
                className="text-xs text-destructive hover:text-destructive"
              >
                <Trash2 size={14} className="mr-1" />
                Clear All
              </Button>
            </div>

            <div className="space-y-3">
              {history.map((item) => (
                <Card
                  key={item.id}
                  className="p-4 cursor-pointer hover:border-primary/50 transition-colors relative group"
                  onClick={() => onSelectQuery(item)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteItem(item.id)
                    }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                  >
                    <X size={14} className="text-muted-foreground hover:text-destructive" />
                  </button>

                  <div className="flex items-start gap-2 mb-2">
                    <Clock size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>

                  <p className="text-sm font-medium mb-2 pr-6">
                    {item.naturalQuery}
                  </p>

                  <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto font-mono text-muted-foreground">
                    {item.generatedSQL.length > 100
                      ? item.generatedSQL.substring(0, 100) + "..."
                      : item.generatedSQL}
                  </pre>
                </Card>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
