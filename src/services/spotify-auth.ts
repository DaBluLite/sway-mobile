import { authorize, refresh } from 'react-native-app-auth'
import { deleteItem, getItem, setItem, STORES } from '../utils/storage'
import { SpotifyAuthTokens } from '../types/spotify'

export const SPOTIFY_CLIENT_ID = '87080a4bbd0741879ec04249ddfe7a9b'
export const SPOTIFY_REDIRECT_URL = 'sway-auth://spotify-transfer-callback'
export const SPOTIFY_CALLBACK_HOST = 'spotify-transfer-callback'
export const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'user-library-read',
  'user-follow-read',
]

const TOKEN_KEY = 'tokens'
// Refresh early to avoid a race between expiry and the next request.
const TOKEN_MARGIN_MS = 60 * 1000

export function getSpotifyAuthConfig() {
  return {
    clientId: SPOTIFY_CLIENT_ID,
    redirectUrl: SPOTIFY_REDIRECT_URL,
    scopes: SPOTIFY_SCOPES,
    serviceConfiguration: {
      authorizationEndpoint: 'https://accounts.spotify.com/authorize',
      tokenEndpoint: 'https://accounts.spotify.com/api/token',
    },
    usePKCE: true,
  }
}

function toTokens(input: {
  accessToken: string
  refreshToken?: string
  accessTokenExpirationDate?: string
  tokenType: string
  scopes?: string[]
}): SpotifyAuthTokens {
  const expiresAt = input.accessTokenExpirationDate
    ? new Date(input.accessTokenExpirationDate).getTime()
    : 0
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? '',
    expiresAt,
    tokenType: input.tokenType,
    scope: input.scopes?.join(' ') ?? '',
  }
}

export function saveSpotifyTokens(tokens: SpotifyAuthTokens): SpotifyAuthTokens {
  setItem(STORES.SPOTIFY_TRANSFER, TOKEN_KEY, tokens)
  return tokens
}

export function getSpotifyTokens(): SpotifyAuthTokens | null {
  return getItem<SpotifyAuthTokens>(STORES.SPOTIFY_TRANSFER, TOKEN_KEY)
}

export function clearSpotifyTokens(): void {
  deleteItem(STORES.SPOTIFY_TRANSFER, TOKEN_KEY)
}

export function hasSpotifyTokens(): boolean {
  const tokens = getSpotifyTokens()
  return !!tokens?.accessToken
}

export function isSpotifyTokenExpired(tokens: SpotifyAuthTokens): boolean {
  if (!tokens.expiresAt) return false
  return tokens.expiresAt - TOKEN_MARGIN_MS <= Date.now()
}

/**
 * Runs the Spotify OAuth flow in an in-app browser. The returned tokens are
 * persisted using the same MMKV-backed storage the rest of the app uses.
 */
export async function authorizeSpotify(): Promise<SpotifyAuthTokens> {
  const result = await authorize(getSpotifyAuthConfig())
  return saveSpotifyTokens(toTokens(result))
}

/**
 * Exchanges a refresh token for a fresh access token and persists the result.
 */
export async function refreshSpotifyToken(
  refreshToken: string,
): Promise<SpotifyAuthTokens> {
  const result = await refresh(getSpotifyAuthConfig(), { refreshToken })
  const tokens = toTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? refreshToken,
    accessTokenExpirationDate: result.accessTokenExpirationDate,
    tokenType: result.tokenType,
    scopes: result.additionalParameters?.scope
      ? result.additionalParameters.scope.split(' ')
      : undefined,
  })
  return saveSpotifyTokens(tokens)
}

/**
 * Returns a usable access token, transparently refreshing if it is missing or
 * expired. Returns null when no session exists or the refresh fails.
 */
export async function getValidSpotifyToken(): Promise<string | null> {
  const tokens = getSpotifyTokens()
  if (!tokens?.accessToken) return null
  if (!tokens.refreshToken || !isSpotifyTokenExpired(tokens)) {
    return tokens.accessToken
  }
  try {
    const fresh = await refreshSpotifyToken(tokens.refreshToken)
    return fresh.accessToken
  } catch (error) {
    console.warn('Failed to refresh Spotify token', error)
    return null
  }
}
