import { useState, useEffect } from "react"

export interface QueryHistoryItem {
  id: string
  naturalQuery: string
  generatedSQL: string
  timestamp: number
}

const STORAGE_KEY = "nlsql-query-history"
const MAX_HISTORY_ITEMS = 20

export function useQueryHistory() {
  const [history, setHistory] = useState<QueryHistoryItem[]>([])

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setHistory(parsed)
      }
    } catch (error) {
      console.error("Failed to load query history:", error)
    }
  }, [])

  // Save a new query to history
  const addToHistory = (naturalQuery: string, generatedSQL: string) => {
    const newItem: QueryHistoryItem = {
      id: Date.now().toString(),
      naturalQuery,
      generatedSQL,
      timestamp: Date.now(),
    }

    setHistory((prev) => {
      // Add to beginning of array
      const updated = [newItem, ...prev]

      // Keep only last MAX_HISTORY_ITEMS
      const trimmed = updated.slice(0, MAX_HISTORY_ITEMS)

      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
      } catch (error) {
        console.error("Failed to save query history:", error)
      }

      return trimmed
    })
  }

  // Clear all history
  const clearHistory = () => {
    setHistory([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error("Failed to clear query history:", error)
    }
  }

  // Delete a specific item
  const deleteItem = (id: string) => {
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== id)

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
      } catch (error) {
        console.error("Failed to update query history:", error)
      }

      return filtered
    })
  }

  return {
    history,
    addToHistory,
    clearHistory,
    deleteItem,
  }
}
