import {
  SPOTIFY_CALLBACK_HOST,
  saveSpotifyTokens,
} from '../services/spotify-auth'
import { SpotifyAuthTokens } from '../types/spotify'

function parseQuery(search: string): Record<string, string> {
  const params: Record<string, string> = {}
  const raw = search.replace(/^\?/, '')
  if (!raw) return params
  for (const pair of raw.split('&')) {
    const [key, ...rest] = pair.split('=')
    if (!key) continue
    params[decodeURIComponent(key)] = decodeURIComponent(rest.join('='))
  }
  return params
}

function parseTokensFromUrl(url: string): SpotifyAuthTokens | null {
  const [path, fragmentOrQuery] = url.split('#')
  const queryPart = fragmentOrQuery ?? path.includes('?') ? path.split('?')[1] : ''
  const params = parseQuery(queryPart)

  const accessToken = params['access_token']
  const refreshToken = params['refresh_token']
  const expiresIn = Number(params['expires_in'] || 0)

  if (!accessToken) return null

  return {
    accessToken,
    refreshToken: refreshToken ?? '',
    expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : 0,
    tokenType: params['token_type'] ?? 'Bearer',
    scope: params['scope'] ?? '',
  }
}

/**
 * Handles a deep link pointing at the Spotify transfer callback. Returns true
 * when the URL was a Spotify callback (regardless of whether tokens were
 * present), so callers know whether to resume the transfer flow.
 */
export function handleSpotifyDeepLink(url: string): boolean {
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.host !== SPOTIFY_CALLBACK_HOST) return false

  const tokens = parseTokensFromUrl(url)
  if (tokens) {
    saveSpotifyTokens(tokens)
  }

  return true
}