import { SubsonicSong } from '../types/subsonic';
import subsonicService from './subsonic';

/**
 * OpenSubsonic Autoplay Algorithm
 * -----------------------------------------------------------------------
 * Generates "up next" recommendations by seeding similarity lookups from
 * the ENTIRE current queue (played + upcoming), not just the last N songs.
 *
 * Core idea:
 *   1. Every song in the queue gets a weight based on recency, position,
 *      and (optionally) whether it was skipped or played to completion.
 *   2. We don't hammer the server with one getSimilarSongs2 call per
 *      queue item if the queue is huge — we take a *weighted, stratified*
 *      sample of seeds so long queues still get broad coverage without
 *      blowing up request count.
 *   3. Each seed's similar-songs results are merged into a single scored
 *      candidate pool (rank-decayed contribution * seed weight).
 *   4. Candidates already in the queue/history are removed.
 *   5. An artist-diversity cap prevents one artist from dominating the
 *      autoplay results even if it dominated the queue.
 *   6. If the pool is too small (sparse library / niche genre), we fall
 *      back to genre-based and artist-top-songs queries.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoplayQueueItem {
  song: SubsonicSong;
  /** true = already played, false = still upcoming */
  played: boolean;
  /** user skipped it early rather than letting it finish */
  skipped?: boolean;
}

export interface AutoplayClient {
  getSimilarSongs2(id: string, count: number): Promise<SubsonicSong[]>;
  getSongsByGenre(genre: string, count: number): Promise<SubsonicSong[]>;
  getTopSongs(artist: string, count: number): Promise<SubsonicSong[]>;
  getRandomSongs(count: number): Promise<SubsonicSong[]>;
}

export interface AutoplayOptions {
  /** how many tracks to generate */
  count: number;
  /** cap on how many queue items are used as similarity seeds */
  maxSeeds: number;
  /** max getSimilarSongs2 calls in flight at once */
  concurrency: number;
  /** how many similar songs to request per seed */
  similarPerSeed: number;
  /** max tracks by the same artist allowed in the output */
  maxPerArtist: number;
  /** weight multiplier applied to skipped songs (usually < 1) */
  skipPenalty: number;
}

const DEFAULT_OPTIONS: AutoplayOptions = {
  count: 10,
  maxSeeds: 40,
  concurrency: 5,
  similarPerSeed: 15,
  maxPerArtist: 2,
  skipPenalty: 0.35,
};

const genreOf = (song: SubsonicSong): string | undefined => song.genres?.[0];
const artistKeyOf = (song: SubsonicSong): string => song.artistId ?? song.artist;

// ---------------------------------------------------------------------------
// 1. Seed weighting
// ---------------------------------------------------------------------------

interface WeightedSeed {
  song: SubsonicSong;
  weight: number;
}

function weighQueue(
  queue: AutoplayQueueItem[],
  opts: AutoplayOptions,
): WeightedSeed[] {
  const n = queue.length;
  if (n === 0) return [];

  return queue.map((item, idx) => {
    const positionWeight = 0.4 + 0.6 * (idx / Math.max(1, n - 1));
    const stateWeight = item.played ? 0.8 : 1.0;
    const skipWeight = item.skipped ? opts.skipPenalty : 1.0;

    return {
      song: item.song,
      weight: positionWeight * stateWeight * skipWeight,
    };
  });
}

function selectSeeds(
  weighted: WeightedSeed[],
  maxSeeds: number,
): WeightedSeed[] {
  if (weighted.length <= maxSeeds) return weighted;

  const byArtist = new Map<string, WeightedSeed[]>();
  for (const w of weighted) {
    const key = artistKeyOf(w.song);
    if (!byArtist.has(key)) byArtist.set(key, []);
    byArtist.get(key)!.push(w);
  }

  for (const arr of byArtist.values()) arr.sort((a, b) => b.weight - a.weight);
  const artistKeys = [...byArtist.keys()];

  const selected: WeightedSeed[] = [];
  let round = 0;
  while (selected.length < maxSeeds) {
    let addedThisRound = false;
    for (const key of artistKeys) {
      const bucket = byArtist.get(key)!;
      if (round < bucket.length) {
        selected.push(bucket[round]);
        addedThisRound = true;
        if (selected.length >= maxSeeds) break;
      }
    }
    if (!addedThisRound) break;
    round++;
  }

  return selected;
}

// ---------------------------------------------------------------------------
// 2. Fetch + score candidates
// ---------------------------------------------------------------------------

interface ScoredCandidate {
  song: SubsonicSong;
  score: number;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function buildCandidatePool(
  seeds: WeightedSeed[],
  opts: AutoplayOptions,
): Promise<Map<string, ScoredCandidate>> {
  const pool = new Map<string, ScoredCandidate>();

  const results = await mapWithConcurrency(
    seeds,
    opts.concurrency,
    async seed => {
      try {
        const similar = await subsonicService.getSimilarSongs2(
          seed.song.id,
          opts.similarPerSeed,
        );
        return { seed, similar };
      } catch {
        return { seed, similar: [] as SubsonicSong[] };
      }
    },
  );

  for (const { seed, similar } of results) {
    similar.forEach((song, rank) => {
      const rankWeight = 1 / (1 + rank * 0.25);
      const contribution = seed.weight * rankWeight;

      const existing = pool.get(song.id);
      if (existing) {
        existing.score += contribution;
      } else {
        pool.set(song.id, { song, score: contribution });
      }
    });
  }

  return pool;
}

// ---------------------------------------------------------------------------
// 3. Filter, diversify, rank
// ---------------------------------------------------------------------------

function removeAlreadyQueued(
  pool: Map<string, ScoredCandidate>,
  queue: AutoplayQueueItem[],
): ScoredCandidate[] {
  const excluded = new Set(queue.map(q => q.song.id));
  return [...pool.values()].filter(c => !excluded.has(c.song.id));
}

function diversifyByArtist(
  candidates: ScoredCandidate[],
  maxPerArtist: number,
): ScoredCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const perArtistCount = new Map<string, number>();
  const output: ScoredCandidate[] = [];

  for (const c of sorted) {
    const key = artistKeyOf(c.song);
    const used = perArtistCount.get(key) ?? 0;
    if (used >= maxPerArtist) continue;
    perArtistCount.set(key, used + 1);
    output.push(c);
  }

  return output;
}

// ---------------------------------------------------------------------------
// 4. Fallback when the similarity pool is too thin
// ---------------------------------------------------------------------------

async function fillWithFallback(
  current: SubsonicSong[],
  needed: number,
  queue: AutoplayQueueItem[],
): Promise<SubsonicSong[]> {
  if (needed <= 0) return [];

  const alreadyChosen = new Set(current.map(s => s.id));
  const excluded = new Set([...alreadyChosen, ...queue.map(q => q.song.id)]);
  const filler: SubsonicSong[] = [];

  const genreCounts = new Map<string, number>();
  for (const q of queue) {
    const genre = genreOf(q.song);
    if (genre) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
  }
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g);

  for (const genre of topGenres) {
    if (filler.length >= needed) break;
    try {
      const songs = await subsonicService.getSongsByGenre(genre, needed * 2);
      for (const s of songs) {
        if (filler.length >= needed) break;
        if (!excluded.has(s.id)) {
          filler.push(s);
          excluded.add(s.id);
        }
      }
    } catch {
      /* skip broken genre lookups */
    }
  }

  if (filler.length < needed) {
    const artistCounts = new Map<string, number>();
    for (const q of queue)
      artistCounts.set(q.song.artist, (artistCounts.get(q.song.artist) ?? 0) + 1);
    const topArtists = [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([a]) => a);

    for (const artist of topArtists) {
      if (filler.length >= needed) break;
      try {
        const songs = await subsonicService.getTopSongs(artist, needed * 2);
        for (const s of songs) {
          if (filler.length >= needed) break;
          if (!excluded.has(s.id)) {
            filler.push(s);
            excluded.add(s.id);
          }
        }
      } catch {
        /* skip */
      }
    }
  }

  if (filler.length < needed) {
    try {
      const songs = await subsonicService.getRandomSongs(needed * 2);
      for (const s of songs) {
        if (filler.length >= needed) break;
        if (!excluded.has(s.id)) {
          filler.push(s);
          excluded.add(s.id);
        }
      }
    } catch {
      /* nothing more we can do */
    }
  }

  return filler;
}

// ---------------------------------------------------------------------------
// 5. Public entry point
// ---------------------------------------------------------------------------

export async function generateAutoplayQueue(
  queue: AutoplayQueueItem[],
  options: Partial<AutoplayOptions> = {},
): Promise<SubsonicSong[]> {
  const opts: AutoplayOptions = { ...DEFAULT_OPTIONS, ...options };
  if (queue.length === 0) return [];

  const weighted = weighQueue(queue, opts);
  const seeds = selectSeeds(weighted, opts.maxSeeds);

  const pool = await buildCandidatePool(seeds, opts);
  const candidates = removeAlreadyQueued(pool, queue);
  const diversified = diversifyByArtist(candidates, opts.maxPerArtist);

  const chosen = diversified.slice(0, opts.count).map(c => c.song);

  if (chosen.length < opts.count) {
    const filler = await fillWithFallback(
      chosen,
      opts.count - chosen.length,
      queue,
    );
    chosen.push(...filler);
  }

  return chosen;
}
