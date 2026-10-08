// Subsonic API Types and Interfaces

// Subsonic Credentials Storage
export interface SubsonicCredentials {
  username: string
  serverUrl: string
  hashedPassword: string
  passwordSalt: string
}

// Subsonic Stream Command
export interface SubsonicStreamCommand {
  songId: string
}

export type SubsonicArtistRef = {
  id: string
  name: string
}

export type SubsonicReplayGain = {
  trackGain?: number
  albumGain?: number
  trackPeak?: number
  albumPeak?: number
  baseGain?: number
}

export type SubsonicReleaseDate = {
  year?: number
  month?: number
  day?: number
}

export type SubsonicSong = {
  id: string
  parent: string
  isDir: boolean
  title: string
  album: string
  artist: string
  track: number
  year: number
  coverArt: string
  size: number
  contentType: string
  suffix: string
  duration: number
  bitRate: number
  path: string
  discNumber: number
  created: string
  albumId: string
  artistId: string
  type: string
  mediaType: string
  bpm: number
  comment: string
  sortName: string
  musicBrainzId: string
  isrc: string[]
  genres: string[]
  replayGain: SubsonicReplayGain
  channelCount: number
  samplingRate: number
  bitDepth: number
  moods: string[]
  artists: SubsonicArtistRef[]
  displayArtist: string
  albumArtists: SubsonicArtistRef[]
  displayAlbumArtist: string
  contributors: unknown[]
  displayComposer: string
  explicitStatus: string
  // optional — only present on some songs
  playCount?: number
  played?: string
}

export type SubsonicAlbum = {
  id: string
  name: string
  artist: string
  artistId: string
  coverArt: string
  songCount: number
  duration: number
  playCount: number
  created: string
  year: number
  played: string
  userRating: number
  genres: string[]
  musicBrainzId: string
  isCompilation: boolean
  sortName: string
  discTitles: unknown[]
  originalReleaseDate: SubsonicReleaseDate
  releaseDate: SubsonicReleaseDate
  releaseTypes: string[]
  recordLabels: unknown[]
  moods: string[]
  artists: SubsonicArtistRef[]
  displayArtist: string
  explicitStatus: string
  version: string
  song: SubsonicSong[]
}

export type SubsonicArtist = {
  id: string
  name: string
  albumCount: number
  album: SubsonicAlbum[]
}

export type SubsonicAlbumList = {
  id: string
  parent: string
  title: string
  artist: string
  isDir: boolean
  coverArt: string
  userRating: number | null
  averageRating: number | null
}[]

export type SubsonicPlaylist = {
  id: string
  name: string
  owner: string
  public: boolean
  songCount: number
  duration: number
  created: string
  changed: string
  coverArt?: string
  entry?: SubsonicSong[]
}

export type SubsonicPlaylists = SubsonicPlaylist[]

export type SubsonicStarred = {
  artist?: SubsonicArtist[]
  album?: SubsonicAlbum[]
  song?: SubsonicSong[]
}

// Subsonic API Response Types
export interface SubsonicApiResponse {
  'subsonic-response': {
    status: 'ok' | 'failed'
    version: string
    error?: {
      code: number
      message: string
    }
  }
}

export interface SubsonicStreamResponse extends SubsonicApiResponse {
  'subsonic-response': SubsonicApiResponse['subsonic-response'] & {
    // Stream endpoint returns binary audio data, not JSON structure
    // But response status is indicated via HTTP status code
  }
}

// IPC Command and Response Types
export interface SubsonicCommandResult {
  success: boolean
  error?: string
  streamUrl?: string
  data?: unknown
}

export interface SubsonicSetCredentialsCommand {
  username: string
  password: string
  serverUrl: string
}

export interface SubsonicSearchCommand {
  query: string
  offset?: number
  size?: number
}

export interface SubsonicSearchResult {
  song?: SubsonicSong[]
  album?: SubsonicAlbum[]
  artist?: SubsonicArtist[]
}

// IPC Channel Names
export const SubsonicChannels = {
  // Commands
  GET_SONG: 'subsonic:get-song',
  GET_ALBUM: 'subsonic:get-album',
  GET_ARTIST: 'subsonic:get-artist',
  GET_PLAYLISTS: 'subsonic:get-playlists',
  GET_PLAYLIST: 'subsonic:get-playlist',
  CREATE_PLAYLIST: 'subsonic:create-playlist',
  DELETE_PLAYLIST: 'subsonic:delete-playlist',
  UPDATE_PLAYLIST: 'subsonic:update-playlist',
  REPLACE_PLAYLIST_SONGS: 'subsonic:replace-playlist-songs',
  GET_COVER_ART_URL: 'subsonic:get-cover-art-url',
  GET_MOST_PLAYED: 'subsonic:get-most-played',
  GET_RANDOM_ALBUMS: 'subsonic:get-random-albums',
  GET_STARRED: 'subsonic:get-starred',
  STAR: 'subsonic:star',
  UNSTAR: 'subsonic:unstar',
  STREAM: 'subsonic:stream',
  SET_CREDENTIALS: 'subsonic:set-credentials',
  GET_CREDENTIALS_STATUS: 'subsonic:get-credentials-status',
  CLEAR_CREDENTIALS: 'subsonic:clear-credentials',
  GET_STREAM_BASE_URL: 'subsonic:get-stream-base-url',
  GET_SEARCH_RESULTS: 'subsonic:get-search-results',
  PING: 'subsonic:ping',
  SCROBBLE: 'subsonic:scrobble',
  REPORT_PLAYBACK: 'subsonic:report-playback',

  // Events
  CREDENTIALS_CHANGED: 'subsonic:credentials-changed'
} as const

// Type for IPC channel names
export type SubsonicChannel = (typeof SubsonicChannels)[keyof typeof SubsonicChannels]

// Service interface (for main process)
export interface ISubsonicService {
  // Credentials management
  username: string | null
  setCredentials(username: string, password: string, serverUrl: string): Promise<SubsonicCommandResult>
  clearCredentials(): Promise<SubsonicCommandResult>
  onCredentialsChanged(callback: (status: { configured: boolean; username?: string }) => void): () => void
  hasCredentials(): boolean
  getCredentialsStatus(): Promise<{ configured: boolean; username?: string }>
  ping(): Promise<SubsonicCommandResult>

  // Song metadata and streaming
  getSong(songId: string): Promise<SubsonicCommandResult>
  getAlbum(albumId: string): Promise<SubsonicCommandResult>
  getArtist(artistId: string): Promise<SubsonicCommandResult>
  getPlaylists(): Promise<SubsonicCommandResult>
  getPlaylist(playlistId: string): Promise<SubsonicCommandResult>
  createPlaylist(name: string, songIds: string[]): Promise<SubsonicCommandResult>
  deletePlaylist(playlistId: string): Promise<SubsonicCommandResult>
  getNewlyAddedAlbums(options?: { size: string; offset: string }): Promise<SubsonicCommandResult>
  updatePlaylist(
    playlistId: string,
    name?: string,
    comment?: string
  ): Promise<SubsonicCommandResult>
  replacePlaylistSongs(playlistId: string, songIds: string[]): Promise<SubsonicCommandResult>
  getCoverArtUrl(id: string, size?: number): string | null
  getMostPlayed(options?: { offset: string; size: string }): Promise<SubsonicCommandResult>
  getRandomAlbums(options?: { size: string }): Promise<SubsonicCommandResult>
  search(options: SubsonicSearchCommand): Promise<SubsonicCommandResult>
  getStarred(): Promise<SubsonicCommandResult>
  scrobble(songId: string, submission: boolean): Promise<SubsonicCommandResult>
  getGenres(): Promise<SubsonicCommandResult>
  getSimilarSongs2(id: string, count?: number): Promise<SubsonicSong[]>
  getSongsByGenre(genre: string, count?: number): Promise<SubsonicSong[]>
  getTopSongs(artist: string, count?: number): Promise<SubsonicSong[]>
  getRandomSongs(count?: number): Promise<SubsonicSong[]>
  reportPlayback(
    songId: string,
    position: number,
    state: 'starting' | 'playing' | 'paused' | 'stopped'
  ): Promise<SubsonicCommandResult>
  star(options: {
    id?: string
    artistId?: string
    albumId?: string
  }): Promise<SubsonicCommandResult>
  unstar(options: {
    id?: string
    artistId?: string
    albumId?: string
  }): Promise<SubsonicCommandResult>

  // Utility methods
  generateStreamUrl(songId: string): string | null
  validateServerUrl(serverUrl: string): boolean
}

// Preload API interface (exposed to renderer)
export interface SubsonicAPI {
  // Credentials management
  setCredentials(
    username: string,
    password: string,
    serverUrl: string
  ): Promise<SubsonicCommandResult>
  clearCredentials(): Promise<SubsonicCommandResult>
  getCredentialsStatus(): Promise<{ configured: boolean; username?: string }>
  ping(): Promise<SubsonicCommandResult>

  // Song metadata and streaming
  getSong(songId: string): Promise<SubsonicCommandResult>
  getAlbum(albumId: string): Promise<SubsonicCommandResult>
  getArtist(artistId: string): Promise<SubsonicCommandResult>
  getPlaylists(): Promise<SubsonicCommandResult>
  getPlaylist(playlistId: string): Promise<SubsonicCommandResult>
  createPlaylist(name: string, songIds: string[]): Promise<SubsonicCommandResult>
  deletePlaylist(playlistId: string): Promise<SubsonicCommandResult>
  updatePlaylist(
    playlistId: string,
    name?: string,
    comment?: string
  ): Promise<SubsonicCommandResult>
  replacePlaylistSongs(playlistId: string, songIds: string[]): Promise<SubsonicCommandResult>
  getCoverArtUrl(id: string): Promise<string | null>
  getMostPlayed(options?: { offset: string; size: string }): Promise<SubsonicCommandResult>
  getRandomAlbums(options?: { size: string }): Promise<SubsonicCommandResult>
  search(options: SubsonicSearchCommand): Promise<SubsonicCommandResult>
  getStarred(): Promise<SubsonicCommandResult>
  scrobble(songId: string, submission: boolean): Promise<SubsonicCommandResult>
  getGenres(): Promise<SubsonicCommandResult>
  star(options: {
    id?: string
    artistId?: string
    albumId?: string
  }): Promise<SubsonicCommandResult>
  unstar(options: {
    id?: string
    artistId?: string
    albumId?: string
  }): Promise<SubsonicCommandResult>
  stream(songId: string): Promise<SubsonicCommandResult>
  generateStreamUrl(songId: string): Promise<string | null>
  reportPlayback(
    songId: string,
    position: number,
    state: 'starting' | 'playing' | 'paused' | 'stopped'
  ): Promise<SubsonicCommandResult>

  // Event listeners
  onCredentialsChanged(
    callback: (status: { configured: boolean; username?: string }) => void
  ): () => void
}

// Error types
export class SubsonicError extends Error {
  constructor(
    message: string,
    public code:
      | 'NO_CREDENTIALS'
      | 'INVALID_URL'
      | 'API_ERROR'
      | 'INVALID_SONG_ID'
      | 'INVALID_ALBUM_ID'
      | 'INVALID_ARTIST_ID'
      | 'INVALID_MESSAGE'
      | 'PLAYBACK_FAILED'
      | 'STORAGE_ERROR'
      | 'UNKNOWN'
  ) {
    super(message)
    this.name = 'SubsonicError'
  }
}

// Configuration
export interface SubsonicConfig {
  clientName: string
  apiVersion: string
  saltLength: number
}

export const DEFAULT_SUBSONIC_CONFIG: SubsonicConfig = {
  clientName: 'Sway Desktop',
  apiVersion: '1.12.0',
  saltLength: 16
}
