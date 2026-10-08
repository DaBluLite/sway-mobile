import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { SubsonicPlaylist, SubsonicSong } from '../types/subsonic'
import subsonicService from '../utils/subsonic'

interface PlaylistsContextType {
  playlists: SubsonicPlaylist[]
  loading: boolean
  refreshPlaylists: () => Promise<void>
  createPlaylist: (name: string, songIds?: string[]) => Promise<SubsonicPlaylist | undefined>
  deletePlaylist: (playlistId: string) => Promise<void>
  updatePlaylist: (playlistId: string, name?: string, comment?: string) => Promise<void>
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<void>
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>
  isSongInPlaylist: (playlistId: string, songId: string) => Promise<boolean>
}

const PlaylistsContext = createContext<PlaylistsContextType | undefined>(undefined)

export const PlaylistsProvider = ({ children }: { children: ReactNode }) => {
  const [playlists, setPlaylists] = useState<SubsonicPlaylist[]>([])
  const [loading, setLoading] = useState(false)

  const refreshPlaylists = useCallback(async () => {
    setLoading(true)
    try {
      const status = await subsonicService.getCredentialsStatus()
      if (!status.configured) {
        setPlaylists([])
        return
      }

      const result = await subsonicService.getPlaylists()
      if (result.success && Array.isArray(result.data)) {
        setPlaylists(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch Subsonic playlists:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const createPlaylist = useCallback(async (name: string, songIds: string[] = []) => {
    try {
      const result = await subsonicService.createPlaylist(name, songIds)
      if (result.success) {
        await refreshPlaylists()
        return result.data as SubsonicPlaylist
      }
    } catch (error) {
      console.error('Failed to create playlist: ', error)
    }
  }, [refreshPlaylists])

  const deletePlaylist = useCallback(async (playlistId: string) => {
    try {
      const result = await subsonicService.deletePlaylist(playlistId)
      if (result.success) {
        await refreshPlaylists()
      }
    } catch (error) {
      console.error('Failed to create playlist: ', error)
    }
  }, [refreshPlaylists])

  const updatePlaylist = useCallback(async (playlistId: string, name?: string, comment?: string) => {
    const result = await subsonicService.updatePlaylist(playlistId, name, comment)
    if (result.success) {
      await refreshPlaylists()
    } else {
      throw new Error(result.error || 'Failed to update playlist')
    }
  }, [refreshPlaylists])

  const addSongToPlaylist = useCallback(async (playlistId: string, songId: string) => {
    const getRes = await subsonicService.getPlaylist(playlistId)
    if (getRes.success && getRes.data) {
      const currentPlaylist = getRes.data as SubsonicPlaylist
      const currentSongs = currentPlaylist.entry || []
      const songIds = [...currentSongs.map((s: SubsonicSong) => s.id), songId]

      const res = await subsonicService.replacePlaylistSongs(playlistId, songIds)
      if (res.success) {
        await refreshPlaylists()
      } else {
        throw new Error(res.error || 'Failed to add song to playlist')
      }
    }
  }, [refreshPlaylists])

  const removeSongFromPlaylist = useCallback(async (playlistId: string, songId: string) => {
    const getRes = await subsonicService.getPlaylist(playlistId)
    if (getRes.success && getRes.data) {
      const currentPlaylist = getRes.data as SubsonicPlaylist
      const currentSongs = currentPlaylist.entry || []
      const songIds: string[] = []; for (const s of currentSongs) if (s.id !== songId) songIds.push(s.id)

      const res = await subsonicService.replacePlaylistSongs(playlistId, songIds)
      if (res.success) {
        await refreshPlaylists()
      } else {
        throw new Error(res.error || 'Failed to remove song from playlist')
      }
    }
  }, [refreshPlaylists])

  const isSongInPlaylist = useCallback(async (playlistId: string, songId: string): Promise<boolean> => {
    const getRes = await subsonicService.getPlaylist(playlistId)
    if (getRes.success && getRes.data) {
      const currentPlaylist = getRes.data as SubsonicPlaylist
      const currentSongs = currentPlaylist.entry || []
      return currentSongs.some((s: SubsonicSong) => s.id === songId)
    }
    return false
  }, [])

  useEffect(() => {
    refreshPlaylists()
  }, [refreshPlaylists])

  const contextValue = useMemo(
    () => ({
        playlists,
        loading,
        refreshPlaylists,
        createPlaylist,
        deletePlaylist,
        updatePlaylist,
        addSongToPlaylist,
        removeSongFromPlaylist,
        isSongInPlaylist
    }),
    [playlists, loading, refreshPlaylists, createPlaylist, deletePlaylist, updatePlaylist, addSongToPlaylist, removeSongFromPlaylist, isSongInPlaylist],
  );

  return (
    <PlaylistsContext.Provider value={contextValue}>
      {children}
    </PlaylistsContext.Provider>
  )
}

export const usePlaylists = () => {
  const context = useContext(PlaylistsContext)
  if (!context) {
    throw new Error('usePlaylists must be used within PlaylistsProvider')
  }
  return context
}
