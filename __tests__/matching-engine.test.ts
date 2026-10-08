import {
  normalizeName,
  tokenSetRatio,
  scoreTrackCandidates,
  scoreAlbumCandidates,
  scoreArtistCandidates,
  classifyMatch,
  FUZZY_MATCH_THRESHOLD,
  EXACT_MATCH_THRESHOLD,
} from '../src/services/matching-engine'
import { CandidateMatch } from '../src/types/transfer'

function song(id: string, name: string, artist: string): CandidateMatch {
  return { id, name, artist, score: 0, kind: 'song' }
}

describe('normalizeName', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeName('Café Déjà Vu')).toBe('cafe deja vu')
  })

  it('strips feat., remaster and parenthetical suffixes', () => {
    expect(normalizeName('Song Name (feat. Someone)')).toBe('song name')
    expect(normalizeName('Song (Remastered 2010)')).toBe('song')
    expect(normalizeName('Song - Remastered 2010')).toBe('song')
  })

  it('removes punctuation and collapses whitespace', () => {
    expect(normalizeName('  Hello,   World!! ')).toBe('hello world')
  })
})

describe('tokenSetRatio', () => {
  it('returns 100 for identical token sets', () => {
    expect(tokenSetRatio('hello world', 'world hello')).toBe(100)
  })

  it('returns 0 for disjoint sets', () => {
    expect(tokenSetRatio('aaa bbb', 'ccc ddd')).toBe(0)
  })
})

describe('scoreTrackCandidates', () => {
  const source = { title: 'Hello World', artist: 'Adele' }

  it('ranks exact matches highest', () => {
    const candidates = [
      song('exact', 'Hello World', 'Adele'),
      song('other', 'Some Other Song', 'Adele'),
    ]
    const scored = scoreTrackCandidates(source, candidates)
    expect(scored[0].id).toBe('exact')
    expect(scored[0].score).toBeGreaterThanOrEqual(EXACT_MATCH_THRESHOLD)
  })

  it('treats editorial-suffixed titles as exact matches', () => {
    const candidates = [song('exact', 'Hello World (Radio Edit)', 'Adele')]
    const scored = scoreTrackCandidates(source, candidates)
    const { status, best } = classifyMatch(scored)
    expect(status).toBe('matched')
    expect(best?.id).toBe('exact')
  })

  it('flags exact match as matched via classifyMatch', () => {
    const candidates = [song('exact', 'Hello World', 'Adele')]
    const scored = scoreTrackCandidates(source, candidates)
    const { status, best } = classifyMatch(scored)
    expect(status).toBe('matched')
    expect(best?.id).toBe('exact')
  })

  it('flags partial-token match as needs-review', () => {
    const candidates = [song('fuzzy', 'Whole Lotta', 'Adele')]
    const scored = scoreTrackCandidates({ title: 'Whole Lotta Love', artist: 'Adele' }, candidates)
    const { status } = classifyMatch(scored)
    expect(status).toBe('needs-review')
  })

  it('flags weak match as unmatched', () => {
    const candidates = [song('weak', 'Unrelated Thing', 'Random Artist')]
    const scored = scoreTrackCandidates(source, candidates)
    const { status } = classifyMatch(scored)
    expect(status).toBe('unmatched')
  })

  it('returns unmatched when there are no candidates', () => {
    const { status, best } = classifyMatch([])
    expect(status).toBe('unmatched')
    expect(best).toBeNull()
  })
})

describe('scoreAlbumCandidates', () => {
  it('prefers album-kind candidates', () => {
    const candidates: CandidateMatch[] = [
      { id: 'song', name: '21', artist: 'Adele', score: 0, kind: 'song' },
      { id: 'album', name: '21', artist: 'Adele', score: 0, kind: 'album' },
    ]
    const scored = scoreAlbumCandidates({ name: '21', artist: 'Adele' }, candidates)
    expect(scored[0].id).toBe('album')
  })
})

describe('scoreArtistCandidates', () => {
  it('scores matching artist names highest', () => {
    const candidates: CandidateMatch[] = [
      { id: 'a', name: 'Adele', artist: '', score: 0, kind: 'artist' },
      { id: 'b', name: 'Adele Adkins', artist: '', score: 0, kind: 'artist' },
    ]
    const scored = scoreArtistCandidates({ name: 'Adele' }, candidates)
    expect(scored[0].id).toBe('a')
  })
})

describe('FUZZY_MATCH_THRESHOLD sanity', () => {
  it('thresholds are ordered correctly', () => {
    expect(FUZZY_MATCH_THRESHOLD).toBeLessThan(EXACT_MATCH_THRESHOLD)
  })
})
