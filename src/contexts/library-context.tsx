import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { SubsonicStarred, SubsonicCommandResult } from '../types/subsonic'
import subsonicService from '../utils/subsonic'

interface LibraryContextType {
  starred: SubsonicStarred | null
  loading: boolean
  error: string | null
  refreshStarred: () => Promise<void>
  star: (options: {
    id?: string
    artistId?: string
    albumId?: string
  }) => Promise<SubsonicCommandResult>
  unstar: (options: {
    id?: string
    artistId?: string
    albumId?: string
  }) => Promise<SubsonicCommandResult>
  isStarred: (id: string, type: 'song' | 'album' | 'artist') => boolean
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined)

export const LibraryProvider = ({ children }: { children: ReactNode }) => {
  const [starred, setStarred] = useState<SubsonicStarred | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshStarred = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const status = await subsonicService.getCredentialsStatus()
      if (!status.configured) {
        setStarred(null)
        setLoading(false)
        return
      }

      const result = await subsonicService.getStarred()
      if (result.success) {
        setStarred(result.data as SubsonicStarred)
      } else {
        setError(result.error || 'Failed to fetch starred items')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  const star = useCallback(
    async (options: { id?: string; artistId?: string; albumId?: string }) => {
      const result = await subsonicService.star(options)
      if (result.success) {
        await refreshStarred()
      }
      return result
    },
    [refreshStarred]
  )

  const unstar = useCallback(
    async (options: { id?: string; artistId?: string; albumId?: string }) => {
      const result = await subsonicService.unstar(options)
      if (result.success) {
        await refreshStarred()
      }
      return result
    },
    [refreshStarred]
  )

  const isStarred = useCallback(
    (id: string, type: 'song' | 'album' | 'artist') => {
      if (!starred) return false

      switch (type) {
        case 'song':
          return starred.song?.some((s) => s.id === id) || false
        case 'album':
          return starred.album?.some((a) => a.id === id) || false
        case 'artist':
          return starred.artist?.some((art) => art.id === id) || false
        default:
          return false
      }
    },
    [starred]
  )

  // Initial load and listen for credential changes
  useEffect(() => {
    refreshStarred()
  }, [refreshStarred])

  const contextValue = useMemo(
    () => ({
        starred,
        loading,
        error,
        refreshStarred,
        star,
        unstar,
        isStarred
    }),
    [starred, loading, error, refreshStarred, star, unstar, isStarred],
  );

  return (
    <LibraryContext.Provider value={contextValue}>
      {children}
    </LibraryContext.Provider>
  )
}

export const useLibrary = () => {
  const context = useContext(LibraryContext)
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider')
  }
  return context
}
