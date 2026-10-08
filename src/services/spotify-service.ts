import {
  getValidSpotifyToken,
  getSpotifyTokens,
  refreshSpotifyToken,
} from './spotify-auth'
import {
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyFetchProgress,
  SpotifyLibrary,
  SpotifyPlaylist,
  SpotifyPlaylistSummary,
  SpotifyTrack,
} from '../types/spotify'

const API_BASE = 'https://api.spotify.com/v1'
const PAGE_SIZE = 50
const MAX_RETRIES = 3

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'SpotifyApiError'
  }
}

interface PagedResponse<T> {
  items: T[]
  next: string | null
  total: number
  offset?: number
  limit?: number
}

interface TrackItem {
  added_at?: string
  track?: SpotifyRawTrack | null
}

interface SavedAlbumItem {
  added_at?: string
  album?: SpotifyRawAlbum | null
}

interface FollowedArtistsResponse {
  artists: PagedResponse<SpotifyRawArtist>
}

interface SpotifyRawTrack {
  id: string
  name: string
  artists?: { id: string; name: string }[]
  album?: { name: string }
  duration_ms?: number
  track_number?: number
}

interface SpotifyRawAlbum {
  id: string
  name: string
  artists?: { name: string }[]
  release_date?: string
  total_tracks?: number
  images?: { url: string }[]
}

interface SpotifyRawArtist {
  id: string
  name: string
  genres?: string[]
  images?: { url: string }[]
}

interface SpotifyRawPlaylist {
  id: string
  name: string
  description: string
  owner?: { display_name?: string }
  public?: boolean
  tracks?: { total?: number }
  images?: { url: string }[]
}

function mapTrack(raw: SpotifyRawTrack): SpotifyTrack {
  return {
    id: raw.id,
    name: raw.name,
    artists: (raw.artists ?? []).map(a => a.name),
    albumName: raw.album?.name ?? '',
    durationMs: raw.duration_ms ?? 0,
    trackNumber: raw.track_number ?? 0,
  }
}

function mapAlbum(raw: SpotifyRawAlbum): SpotifyAlbum {
  return {
    id: raw.id,
    name: raw.name,
    artists: (raw.artists ?? []).map(a => a.name),
    releaseDate: raw.release_date ?? '',
    totalTracks: raw.total_tracks ?? 0,
    imageUrl: raw.images?.[0]?.url ?? null,
  }
}

function mapArtist(raw: SpotifyRawArtist): SpotifyArtist {
  return {
    id: raw.id,
    name: raw.name,
    genres: raw.genres ?? [],
    imageUrl: raw.images?.[0]?.url ?? null,
  }
}

function mapPlaylist(raw: SpotifyRawPlaylist): SpotifyPlaylistSummary {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    owner: raw.owner?.display_name ?? '',
    public: !!raw.public,
    trackCount: raw.tracks?.total ?? 0,
    imageUrl: raw.images?.[0]?.url ?? null,
  }
}

/**
 * Core authenticated GET helper. Handles expired access tokens by refreshing
 * once, and honors Spotify's rate-limit headers with bounded backoff.
 */
async function spotifyGet(url: string): Promise<Response> {
  let token = await getValidSpotifyToken()
  if (!token) {
    throw new SpotifyApiError('Spotify not authenticated', 401)
  }

  const request = async (accessToken: string): Promise<Response> => {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 401) {
      // Token may have been revoked server-side; try refreshing and retry once.
      const tokens = getSpotifyTokens()
      if (tokens?.refreshToken) {
        try {
          await refreshSpotifyToken(tokens.refreshToken)
        } catch {
          // fall through with the original response
        }
        const fresh = getSpotifyTokens()
        if (fresh?.accessToken) {
          const retried = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${fresh.accessToken}`,
              'Content-Type': 'application/json',
            },
          })
          return retried
        }
      }
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After')) || 1
      await sleep(retryAfter * 1000)
    }

    return response
  }

  let response = await request(token)

  // Bounded retry on rate-limit responses.
  for (let attempt = 0; attempt < MAX_RETRIES && response.status === 429; attempt++) {
    const retryAfter = Number(response.headers.get('Retry-After')) || 1
    await sleep(retryAfter * 1000)
    token = await getValidSpotifyToken()
    response = await request(token ?? '')
  }

  if (!response.ok) {
    throw new SpotifyApiError(
      `Spotify request failed with status ${response.status}`,
      response.status,
    )
  }

  return response
}

async function fetchPaged<T>(
  initialUrl: string,
  extract: (json: unknown) => PagedResponse<T>,
): Promise<T[]> {
  const results: T[] = []
  let url: string | null = initialUrl

  while (url) {
    const response = await spotifyGet(url)
    const json = (await response.json()) as unknown
    const page = extract(json)
    results.push(...(page.items ?? []))
    url = page.next
  }

  return results
}

async function fetchPlaylists(): Promise<SpotifyPlaylistSummary[]> {
  const items = await fetchPaged<SpotifyRawPlaylist>(
    `${API_BASE}/me/playlists?limit=${PAGE_SIZE}&offset=0`,
    json => {
      const body = json as { playlists?: PagedResponse<SpotifyRawPlaylist> }
      return body.playlists ?? { items: [], next: null, total: 0 }
    },
  )
  return items.map(mapPlaylist)
}

async function fetchPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const items = await fetchPaged<TrackItem>(
    `${API_BASE}/playlists/${playlistId}/tracks?limit=${PAGE_SIZE}&offset=0`,
    json => {
      const body = json as PagedResponse<TrackItem>
      return body
    },
  )
  return items
    .map(i => i.track)
    .filter((t): t is SpotifyRawTrack => !!t)
    .map(mapTrack)
}

async function fetchLikedTracks(): Promise<SpotifyTrack[]> {
  const items = await fetchPaged<TrackItem>(
    `${API_BASE}/me/tracks?limit=${PAGE_SIZE}&offset=0`,
    json => {
      const body = json as PagedResponse<TrackItem>
      return body
    },
  )
  return items
    .map(i => i.track)
    .filter((t): t is SpotifyRawTrack => !!t)
    .map(mapTrack)
}

async function fetchSavedAlbums(): Promise<SpotifyAlbum[]> {
  const items = await fetchPaged<SavedAlbumItem>(
    `${API_BASE}/me/albums?limit=${PAGE_SIZE}&offset=0`,
    json => {
      const body = json as PagedResponse<SavedAlbumItem>
      return body
    },
  )
  return items
    .map(i => i.album)
    .filter((a): a is SpotifyRawAlbum => !!a)
    .map(mapAlbum)
}

async function fetchFollowedArtists(): Promise<SpotifyArtist[]> {
  const items = await fetchPaged<SpotifyRawArtist>(
    `${API_BASE}/me/following?type=artist&limit=${PAGE_SIZE}`,
    json => {
      const body = json as FollowedArtistsResponse
      return body.artists ?? { items: [], next: null, total: 0 }
    },
  )
  return items.map(mapArtist)
}

/**
 * Fetches the full Spotify library (playlists with their tracks, liked songs,
 * saved albums and followed artists) with progress reporting.
 */
export async function fetchFullLibrary(
  onProgress?: (progress: SpotifyFetchProgress) => void,
): Promise<SpotifyLibrary> {
  const playlistSummaries = await fetchPlaylists()
  onProgress?.({ phase: 'playlists', total: playlistSummaries.length, done: playlistSummaries.length })

  const playlists: SpotifyPlaylist[] = []
  for (let index = 0; index < playlistSummaries.length; index++) {
    const summary = playlistSummaries[index]
    const tracks = await fetchPlaylistTracks(summary.id)
    playlists.push({ ...summary, tracks })
    onProgress?.({ phase: 'playlist-tracks', total: playlistSummaries.length, done: index + 1 })
  }

  const likedTracks = await fetchLikedTracks()
  onProgress?.({ phase: 'liked-tracks', total: likedTracks.length, done: likedTracks.length })

  const savedAlbums = await fetchSavedAlbums()
  onProgress?.({ phase: 'albums', total: savedAlbums.length, done: savedAlbums.length })

  const followedArtists = await fetchFollowedArtists()
  onProgress?.({ phase: 'artists', total: followedArtists.length, done: followedArtists.length })

  return { playlists, likedTracks, savedAlbums, followedArtists }
}

export { fetchPlaylists, fetchPlaylistTracks, fetchLikedTracks, fetchSavedAlbums, fetchFollowedArtists }