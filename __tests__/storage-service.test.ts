import RNFS from 'react-native-fs';
import { getOrCreatePlayer } from '../src/contexts/audio-player-bootstrap';
import {
  clearStorageCache,
  formatStorageBytes,
  getStorageStats,
  releaseStoragePlayback,
} from '../src/services/storage-service';

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/app/cache',
  ExternalCachesDirectoryPath: '/external/app/cache',
  readDir: jest.fn(),
  exists: jest.fn(),
  unlink: jest.fn(),
  getFSInfo: jest.fn(),
}));
jest.mock('../src/contexts/audio-player-bootstrap', () => ({
  getOrCreatePlayer: jest.fn(),
}));

const fs = jest.mocked(RNFS);
const cacheClear = jest.fn();
const removeTrack = jest.fn();
const unsubscribe = jest.fn();
const player = {
  state: {
    currentTrack: null as unknown,
    queue: [] as unknown[],
    playbackState: 'idle',
  },
  cache: { clear: cacheClear, removeTrack },
  on: jest.fn(),
};
let directories: Record<string, ReturnType<typeof entry>[]>;
const emptyResult = {
  stats: { cacheBytes: 0, freeBytes: 8000, totalBytes: 10000 },
  failedPaths: [],
  retainedTemporaryPaths: [],
};

function entry(path: string, size = 0, directory = false) {
  return {
    path,
    name: path.split('/').pop()!,
    size,
    ctime: new Date(),
    mtime: new Date(),
    isFile: () => !directory,
    isDirectory: () => directory,
  };
}

function loadTrack(playbackState = 'playing') {
  player.state = {
    currentTrack: { id: 'song' },
    queue: [{ id: 'song' }],
    playbackState,
  };
}

async function flush() {
  for (let index = 0; index < 20; index++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  jest.resetAllMocks();
  player.state = { currentTrack: null, queue: [], playbackState: 'idle' };
  player.cache = { clear: cacheClear, removeTrack };
  player.on.mockReturnValue(unsubscribe);
  directories = { '/app/cache': [], '/external/app/cache': [] };
  fs.readDir.mockImplementation(async path => {
    if (!directories[path]) {
      throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    }
    return [...directories[path]];
  });
  fs.exists.mockImplementation(
    async path =>
      !!directories[path] ||
      Object.values(directories).some(items =>
        items.some(item => item.path === path),
      ),
  );
  fs.unlink.mockImplementation(async path => {
    for (const items of Object.values(directories)) {
      const index = items.findIndex(item => item.path === path);
      if (index !== -1) {
        items.splice(index, 1);
      }
    }
  });
  fs.getFSInfo.mockResolvedValue({ freeSpace: 8000, totalSpace: 10000 });
  jest
    .mocked(getOrCreatePlayer)
    .mockResolvedValue(
      player as unknown as Awaited<ReturnType<typeof getOrCreatePlayer>>,
    );
});

test('measures recursive disk files, JS-managed player audio orphans and external app cache, not player metadata', async () => {
  directories['/app/cache'] = [
    entry('/app/cache/audio-cache', 999, true),
    entry('/app/cache/images', 800, true),
  ];
  directories['/app/cache/audio-cache'] = [
    entry('/app/cache/audio-cache/orphan.cache', 150),
    entry('/app/cache/audio-cache/song.cache.tmp', 25),
  ];
  directories['/app/cache/images'] = [
    entry('/app/cache/images/cover.jpg', 50),
    entry('/app/cache/images/nested', 999, true),
  ];
  directories['/app/cache/images/nested'] = [
    entry('/app/cache/images/nested/thumbnail', 10),
  ];
  directories['/external/app/cache'] = [entry('/external/app/cache/image', 5)];
  await expect(getStorageStats()).resolves.toEqual({
    cacheBytes: 240,
    freeBytes: 8000,
    totalBytes: 10000,
  });
  expect(getOrCreatePlayer).not.toHaveBeenCalled();
});

test.each(['empty', 'missing'])(
  '%s cache reports zero with real filesystem space',
  async mode => {
    if (mode === 'missing') {
      directories = {};
    }
    await expect(getStorageStats()).resolves.toEqual(emptyResult.stats);
    await expect(clearStorageCache()).resolves.toEqual(emptyResult);
    expect(fs.unlink).not.toHaveBeenCalled();
  },
);

test('never measures or deletes paths outside cache, traversal entries or directory roots', async () => {
  directories['/app/cache'] = [
    entry('/app/documents/download.mp3', 100),
    entry('/app/cache/../documents/credentials', 100),
    entry('/app/cache-other/settings', 100),
    entry('/app/cache', 100, true),
    entry('/app/cache/safe', 20),
  ];
  directories['/app/documents'] = [entry('/app/documents/library', 100)];
  expect((await getStorageStats()).cacheBytes).toBe(20);
  await clearStorageCache();
  expect(fs.unlink.mock.calls).toEqual([['/app/cache/safe']]);
  expect(fs.readDir).not.toHaveBeenCalledWith('/app/documents');
});

test('uses player clear API, removes remaining disk files and refreshes free space afterward', async () => {
  directories['/app/cache'] = [
    entry('/app/cache/audio-cache', 0, true),
    entry('/app/cache/cover', 20),
  ];
  directories['/app/cache/audio-cache'] = [
    entry('/app/cache/audio-cache/song.cache', 100),
  ];
  cacheClear.mockImplementation(async () => {
    directories['/app/cache/audio-cache'] = [];
  });
  fs.getFSInfo
    .mockResolvedValueOnce({ freeSpace: 8000, totalSpace: 10000 })
    .mockResolvedValue({ freeSpace: 8120, totalSpace: 10000 });
  expect((await getStorageStats()).cacheBytes).toBe(120);
  await expect(clearStorageCache()).resolves.toEqual({
    ...emptyResult,
    stats: { cacheBytes: 0, freeBytes: 8120, totalBytes: 10000 },
  });
  expect(cacheClear).toHaveBeenCalledTimes(1);
  expect(fs.unlink.mock.calls).toEqual([['/app/cache/cover']]);
});

test('reports partial unlink failures and refreshes remaining disk usage', async () => {
  directories['/app/cache'] = [
    entry('/app/cache/locked', 40),
    entry('/app/cache/removable', 60),
  ];
  fs.unlink.mockImplementation(async path => {
    if (path.endsWith('/locked')) {
      throw Object.assign(new Error('In use'), { code: 'EACCES' });
    }
    directories['/app/cache'] = directories['/app/cache'].filter(
      item => item.path !== path,
    );
  });
  await expect(clearStorageCache()).resolves.toEqual({
    ...emptyResult,
    stats: { ...emptyResult.stats, cacheBytes: 40 },
    failedPaths: ['/app/cache/locked'],
  });
});

test.each(['playing', 'paused', 'loading', 'buffering', 'stopped'])(
  'does not release loaded %s playback without explicit consent',
  async playbackState => {
    loadTrack(playbackState);
    await expect(clearStorageCache()).rejects.toThrow(
      'Stop playback and clear cache',
    );
    expect(cacheClear).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  },
);

test('awaits existing stop control and queue-release state event before deleting files', async () => {
  loadTrack('paused');
  const stop = jest.fn(async () => {
    player.state.playbackState = 'stopped';
  });
  const clearQueue = jest.fn();
  const pending = clearStorageCache({
    releasePlayback: () => releaseStoragePlayback({ stop, clearQueue }),
  });
  await flush();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(clearQueue).toHaveBeenCalledTimes(1);
  expect(player.on).toHaveBeenCalledWith('stateChange', expect.any(Function));
  expect(cacheClear).not.toHaveBeenCalled();
  // This is the event rn-audio-stream emits only after TrackPlayer.reset resolves.
  player.state = { currentTrack: null, queue: [], playbackState: 'idle' };
  player.on.mock.calls[0][1](player.state);
  await expect(pending).resolves.toEqual(emptyResult);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(cacheClear).toHaveBeenCalledTimes(1);
  // The queued job is cancelled even if it has not created a temporary file yet.
  expect(removeTrack).toHaveBeenCalledWith('song');
});

test('does not delete cache when stopping playback fails', async () => {
  loadTrack();
  const stop = jest.fn().mockRejectedValue(new Error('Native stop failed'));
  const clearQueue = jest.fn();
  await expect(
    clearStorageCache({
      releasePlayback: () => releaseStoragePlayback({ stop, clearQueue }),
    }),
  ).rejects.toThrow('Native stop failed');
  expect(clearQueue).not.toHaveBeenCalled();
  expect(cacheClear).not.toHaveBeenCalled();
  expect(fs.unlink).not.toHaveBeenCalled();
});

test('times out safely when native queue reset never produces a released state', async () => {
  jest.useFakeTimers();
  try {
    loadTrack();
    const pending = clearStorageCache({
      releasePlayback: () =>
        releaseStoragePlayback({ stop: jest.fn(), clearQueue: jest.fn() }),
    });
    const rejection = pending.catch(error => error);
    await flush();
    await jest.advanceTimersByTimeAsync(10000);
    expect((await rejection).message).toContain('No cache files were deleted');
    expect(unsubscribe).toHaveBeenCalled();
    expect(cacheClear).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test('requests cancellation but retains unresolved temporary files without blocking other cache deletion', async () => {
  directories['/app/cache'] = [
    entry('/app/cache/audio-cache', 0, true),
    entry('/app/cache/cover', 50),
  ];
  directories['/app/cache/audio-cache'] = [
    entry('/app/cache/audio-cache/song.cache.tmp', 10),
  ];
  await expect(clearStorageCache()).resolves.toEqual({
    ...emptyResult,
    stats: { ...emptyResult.stats, cacheBytes: 10 },
    retainedTemporaryPaths: ['/app/cache/audio-cache/song.cache.tmp'],
  });
  expect(removeTrack).toHaveBeenCalledWith('song');
  expect(fs.unlink.mock.calls).toEqual([['/app/cache/cover']]);
  // A persistent .tmp is not classified as an active download or a global blocker.
  await expect(clearStorageCache()).resolves.toHaveProperty(
    'retainedTemporaryPaths',
    ['/app/cache/audio-cache/song.cache.tmp'],
  );
});

test('rechecks disk after cancellation and clears files when the job has cleaned up', async () => {
  directories['/app/cache'] = [entry('/app/cache/audio-cache', 0, true)];
  directories['/app/cache/audio-cache'] = [
    entry('/app/cache/audio-cache/song.cache.tmp', 10),
  ];
  removeTrack.mockImplementation(async () => {
    directories['/app/cache/audio-cache'] = [];
  });
  await expect(clearStorageCache()).resolves.toEqual(emptyResult);
  expect(removeTrack).toHaveBeenCalledWith('song');
  expect(fs.unlink).not.toHaveBeenCalled();
});

test('fails safely when requesting download cancellation rejects', async () => {
  directories['/app/cache'] = [entry('/app/cache/audio-cache', 0, true)];
  directories['/app/cache/audio-cache'] = [
    entry('/app/cache/audio-cache/song.cache.tmp', 10),
  ];
  removeTrack.mockRejectedValue(new Error('Cancellation failed'));
  await expect(clearStorageCache()).rejects.toThrow('Cancellation failed');
  expect(cacheClear).not.toHaveBeenCalled();
  expect(fs.unlink).not.toHaveBeenCalled();
});

test('rejects duplicate clears and releases the lock after failure', async () => {
  let reject!: (reason: Error) => void;
  cacheClear.mockReturnValueOnce(
    new Promise<void>((_, rejectPromise) => {
      reject = rejectPromise;
    }),
  );
  const first = clearStorageCache();
  while (!reject) {
    await Promise.resolve();
  }
  await expect(clearStorageCache()).rejects.toThrow('already in progress');
  reject(new Error('Player cache clear failed'));
  await expect(first).rejects.toThrow('Player cache clear failed');
  await expect(clearStorageCache()).resolves.toHaveProperty('failedPaths', []);
});

test('does not disguise read permission failures as empty cache', async () => {
  fs.readDir.mockRejectedValue(
    Object.assign(new Error('Permission denied'), { code: 'EACCES' }),
  );
  await expect(getStorageStats()).rejects.toThrow('Permission denied');
});

test('handles Android RNFS missing-directory errors without assuming ENOENT', async () => {
  let calls = 0;
  fs.exists.mockImplementation(async () => ++calls === 1);
  fs.readDir.mockRejectedValue(
    Object.assign(new Error('Folder does not exist'), { code: 'EUNSPECIFIED' }),
  );
  expect((await getStorageStats()).cacheBytes).toBe(0);
});

test('stops deletion if playback starts during filesystem inspection', async () => {
  directories['/app/cache'] = [entry('/app/cache/cover', 40)];
  fs.exists.mockImplementation(async path => {
    if (path === '/app/cache/cover') {
      loadTrack();
    }
    return true;
  });
  await expect(clearStorageCache()).rejects.toThrow('Playback is still loaded');
  expect(fs.unlink).not.toHaveBeenCalled();
});

test('rejects invalid device free space', async () => {
  fs.getFSInfo.mockResolvedValue({ freeSpace: NaN, totalSpace: 10000 });
  await expect(getStorageStats()).rejects.toThrow('available device space');
});

test('formats zero and useful storage units', () => {
  expect(formatStorageBytes(0)).toBe('0 B');
  expect(formatStorageBytes(512)).toBe('512 B');
  expect(formatStorageBytes(1536)).toBe('1.5 KB');
  expect(formatStorageBytes(1024 ** 3)).toBe('1.0 GB');
});
