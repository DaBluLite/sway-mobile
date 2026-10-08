// Shared types for the Spotify -> Subsonic library transfer feature.

export type MatchStatus = 'matched' | 'needs-review' | 'unmatched'

export type TransferKind = 'playlist' | 'track' | 'album' | 'artist'

export interface CandidateMatch {
  id: string
  name: string
  artist: string
  score: number
  kind: 'song' | 'album' | 'artist'
  durationSec?: number // add this
}

export interface TransferItem {
  key: string
  kind: TransferKind
  sourceId: string
  name: string
  subtitle: string
  status: MatchStatus
  selected: boolean
  targetId: string | null
  candidates: CandidateMatch[]
  payload: Record<string, unknown>
}

export interface TransferGroup {
  kind: TransferKind
  title: string
  items: TransferItem[]
}

export type TransferStage = 'fetch' | 'match' | 'transfer'

export interface TransferProgress {
  stage: TransferStage
  current: number
  total: number
  currentItem?: string
}

export interface TransferResult {
  success: boolean
  transferred: number
  skipped: number
  errors: string[]
}
