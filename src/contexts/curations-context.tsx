import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { getItem, setItem, STORES } from '../utils/storage'
import { Station } from 'radio-browser-api'
import { randomUUID } from 'react-native-quick-crypto'

export interface CuratedCollection {
  id: string
  name: string
  description: string
  icon: string // MDI icon path or emoji
  color: string // Tailwind color class
  stations: Station[]
  featured: boolean
  order: number
  createdAt: number
  updatedAt: number
}

interface CurationsContextType {
  collections: CuratedCollection[]
  featuredCollections: CuratedCollection[]
  isLoading: boolean
  getCollection: (id: string) => CuratedCollection | undefined
  createCollection: (collection: Omit<CuratedCollection, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateCollection: (id: string, updates: Partial<CuratedCollection>) => void
  deleteCollection: (id: string) => void
  addStationToCollection: (collectionId: string, station: Station) => void
  removeStationFromCollection: (collectionId: string, stationUrl: string) => void
  reorderCollections: (orderedIds: string[]) => void
  importDefaultCollections: () => void
  importCurations: (collections: CuratedCollection[]) => void
}

const CurationsContext = createContext<CurationsContextType | undefined>(undefined)

const CURATIONS_KEY = 'curations'

// Default curated collections
const DEFAULT_COLLECTIONS: Omit<CuratedCollection, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'chill-vibes',
    name: 'Chill Vibes',
    description: 'Relaxing stations for unwinding and meditation',
    icon: '🌊',
    color: 'from-blue-500 to-cyan-500',
    stations: [],
    featured: true,
    order: 0
  },
  {
    id: 'morning-energy',
    name: 'Morning Energy',
    description: 'Upbeat stations to start your day right',
    icon: '☀️',
    color: 'from-yellow-500 to-orange-500',
    stations: [],
    featured: true,
    order: 1
  },
  {
    id: 'focus-study',
    name: 'Focus & Study',
    description: 'Concentration-boosting instrumentals and lo-fi beats',
    icon: '📚',
    color: 'from-purple-500 to-indigo-500',
    stations: [],
    featured: true,
    order: 2
  },
  {
    id: 'party-mix',
    name: 'Party Mix',
    description: 'High-energy stations for celebrations',
    icon: '🎉',
    color: 'from-pink-500 to-red-500',
    stations: [],
    featured: true,
    order: 3
  },
  {
    id: 'jazz-classics',
    name: 'Jazz Classics',
    description: 'Timeless jazz from legendary artists',
    icon: '🎷',
    color: 'from-amber-600 to-yellow-600',
    stations: [],
    featured: false,
    order: 4
  },
  {
    id: 'world-music',
    name: 'World Music',
    description: 'Discover sounds from around the globe',
    icon: '🌍',
    color: 'from-green-500 to-teal-500',
    stations: [],
    featured: false,
    order: 5
  },
  {
    id: 'late-night',
    name: 'Late Night',
    description: 'Smooth tunes for after dark',
    icon: '🌙',
    color: 'from-slate-600 to-gray-800',
    stations: [],
    featured: false,
    order: 6
  },
  {
    id: 'workout',
    name: 'Workout',
    description: 'High-BPM tracks to power your exercise',
    icon: '💪',
    color: 'from-red-500 to-orange-500',
    stations: [],
    featured: false,
    order: 7
  }
]

export const CurationsProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}: {
  children: React.ReactNode
}) => {
  const [collections, setCollections] = useState<CuratedCollection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load collections from IndexedDB
  useEffect(() => {
    const loadCollections = async () => {
      setIsLoading(true)
      const stored = await getItem<CuratedCollection[]>(STORES.CURATIONS, CURATIONS_KEY)
      if (stored && stored.length > 0) {
        setCollections(stored.sort((a, b) => a.order - b.order))
      }
      setIsLoading(false)
      setIsLoaded(true)
    }
    loadCollections()
  }, [])

  // Persist collections
  useEffect(() => {
    if (isLoaded) {
      setItem(STORES.CURATIONS, CURATIONS_KEY, collections)
    }
  }, [collections, isLoaded])

  const featuredCollections = collections.filter((c) => c.featured)

  const getCollection = useCallback(
    (id: string) => collections.find((c) => c.id === id),
    [collections]
  )

  const createCollection = useCallback(
    (collectionData: Omit<CuratedCollection, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = Date.now()
      const newCollection: CuratedCollection = {
        ...collectionData,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now
      }
      setCollections((prev) => [...prev, newCollection].sort((a, b) => a.order - b.order))
    },
    []
  )

  const importCurations = useCallback((imported: CuratedCollection[]) => {
    setCollections((prev) => {
      const existingIds = new Set(prev.map((c) => c.id))
      const merged = [
        ...prev,
        ...imported
          .filter((c) => !existingIds.has(c.id))
          .map((c) => ({ ...c, createdAt: Date.now(), updatedAt: Date.now() }))
      ]
      return merged.sort((a, b) => a.order - b.order)
    })
  }, [])

  const updateCollection = useCallback((id: string, updates: Partial<CuratedCollection>) => {
    setCollections((prev) =>
      prev
        .map((collection) =>
          collection.id === id ? { ...collection, ...updates, updatedAt: Date.now() } : collection
        )
        .sort((a, b) => a.order - b.order)
    )
  }, [])

  const deleteCollection = useCallback((id: string) => {
    setCollections((prev) => prev.filter((collection) => collection.id !== id))
  }, [])

  const addStationToCollection = useCallback((collectionId: string, station: Station) => {
    setCollections((prev) =>
      prev.map((collection) => {
        if (collection.id !== collectionId) return collection

        // Check if station already exists
        if (collection.stations.some((s) => s.url === station.url)) {
          return collection
        }

        return {
          ...collection,
          stations: [...collection.stations, station],
          updatedAt: Date.now()
        }
      })
    )
  }, [])

  const removeStationFromCollection = useCallback((collectionId: string, stationUrl: string) => {
    setCollections((prev) =>
      prev.map((collection) => {
        if (collection.id !== collectionId) return collection

        return {
          ...collection,
          stations: collection.stations.filter((s) => s.url !== stationUrl),
          updatedAt: Date.now()
        }
      })
    )
  }, [])

  const reorderCollections = useCallback((orderedIds: string[]) => {
    setCollections((prev) => {
      const ordered = orderedIds
        .map((id, index) => {
          const collection = prev.find((c) => c.id === id)
          if (collection) {
            return { ...collection, order: index }
          }
          return null
        })
        .filter(Boolean) as CuratedCollection[]

      // Add any collections not in the ordered list
      const missingCollections = prev.filter((c) => !orderedIds.includes(c.id))
      missingCollections.forEach((c, i) => {
        c.order = ordered.length + i
      })

      return [...ordered, ...missingCollections]
    })
  }, [])

  const importDefaultCollections = useCallback(() => {
    const now = Date.now()
    const defaultWithIds: CuratedCollection[] = DEFAULT_COLLECTIONS.map((collection, index) => ({
      ...collection,
      order: index,
      createdAt: now,
      updatedAt: now
    }))

    setCollections((prev) => {
      // Only add collections that don't exist by name
      const existingNames = new Set(prev.map((c) => c.name.toLowerCase()))
      const newCollections = defaultWithIds.filter((c) => !existingNames.has(c.name.toLowerCase()))

      return [...prev, ...newCollections].sort((a, b) => a.order - b.order)
    })
  }, [])

  const contextValue = useMemo(
    () => ({
        collections,
        featuredCollections,
        isLoading,
        getCollection,
        createCollection,
        updateCollection,
        deleteCollection,
        addStationToCollection,
        removeStationFromCollection,
        reorderCollections,
        importDefaultCollections,
        importCurations
    }),
    [collections, featuredCollections, isLoading, getCollection, createCollection, updateCollection, deleteCollection, addStationToCollection, removeStationFromCollection, reorderCollections, importDefaultCollections, importCurations],
  );

  return (
    <CurationsContext.Provider value={contextValue}>
      {children}
    </CurationsContext.Provider>
  )
}

export const useCurations = (): CurationsContextType => {
  const context = useContext(CurationsContext)
  if (!context) {
    throw new Error('useCurations must be used within CurationsProvider')
  }
  return context
}
