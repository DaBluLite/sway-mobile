// Spotify Web API types used by the library-transfer feature.

export interface SpotifyAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tokenType: string
  scope?: string
}

export interface SpotifyPlaylistSummary {
  id: string
  name: string
  description: string
  owner: string
  public: boolean
  trackCount: number
  imageUrl: string | null
}

export interface SpotifyTrack {
  id: string
  name: string
  artists: string[]
  albumName: string
  durationMs: number
  trackNumber: number
}

export interface SpotifyAlbum {
  id: string
  name: string
  artists: string[]
  releaseDate: string
  totalTracks: number
  imageUrl: string | null
}

export interface SpotifyArtist {
  id: string
  name: string
  genres: string[]
  imageUrl: string | null
}

export interface SpotifyPlaylist extends SpotifyPlaylistSummary {
  tracks: SpotifyTrack[]
}

export interface SpotifyLibrary {
  playlists: SpotifyPlaylist[]
  likedTracks: SpotifyTrack[]
  savedAlbums: SpotifyAlbum[]
  followedArtists: SpotifyArtist[]
}

export interface SpotifyFetchProgress {
  phase: 'playlists' | 'playlist-tracks' | 'liked-tracks' | 'albums' | 'artists'
  total: number
  done: number
}