import { getItem, setItem, STORES } from '../utils/storage';
import { CandidateMatch, MatchStatus, TransferKind } from '../types/transfer';

export const EXACT_MATCH_THRESHOLD = 99;
export const FUZZY_MATCH_THRESHOLD = 55;

/**
 * Normalizes a music title/name for comparison: lowercases, strips combining
 * marks and common editorial suffixes (feat., remaster, parentheticals) and
 * punctuation, collapsing runs of whitespace.
 */
export function normalizeName(input: string): string {
  return (input ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s*\(feat\..*?\)/gi, ' ')
    .replace(/\s*\(ft\..*?\)/gi, ' ')
    .replace(
      /\s*-\s*(remaster(ed)?(\s\d{4})?|single( version)?|radio edit|album version|mono( version)?|stereo( version)?|original mix|extended( mix)?|deluxe( edition)?|bonus track version|edit|version)\s*$/i,
      ' ',
    )
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/\s*\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(input: string): string[] {
  return normalizeName(input).split(' ').filter(Boolean);
}

function tokenSet(a: string[], b: string[]): { inter: number; union: number } {
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const token of setA) {
    if (setB.has(token)) inter++;
  }
  const union = new Set([...setA, ...setB]).size;
  return { inter, union };
}

/** Token-set ratio on 0..100 scale. 100 when both strings share every token. */
export function tokenSetRatio(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const { inter, union } = tokenSet(ta, tb);
  return (inter / union) * 100;
}

function artistScore(sourceArtist: string, candidateArtist: string): number {
  if (!sourceArtist) return 100;
  if (!candidateArtist) return 0;
  if (normalizeName(sourceArtist) === normalizeName(candidateArtist))
    return 100;
  return tokenSetRatio(sourceArtist, candidateArtist);
}

function durationScore(
  sourceMs?: number,
  candidateSec?: number,
): number | null {
  if (sourceMs == null || candidateSec == null) return null;
  const diffSec = Math.abs(sourceMs / 1000 - candidateSec);
  if (diffSec <= 2) return 100;
  if (diffSec <= 5) return 80;
  if (diffSec <= 15) return 40;
  return 0;
}

/**
 * Scores a list of candidate matches for a track (title + artist). Returns
 * candidates ordered by descending combined score, where artist identity is
 * weighted more heavily than title match.
 */
export function scoreTrackCandidates(
  source: { title: string; artist: string; durationMs?: number },
  candidates: CandidateMatch[],
): CandidateMatch[] {
  return candidates
    .map(candidate => {
      const titleRatio = tokenSetRatio(source.title, candidate.name);
      const artistRatio = artistScore(source.artist, candidate.artist);
      const durRatio = durationScore(source.durationMs, candidate.durationSec);

      const combined =
        durRatio === null
          ? titleRatio * 0.5 + artistRatio * 0.5
          : titleRatio * 0.35 + artistRatio * 0.35 + durRatio * 0.3;

      const score = candidate.kind === 'song' ? combined : combined * 0.9;
      return { ...candidate, score: Math.round(score * 100) / 100 };
    })
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Scores album candidates by album name + artist. */
export function scoreAlbumCandidates(
  source: { name: string; artist: string },
  candidates: CandidateMatch[],
): CandidateMatch[] {
  return candidates
    .map(candidate => {
      const nameRatio = tokenSetRatio(source.name, candidate.name);
      const artistRatio = artistScore(source.artist, candidate.artist);
      const combined = nameRatio * 0.5 + artistRatio * 0.5;
      const score = candidate.kind === 'album' ? combined : combined * 0.9;
      return { ...candidate, score: Math.round(score * 100) / 100 };
    })
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Scores artist candidates by name. */
export function scoreArtistCandidates(
  source: { name: string },
  candidates: CandidateMatch[],
): CandidateMatch[] {
  return candidates
    .map(candidate => {
      const score =
        candidate.kind === 'artist'
          ? tokenSetRatio(source.name, candidate.name)
          : tokenSetRatio(source.name, candidate.name) * 0.8;
      return { ...candidate, score: Math.round(score * 100) / 100 };
    })
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Picks the best candidate and derives the match status.
 * - No candidates -> unmatched
 * - More than one "good" candidate (score >= FUZZY) -> needs-review so the
 *   user can disambiguate before any automatic selection. The full sorted
 *   candidate list is surfaced first, manual search is secondary.
 * - Single exact (>=99) -> matched
 * - Single fuzzy (>=55) -> needs-review
 * - Otherwise -> unmatched (no good match, but still searchable)
 */
export function classifyMatch(scored: CandidateMatch[]): {
  status: MatchStatus;
  best: CandidateMatch | null;
} {
  const best = scored[0] ?? null;
  if (!best) return { status: 'unmatched', best: null };
  const goodCount = scored.filter(c => c.score >= FUZZY_MATCH_THRESHOLD).length;
  if (goodCount >= 2) return { status: 'needs-review', best };
  if (best.score >= EXACT_MATCH_THRESHOLD) return { status: 'matched', best };
  if (best.score >= FUZZY_MATCH_THRESHOLD)
    return { status: 'needs-review', best };
  return { status: 'unmatched', best: null };
}

interface CachedMapping {
  subsonicId: string | null;
  name: string;
  status: MatchStatus;
}

function cacheKey(kind: TransferKind, sourceId: string): string {
  return `map:${kind}:${sourceId}`;
}

/** Returns the cached Spotify -> Subsonic mapping, if any. */
export function getCachedMapping(
  kind: TransferKind,
  sourceId: string,
): CachedMapping | null {
  return getItem<CachedMapping>(
    STORES.SPOTIFY_TRANSFER,
    cacheKey(kind, sourceId),
  );
}

/** Persists a Spotify -> Subsonic mapping so re-syncs are incremental. */
export function setCachedMapping(
  kind: TransferKind,
  sourceId: string,
  mapping: CachedMapping,
): void {
  setItem(STORES.SPOTIFY_TRANSFER, cacheKey(kind, sourceId), mapping);
}
