import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { getItem, setItem, STORES } from '../utils/storage'
import subsonicService from '../utils/subsonic'

interface SubsonicContextType {
  subsonicEnabled: boolean
  setSubsonicEnabled: (enabled: boolean) => void
  isInitialized: boolean
  loggedIn: boolean
}

const SubsonicContext = createContext<SubsonicContextType | undefined>(undefined)

const SUBSONIC_ENABLED_KEY = 'subsonic-enabled-preference'

export const SubsonicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subsonicEnabled, setSubsonicEnabledState] = useState<boolean>(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const unsubscribe = subsonicService.onCredentialsChanged((status) => {
      setLoggedIn(status.configured)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadPreference = async () => {
      const stored = await getItem<boolean>(STORES.SETTINGS, SUBSONIC_ENABLED_KEY)
      if (stored !== null) {
        setSubsonicEnabledState(stored)
      }
      setIsInitialized(true)
    }
    loadPreference()
  }, [])

  const setSubsonicEnabled = useCallback((enabled: boolean) => {
    setSubsonicEnabledState(enabled)
    setItem(STORES.SETTINGS, SUBSONIC_ENABLED_KEY, enabled)
  }, [])

  const contextValue = useMemo(
    () => ({ subsonicEnabled, setSubsonicEnabled, isInitialized, loggedIn }),
    [subsonicEnabled, setSubsonicEnabled, isInitialized, loggedIn],
  )

  return (
    <SubsonicContext.Provider value={contextValue}>
      {children}
    </SubsonicContext.Provider>
  )
}

export const useSubsonic = () => {
  const context = useContext(SubsonicContext)
  if (context === undefined) {
    throw new Error('useSubsonic must be used within a SubsonicProvider')
  }
  return context
}
