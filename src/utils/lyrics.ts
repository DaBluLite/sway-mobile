export interface LyricsLine {
  time: number // in seconds
  text: string
}

export interface LyricsResult {
  lyrics: string | null
  syncedLyrics: LyricsLine[] | null
  source: string | null
  error?: string
}

export interface AlbumArtResult {
  imageUrl: string | null
  album: string | null
  artist: string | null
  source: string | null
  error?: string
}

export interface TrackInfo {
  artist: string
  title: string
}

/**
 * Parse song title from ICY metadata
 * Common formats: "Artist - Title", "Title by Artist", "Title"
 */
export function parseTrackInfo(streamTitle: string): TrackInfo | null {
  if (!streamTitle) return null

  // Clean up the stream title
  const cleaned = streamTitle.trim()

  // Try "Artist - Title" format (most common)
  const dashMatch = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/)
  if (dashMatch) {
    return { artist: dashMatch[1].trim(), title: dashMatch[2].trim() }
  }

  // Try "Title by Artist" format
  const byMatch = cleaned.match(/^(.+?)\s+by\s+(.+)$/i)
  if (byMatch) {
    return { artist: byMatch[2].trim(), title: byMatch[1].trim() }
  }

  // Try "Artist: Title" format
  const colonMatch = cleaned.match(/^(.+?):\s*(.+)$/)
  if (colonMatch) {
    return { artist: colonMatch[1].trim(), title: colonMatch[2].trim() }
  }

  return null
}

/**
 * Parse LRC format lyrics into timed lines
 */
export function parseLRC(lrc: string): LyricsLine[] {
  if (!lrc) return []
  const lines = lrc.split('\n')
  const result: LyricsLine[] = []
  // Robust regex for [mm:ss.xx] or [mm:ss] or [m:ss] etc.
  // Supports multiple time tags per line: [00:01.00][00:10.00]Lyrics
  const timeRegex = /\[(\d+):(\d+(?:\.\d+)?)\]/g

  for (const line of lines) {
    const timeTags = line.match(timeRegex)
    if (timeTags) {
      const text = line.replace(timeRegex, '').trim()
      // Allow empty text for silence/breaks
      for (const tag of timeTags) {
        const match = tag.match(/\[(\d+):(\d+(?:\.\d+)?)\]/)
        if (match) {
          const minutes = parseInt(match[1], 10)
          const seconds = parseFloat(match[2])
          const time = minutes * 60 + seconds
          result.push({ time, text: text || '...' }) // Use ... for silence
        }
      }
    }
  }

  return result.sort((a, b) => a.time - b.time)
}

/**
 * Fetch lyrics from LRCLIB (supports synced lyrics)
 */
export async function fetchLyricsLRCLIB(artist: string, title: string): Promise<LyricsResult> {
  try {
    // Clean up artist and title for better matching
    const cleanArtist = artist.replace(/\s*\(.*?\)\s*/g, '').trim()
    const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').trim()

    const response = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`,
      {
        headers: {
          "User-Agent": "SwayMusic/1.0.0 (https://git.dablulite.dev/swaymusic)"
        }
      }
    )

    if (!response.ok) {
      // Try again with full names if cleanup didn't work (LRCLIB can be picky sometimes)
      const responseFull = await fetch(
        `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
        {
          headers: {
            "User-Agent": "SwayMusic/1.0.0 (https://git.dablulite.dev/swaymusic)"
          }
        }
      )
      if (!responseFull.ok) {
        return { lyrics: null, syncedLyrics: null, source: null, error: 'Not found' }
      }
      // Use the full name response if successful
      const data = await responseFull.json()
      return processLRCLIBData(data)
    }

    const data = await response.json()
    return processLRCLIBData(data)
  } catch (error) {
    console.error('LRCLIB fetch error:', error)
    return { lyrics: null, syncedLyrics: null, source: null, error: 'Fetch failed' }
  }
}

function processLRCLIBData(data: any): LyricsResult {
  if (data.instrumental) {
    return {
      lyrics: '[Instrumental]',
      syncedLyrics: null,
      source: 'LRCLIB'
    }
  }

  if (data.syncedLyrics) {
    const parsed = parseLRC(data.syncedLyrics)
    if (parsed.length > 0) {
      return {
        lyrics: data.plainLyrics || null,
        syncedLyrics: parsed,
        source: 'LRCLIB (synced)'
      }
    }
  }

  return {
    lyrics: data.plainLyrics || null,
    syncedLyrics: null,
    source: 'LRCLIB'
  }
}
/**
 * Fetch lyrics from lyrics.ovh API (free, no API key required)
 */
export async function fetchLyrics(artist: string, title: string): Promise<LyricsResult> {
  try {
    // Try LRCLIB first for better metadata and synced lyrics
    const lrclibResult = await fetchLyricsLRCLIB(artist, title)
    if (lrclibResult.lyrics || lrclibResult.syncedLyrics) {
      return lrclibResult
    }

    // Clean up artist and title for better matching with lyrics.ovh
    const cleanArtist = artist.replace(/\s*\(.*?\)\s*/g, '').trim()
    const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').trim()

    const response = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`
    )

    if (!response.ok) {
      if (response.status === 404) {
        return { lyrics: null, syncedLyrics: null, source: null, error: 'Lyrics not found' }
      }
      return { lyrics: null, syncedLyrics: null, source: null, error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    return {
      lyrics: data.lyrics || null,
      syncedLyrics: null,
      source: 'lyrics.ovh'
    }
  } catch (error) {
    console.error('Failed to fetch lyrics:', error)
    return { lyrics: null, syncedLyrics: null, source: null, error: 'Failed to fetch lyrics' }
  }
}

/**
 * Fetch album art from iTunes Search API (free, no API key required)
 */
export async function fetchAlbumArt(artist: string, title: string): Promise<AlbumArtResult> {
  try {
    // Clean up artist and title for better matching
    const cleanArtist = artist.replace(/\s*\(.*?\)\s*/g, '').trim()
    const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').trim()

    const query = `${cleanArtist} ${cleanTitle}`
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`
    )

    if (!response.ok) {
      return { imageUrl: null, album: null, artist: null, source: null }
    }

    const data = await response.json()

    if (data.resultCount > 0) {
      // Try to find the best match
      let bestResult = data.results[0]

      // Look for a result that matches the artist name more closely
      for (const result of data.results) {
        if (result.artistName.toLowerCase().includes(cleanArtist.toLowerCase())) {
          bestResult = result
          break
        }
      }

      // Get higher resolution artwork (replace 100x100 with 600x600)
      const artworkUrl = bestResult.artworkUrl100?.replace('100x100', '600x600')

      return {
        imageUrl: artworkUrl || null,
        album: bestResult.collectionName || null,
        artist: bestResult.artistName || null,
        source: 'iTunes'
      }
    }

    return { imageUrl: null, album: null, artist: null, source: null }
  } catch (error) {
    console.error('Failed to fetch album art:', error)
    return {
      imageUrl: null,
      album: null,
      artist: null,
      source: null,
      error: 'Failed to fetch album art'
    }
  }
}

/**
 * Alternative: Fetch album art from Deezer API (free, no API key required)
 */
export async function fetchAlbumArtDeezer(artist: string, title: string): Promise<AlbumArtResult> {
  try {
    const query = `${artist} ${title}`
    const response = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`
    )

    if (!response.ok) {
      return { imageUrl: null, album: null, artist: null, source: null }
    }

    const data = await response.json()

    if (data.data && data.data.length > 0) {
      const result = data.data[0]
      return {
        imageUrl: result.album?.cover_xl || result.album?.cover_big || null,
        album: result.album?.title || null,
        artist: result.artist?.name || null,
        source: 'Deezer'
      }
    }

    return { imageUrl: null, album: null, artist: null, source: null }
  } catch (error) {
    console.error('Failed to fetch album art from Deezer:', error)
    return {
      imageUrl: null,
      album: null,
      artist: null,
      source: null,
      error: 'Failed to fetch album art'
    }
  }
}

/**
 * Fetch both lyrics and album art with fallbacks
 */
export async function fetchTrackData(
  streamTitle: string,
  providedArtist?: string,
  providedTitle?: string
): Promise<{
  track: TrackInfo | null
  lyrics: LyricsResult
  albumArt: AlbumArtResult
}> {
  let track: TrackInfo | null = null

  if (providedArtist && providedTitle) {
    track = { artist: providedArtist, title: providedTitle }
  } else {
    track = parseTrackInfo(streamTitle)
  }

  if (!track) {
    return {
      track: null,
      lyrics: { lyrics: null, syncedLyrics: null, source: null },
      albumArt: { imageUrl: null, album: null, artist: null, source: null }
    }
  }

  // Fetch lyrics and album art in parallel
  const [lyricsResult, albumArtResult] = await Promise.all([
    fetchLyrics(track.artist, track.title),
    fetchAlbumArt(track.artist, track.title)
  ])

  // If iTunes didn't find album art, try Deezer as fallback
  let finalAlbumArt = albumArtResult
  if (!albumArtResult.imageUrl) {
    const deezerArt = await fetchAlbumArtDeezer(track.artist, track.title)
    if (deezerArt.imageUrl) {
      finalAlbumArt = deezerArt
    }
  }

  return { track, lyrics: lyricsResult, albumArt: finalAlbumArt }
}

// Cache for track data to avoid repeated API calls
const trackCache = new Map<
  string,
  {
    track: TrackInfo | null
    lyrics: LyricsResult
    albumArt: AlbumArtResult
    timestamp: number
  }
>()

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch track data with caching
 */
export async function fetchTrackDataCached(
  streamTitle: string,
  artist?: string,
  title?: string
): Promise<{
  track: TrackInfo | null
  lyrics: LyricsResult
  albumArt: AlbumArtResult
}> {
  const cacheKey = artist && title ? `manual-${artist}-${title}` : streamTitle
  const cached = trackCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return {
      track: cached.track,
      lyrics: cached.lyrics,
      albumArt: cached.albumArt
    }
  }

  const result = await fetchTrackData(streamTitle, artist, title)

  trackCache.set(cacheKey, {
    ...result,
    timestamp: Date.now()
  })

  // Clean up old cache entries
  if (trackCache.size > 50) {
    const now = Date.now()
    for (const [key, value] of trackCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        trackCache.delete(key)
      }
    }
  }

  return result
}
