import { ISubsonicService, SubsonicAlbum, SubsonicArtist, SubsonicSong } from '../types/subsonic'
import {
  CandidateMatch,
  MatchStatus,
  TransferGroup,
  TransferItem,
  TransferKind,
  TransferProgress,
  TransferResult,
} from '../types/transfer'
import {
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyLibrary,
  SpotifyTrack,
} from '../types/spotify'
import { fetchFullLibrary } from './spotify-service'
import {
  classifyMatch,
  getCachedMapping,
  scoreAlbumCandidates,
  scoreArtistCandidates,
  scoreTrackCandidates,
  setCachedMapping,
} from './matching-engine'
import subsonicService from '../utils/subsonic'

export interface MatchedTrack {
  key: string
  sourceId: string
  name: string
  artist: string
  status: MatchStatus
  targetId: string | null
  candidates: CandidateMatch[]
}

function trackKey(id: string, kind: TransferKind): string {
  return `${kind}:${id}`
}

async function searchCandidates(
  subsonic: ISubsonicService,
  query: string,
  kind: CandidateMatch['kind'],
): Promise<CandidateMatch[]> {
  const result = await subsonic.search({ query, size: 10 })
  if (!result.success) return []
  const data = result.data as {
    song?: SubsonicSong[]
    album?: SubsonicAlbum[]
    artist?: SubsonicArtist[]
  }

  const candidates: CandidateMatch[] = []
  const songs = (data.song ?? []).map(
    (s): CandidateMatch => ({
      id: s.id,
      name: s.title,
      artist: s.displayArtist || s.artist || '',
      score: 0,
      kind: 'song',
      durationSec: s.duration,
    }),
  )
  const albums = (data.album ?? []).map(
    (a): CandidateMatch => ({
      id: a.id,
      name: a.name,
      artist: a.displayArtist || a.artist || '',
      score: 0,
      kind: 'album',
    }),
  )
  const artists = (data.artist ?? []).map(
    (a): CandidateMatch => ({ id: a.id, name: a.name, artist: '', score: 0, kind: 'artist' }),
  )

  const preferred: Record<CandidateMatch['kind'], CandidateMatch[]> = {
    song: songs,
    album: albums,
    artist: artists,
  }
  candidates.push(...preferred[kind])
  ;(['song', 'album', 'artist'] as const)
    .filter(other => other !== kind)
    .forEach(other => candidates.push(...preferred[other].slice(0, 3)))

  return candidates
}

async function matchTrack(
  subsonic: ISubsonicService,
  source: SpotifyTrack,
): Promise<MatchedTrack> {
  const key = trackKey(source.id, 'track')
  const cached = getCachedMapping('track', source.id)
  if (cached) {
    return {
      key,
      sourceId: source.id,
      name: source.name,
      artist: source.artists.join(', '),
      status: cached.status,
      targetId: cached.subsonicId,
      candidates: [],
    }
  }

  const artist = source.artists[0] ?? ''
  const candidates = await searchCandidates(subsonic, `${artist} ${source.name}`, 'song')
  const scored = scoreTrackCandidates(
    { title: source.name, artist: source.artists.join(', '), durationMs: source.durationMs },
    candidates,
  )
  const { status, best } = classifyMatch(scored)
  setCachedMapping('track', source.id, {
    subsonicId: best?.id ?? null,
    name: source.name,
    status,
  })

  return {
    key,
    sourceId: source.id,
    name: source.name,
    artist: source.artists.join(', '),
    status,
    targetId: best?.id ?? null,
    candidates: scored.slice(0, 5),
  }
}

function derivePlaylistStatus(tracks: MatchedTrack[]): MatchStatus {
  const matched = tracks.filter(t => t.status === 'matched').length
  if (tracks.length === 0) return 'unmatched'
  if (matched === tracks.length) return 'matched'
  const anyMatch = tracks.some(t => t.status !== 'unmatched')
  return anyMatch ? 'needs-review' : 'unmatched'
}

async function buildPlaylistItem(
  subsonic: ISubsonicService,
  playlist: { id: string; name: string; trackCount: number; tracks: SpotifyTrack[] },
  report: () => void,
): Promise<TransferItem> {
  const tracks: MatchedTrack[] = []
  for (const track of playlist.tracks) {
    tracks.push(await matchTrack(subsonic, track))
    report()
  }
  const status = derivePlaylistStatus(tracks)
  return {
    key: trackKey(playlist.id, 'playlist'),
    kind: 'playlist',
    sourceId: playlist.id,
    name: playlist.name,
    subtitle: `${tracks.filter(t => t.status !== 'unmatched').length}/${tracks.length} tracks matched`,
    status,
    selected: status !== 'unmatched',
    targetId: null,
    candidates: [],
    payload: { tracks },
  }
}

async function buildTrackItem(
  subsonic: ISubsonicService,
  source: SpotifyTrack,
  report: () => void,
): Promise<TransferItem> {
  const matched = await matchTrack(subsonic, source)
  report()
  return {
    key: matched.key,
    kind: 'track',
    sourceId: source.id,
    name: source.name,
    subtitle: source.artists.join(', '),
    status: matched.status,
    selected: matched.status !== 'unmatched',
    targetId: matched.targetId,
    candidates: matched.candidates,
    payload: {},
  }
}

async function buildAlbumItem(
  subsonic: ISubsonicService,
  source: SpotifyAlbum,
  report: () => void,
): Promise<TransferItem> {
  const key = trackKey(source.id, 'album')
  const cached = getCachedMapping('album', source.id)
  if (cached) {
    report()
    return {
      key,
      kind: 'album',
      sourceId: source.id,
      name: source.name,
      subtitle: source.artists.join(', '),
      status: cached.status,
      selected: cached.status !== 'unmatched',
      targetId: cached.subsonicId,
      candidates: [],
      payload: {},
    }
  }

  const artist = source.artists[0] ?? ''
  const candidates = await searchCandidates(subsonic, `${artist} ${source.name}`, 'album')
  const scored = scoreAlbumCandidates({ name: source.name, artist: source.artists.join(', ') }, candidates)
  const { status, best } = classifyMatch(scored)
  setCachedMapping('album', source.id, { subsonicId: best?.id ?? null, name: source.name, status })
  report()

  return {
    key,
    kind: 'album',
    sourceId: source.id,
    name: source.name,
    subtitle: source.artists.join(', '),
    status,
    selected: status !== 'unmatched',
    targetId: best?.id ?? null,
    candidates: scored.slice(0, 5),
    payload: {},
  }
}

async function buildArtistItem(
  subsonic: ISubsonicService,
  source: SpotifyArtist,
  report: () => void,
): Promise<TransferItem> {
  const key = trackKey(source.id, 'artist')
  const cached = getCachedMapping('artist', source.id)
  if (cached) {
    report()
    return {
      key,
      kind: 'artist',
      sourceId: source.id,
      name: source.name,
      subtitle: source.genres.slice(0, 3).join(', '),
      status: cached.status,
      selected: cached.status !== 'unmatched',
      targetId: cached.subsonicId,
      candidates: [],
      payload: {},
    }
  }

  const candidates = await searchCandidates(subsonic, source.name, 'artist')
  const scored = scoreArtistCandidates({ name: source.name }, candidates)
  const { status, best } = classifyMatch(scored)
  setCachedMapping('artist', source.id, { subsonicId: best?.id ?? null, name: source.name, status })
  report()

  return {
    key,
    kind: 'artist',
    sourceId: source.id,
    name: source.name,
    subtitle: source.genres.slice(0, 3).join(', '),
    status,
    selected: status !== 'unmatched',
    targetId: best?.id ?? null,
    candidates: scored.slice(0, 5),
    payload: {},
  }
}

function countMatchTotal(library: SpotifyLibrary): number {
  const playlistTracks = library.playlists.reduce((sum, p) => sum + p.tracks.length, 0)
  return (
    playlistTracks +
    library.likedTracks.length +
    library.savedAlbums.length +
    library.followedArtists.length
  )
}

/**
 * Fetches the Spotify library and matches each item against the Subsonic server,
 * producing reviewable groups. Reuses cached mappings for incremental re-syncs.
 */
export async function buildTransferGroups(
  subsonic: ISubsonicService,
  onProgress?: (progress: TransferProgress) => void,
): Promise<TransferGroup[]> {
  const library = await fetchFullLibrary(p => {
    onProgress?.({ stage: 'fetch', current: p.done, total: p.total, currentItem: p.phase })
  })

  const groups: TransferGroup[] = []
  let matchTotal = countMatchTotal(library)
  let matchDone = 0
  const reportMatch = () => {
    matchDone++
    onProgress?.({ stage: 'match', current: matchDone, total: matchTotal })
  }

  // Playlists
  const playlistItems: TransferItem[] = []
  for (const playlist of library.playlists) {
    playlistItems.push(await buildPlaylistItem(subsonic, playlist, reportMatch))
  }
  groups.push({ kind: 'playlist', title: 'Playlists', items: playlistItems })

  // Liked songs
  const trackItems: TransferItem[] = []
  for (const track of library.likedTracks) {
    trackItems.push(await buildTrackItem(subsonic, track, reportMatch))
  }
  groups.push({ kind: 'track', title: 'Liked Songs', items: trackItems })

  // Albums
  const albumItems: TransferItem[] = []
  for (const album of library.savedAlbums) {
    albumItems.push(await buildAlbumItem(subsonic, album, reportMatch))
  }
  groups.push({ kind: 'album', title: 'Albums', items: albumItems })

  // Artists
  const artistItems: TransferItem[] = []
  for (const artist of library.followedArtists) {
    artistItems.push(await buildArtistItem(subsonic, artist, reportMatch))
  }
  groups.push({ kind: 'artist', title: 'Artists', items: artistItems })

  return groups
}

function playlistMatchedTrackIds(item: TransferItem): string[] {
  const tracks = item.payload.tracks as MatchedTrack[] | undefined
  if (!tracks) return []
  return tracks.reduce<string[]>((acc, t) => { if (t.targetId) acc.push(t.targetId); return acc; }, [])
}

/**
 * Transfers the selected items to the Subsonic server: creates/populates
 * playlists and stars liked tracks, albums and artists.
 */
export async function executeTransfer(
  groups: TransferGroup[],
  onProgress?: (progress: TransferProgress) => void,
): Promise<TransferResult> {
  const selected = groups.reduce<typeof groups[0]['items']>((acc, g) => { for (const item of g.items) if (item.selected) acc.push(item); return acc; }, [])
  const total = selected.length
  let current = 0
  let transferred = 0
  let skipped = 0
  const errors: string[] = []

  for (const item of selected) {
    current++
    onProgress?.({ stage: 'transfer', current, total, currentItem: item.name })

    try {
      switch (item.kind) {
        case 'playlist': {
          const trackIds = playlistMatchedTrackIds(item)
          if (trackIds.length === 0) {
            skipped++
            break
          }
          const result = await subsonicService.createPlaylist(item.name, trackIds)
          if (result.success) {
            transferred++
          } else {
            skipped++
            errors.push(`Playlist "${item.name}": ${result.error ?? 'failed'}`)
          }
          break
        }
        case 'track': {
          if (!item.targetId) {
            skipped++
            break
          }
          const result = await subsonicService.star({ id: item.targetId })
          if (result.success) transferred++
          else {
            skipped++
            errors.push(`Track "${item.name}": ${result.error ?? 'failed'}`)
          }
          break
        }
        case 'album': {
          if (!item.targetId) {
            skipped++
            break
          }
          const result = await subsonicService.star({ albumId: item.targetId })
          if (result.success) transferred++
          else {
            skipped++
            errors.push(`Album "${item.name}": ${result.error ?? 'failed'}`)
          }
          break
        }
        case 'artist': {
          if (!item.targetId) {
            skipped++
            break
          }
          const result = await subsonicService.star({ artistId: item.targetId })
          if (result.success) transferred++
          else {
            skipped++
            errors.push(`Artist "${item.name}": ${result.error ?? 'failed'}`)
          }
          break
        }
      }
    } catch (error) {
      skipped++
      errors.push(`${item.name}: ${error instanceof Error ? error.message : 'error'}`)
    }
  }

  return { success: errors.length === 0, transferred, skipped, errors }
}
