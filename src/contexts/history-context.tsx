import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { Station } from 'radio-browser-api'
import { getItem, setItem, STORES } from '../utils/storage'

export interface HistoryEntry {
  station: Station
  playedAt: string // ISO timestamp
  duration?: number // seconds listened (optional for future use)
}

interface HistoryContextType {
  history: HistoryEntry[]
  addToHistory: (station: Station) => void
  removeFromHistory: (url: string, playedAt: string) => void
  clearHistory: () => void
  getRecentStations: (limit?: number) => Station[]
  getMostPlayed: (limit?: number) => { station: Station; count: number }[]
  importHistory: (entries: HistoryEntry[], merge?: boolean) => void
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined)

const STORAGE_KEY = 'listening-history'
const MAX_HISTORY_SIZE = 100 // Keep last 100 entries

interface HistoryProviderProps {
  children: React.ReactNode
}

export const HistoryProvider: React.FC<HistoryProviderProps> = ({
  children
}: HistoryProviderProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Load history from IndexedDB on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const stored = getItem<HistoryEntry[]>(STORES.SETTINGS, STORAGE_KEY)
        if (stored && Array.isArray(stored)) {
          setHistory(stored)
        }
      } catch (error) {
        console.error('Failed to load history from IndexedDB:', error)
      } finally {
        setIsInitialized(true)
      }
    }

    loadHistory()
  }, [])

  // Save history to IndexedDB whenever it changes
  useEffect(() => {
    if (isInitialized) {
      try {
        setItem(STORES.SETTINGS, STORAGE_KEY, history)
      } catch (error) {
        console.error('Failed to save history to IndexedDB:', error)
      }
    }
  }, [history, isInitialized])

  const addToHistory = useCallback((station: Station) => {
    const entry: HistoryEntry = {
      station,
      playedAt: new Date().toISOString()
    }

    setHistory((prev) => {
      // Add new entry at the beginning
      const newHistory = [entry, ...prev]

      // Limit history size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        return newHistory.slice(0, MAX_HISTORY_SIZE)
      }

      return newHistory
    })
  }, [])

  const removeFromHistory = useCallback((url: string, playedAt: string) => {
    setHistory((prev) =>
      prev.filter((entry) => !(entry.station.url === url && entry.playedAt === playedAt))
    )
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  // Import history entries from backup
  const importHistory = useCallback((entries: HistoryEntry[], merge: boolean = true) => {
    if (!entries || !Array.isArray(entries)) return

    setHistory((prev) => {
      if (!merge) {
        // Replace existing history
        return entries.slice(0, MAX_HISTORY_SIZE)
      }

      // Merge with existing history, avoiding duplicates based on url + playedAt
      const existingKeys = new Set(prev.map((e) => `${e.station.url}|${e.playedAt}`))

      const newEntries = entries.filter(
        (entry) => !existingKeys.has(`${entry.station.url}|${entry.playedAt}`)
      )

      // Combine and sort by playedAt (most recent first)
      const combined = [...prev, ...newEntries]
        .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
        .slice(0, MAX_HISTORY_SIZE)

      return combined
    })
  }, [])

  // Get unique recent stations (deduplicated by URL)
  const getRecentStations = useCallback(
    (limit: number = 10): Station[] => {
      const seen = new Set<string>()
      const recentStations: Station[] = []

      for (const entry of history) {
        if (!seen.has(entry.station.url)) {
          seen.add(entry.station.url)
          recentStations.push(entry.station)

          if (recentStations.length >= limit) {
            break
          }
        }
      }

      return recentStations
    },
    [history]
  )

  // Get most frequently played stations
  const getMostPlayed = useCallback(
    (limit: number = 10): { station: Station; count: number }[] => {
      const countMap = new Map<string, { station: Station; count: number }>()

      for (const entry of history) {
        const existing = countMap.get(entry.station.url)
        if (existing) {
          existing.count++
        } else {
          countMap.set(entry.station.url, { station: entry.station, count: 1 })
        }
      }

      return Array.from(countMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
    },
    [history]
  )

  const contextValue = useMemo(
    () => ({
        history,
        addToHistory,
        removeFromHistory,
        clearHistory,
        getRecentStations,
        getMostPlayed,
        importHistory
    }),
    [history, addToHistory, removeFromHistory, clearHistory, getRecentStations, getMostPlayed, importHistory],
  );

  return (
    <HistoryContext.Provider value={contextValue}>
      {children}
    </HistoryContext.Provider>
  )
}

export const useHistory = (): HistoryContextType => {
  const context = useContext(HistoryContext)
  if (!context) {
    throw new Error('useHistory must be used within HistoryProvider')
  }
  return context
}
