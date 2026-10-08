import RNFS from 'react-native-fs';
import { getOrCreatePlayer } from '../contexts/audio-player-bootstrap';

export interface StorageStats {
  cacheBytes: number;
  freeBytes: number;
  totalBytes: number;
}

export interface ClearCacheResult {
  stats: StorageStats;
  failedPaths: string[];
  retainedTemporaryPaths: string[];
}

export interface ClearCacheOptions {
  // Supply only after confirming loss of the playback queue and position.
  releasePlayback?: () => Promise<void>;
}

const PLAYBACK_CACHE_BUSY =
  'Playback is still loaded or restarted during clearing. Use Stop playback and clear cache to release the track and queue, then retry.';

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/^file:\/\//, '').split('/')) {
    if (part === '..') {
      parts.pop();
    } else if (part && part !== '.') {
      parts.push(part);
    }
  }
  return `/${parts.join('/')}`;
}

function isInside(path: string, root: string): boolean {
  return normalizePath(path).startsWith(`${root}/`);
}

// rn-audio-stream 2.3.1 lib/cache.js is a JS CacheManager whose RNFS-backed
// downloads and files use CachesDirectoryPath/audio-cache, not a native player cache.
// Include Android's external app cache too, never Documents or shared downloads.
function cacheRoots(): string[] {
  const roots = [RNFS.CachesDirectoryPath, RNFS.ExternalCachesDirectoryPath]
    .filter((path): path is string => !!path && path.startsWith('/'))
    .map(normalizePath)
    .filter(path => path !== '/');
  return [...new Set(roots)].filter(
    root => !roots.some(other => other !== root && isInside(root, other)),
  );
}

function isMissing(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'ENOENT';
}

async function readDirectory(path: string) {
  // Android RNFS can report a missing directory as EUNSPECIFIED, not ENOENT.
  if (!(await RNFS.exists(path))) {
    return [];
  }
  try {
    return await RNFS.readDir(path);
  } catch (error) {
    if (isMissing(error) || !(await RNFS.exists(path))) {
      return [];
    }
    throw error;
  }
}

async function cacheFiles(): Promise<{ path: string; size: number }[]> {
  const files: { path: string; size: number }[] = [];
  const visited = new Set<string>();
  for (const root of cacheRoots()) {
    const walk = async (directory: string): Promise<void> => {
      if (visited.has(directory)) {
        return;
      }
      visited.add(directory);
      for (const entry of await readDirectory(directory)) {
        const path = normalizePath(entry.path);
        // Only accept immediate children of the enumerated cache directory.
        if (
          !isInside(path, root) ||
          path.slice(0, path.lastIndexOf('/')) !== directory
        ) {
          continue;
        }
        if (entry.isDirectory()) {
          await walk(path);
        } else if (entry.isFile()) {
          const size = Number(entry.size);
          if (!Number.isFinite(size) || size < 0) {
            throw new Error(
              'Unable to read the size of a cached file. Please refresh.',
            );
          }
          files.push({ path, size });
        }
      }
    };
    await walk(root);
  }
  return files;
}

export async function getStorageStats(): Promise<StorageStats> {
  const [files, space] = await Promise.all([cacheFiles(), RNFS.getFSInfo()]);
  if (
    !Number.isFinite(space.freeSpace) ||
    space.freeSpace < 0 ||
    !Number.isFinite(space.totalSpace) ||
    space.totalSpace < 0
  ) {
    throw new Error('Unable to read available device space. Please refresh.');
  }
  return {
    cacheBytes: files.reduce((total, file) => total + file.size, 0),
    freeBytes: space.freeSpace,
    totalBytes: space.totalSpace,
  };
}

// The context's clearQueue control also clears its React/persisted queue. Its
// return type is void and native errors are swallowed, so wait for the player's
// empty idle state emitted AFTER the awaited TrackPlayer.reset(), not that return.
export async function releaseStoragePlayback(controls: {
  stop: () => void | Promise<void>;
  clearQueue: () => void;
}): Promise<void> {
  const player = await getOrCreatePlayer();
  await controls.stop();
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          'Playback could not be released. No cache files were deleted. Wait for playback to finish stopping, then retry.',
        ),
      );
    }, 10000);
    const unsubscribe = player.on('stateChange', state => {
      if (
        state.playbackState === 'idle' &&
        !state.currentTrack &&
        state.queue.length === 0
      ) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
    try {
      controls.clearQueue();
    } catch (error) {
      clearTimeout(timeout);
      unsubscribe();
      reject(error);
    }
  });
}

let clearing = false;

export async function clearStorageCache(
  options: ClearCacheOptions = {},
): Promise<ClearCacheResult> {
  if (clearing) {
    throw new Error('Cache clearing is already in progress.');
  }
  clearing = true;
  try {
    const player = await getOrCreatePlayer();
    // Also cancel queued IDs whose native downloads have not created a .tmp yet.
    const queuedDownloadIds = player.state.queue.map(track => track.id);
    if (player.state.currentTrack) {
      queuedDownloadIds.push(player.state.currentTrack.id);
    }
    if (options.releasePlayback) {
      await options.releasePlayback();
    }
    const assertIdle = () => {
      const state = player.state;
      if (
        state.currentTrack ||
        state.queue.length > 0 ||
        !['idle', 'stopped', 'ended', 'error'].includes(state.playbackState)
      ) {
        throw new Error(PLAYBACK_CACHE_BUSY);
      }
    };
    assertIdle();
    const audioRoot = `${normalizePath(RNFS.CachesDirectoryPath)}/audio-cache`;
    const isAudioTemporary = (path: string) =>
      isInside(path, audioRoot) && path.endsWith('.tmp');
    const beforeCancellation = await cacheFiles();
    const downloadIds = new Set([
      ...queuedDownloadIds,
      ...beforeCancellation
        .filter(
          file =>
            isAudioTemporary(file.path) && file.path.endsWith('.cache.tmp'),
        )
        .map(file =>
          file.path.slice(audioRoot.length + 1, -'.cache.tmp'.length),
        )
        .filter(id => !!id && !id.includes('/')),
    ]);
    for (const id of downloadIds) {
      assertIdle();
      // The public API cancels a tracked RNFS job, but does not await its native
      // completion. Never infer safety from a .tmp file's age or unchanged size.
      await player.cache?.removeTrack(id);
    }
    const files = await cacheFiles();
    assertIdle();
    // Clear the player's in-memory index before removing orphaned disk files.
    // Its getStats() is metadata-derived, so it is not used as a disk usage total.
    await player.cache?.clear();
    const failedPaths: string[] = [];
    for (const file of files) {
      assertIdle();
      // No public API distinguishes stale temporary files from a stalled writer.
      // Retain them without blocking deletion of the rest of the app cache.
      if (isAudioTemporary(file.path)) {
        continue;
      }
      try {
        // The player API may have removed this file already.
        if (await RNFS.exists(file.path)) {
          assertIdle();
          await RNFS.unlink(file.path);
        }
      } catch (error) {
        assertIdle();
        if (!isMissing(error)) {
          failedPaths.push(file.path);
        }
      }
    }
    // Keep directory roots intact: image caches and other owners may reuse them.
    // Always re-read disk, including partial failures and cache repopulation.
    const remainingFiles = await cacheFiles();
    const retainedTemporaryPaths = remainingFiles
      .filter(file => isAudioTemporary(file.path))
      .map(file => file.path);
    return {
      stats: await getStorageStats(),
      failedPaths,
      retainedTemporaryPaths,
    };
  } finally {
    clearing = false;
  }
}

export function formatStorageBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
