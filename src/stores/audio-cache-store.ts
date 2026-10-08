import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '../utils/storage';
import type {
  AudioCacheState,
  AudioCacheActions,
  AudioCacheStore,
  CacheMetadata,
  CacheProgress,
  NetworkState,
  CacheConfig,
  PrefetchConfig,
  SubsonicSong,
} from '../types/audio-cache';

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSizeBytes: 1073741824,
  maxSizePercentage: 0.1,
  minFreeSpaceBytes: 536870912,
  evictionPolicy: 'lru',
  metadataRetentionDays: 30,
};

const DEFAULT_PREFETCH_CONFIG: PrefetchConfig = {
  enabled: true,
  triggerPercentage: 0.5,
  prefetchCount: 2,
  chunkSize: 262144,
  maxConcurrentPrefetches: 2,
  cellularAllowed: false,
};

const DEFAULT_NETWORK_STATE: NetworkState = {
  isConnected: true,
  isMetered: false,
  type: 'unknown',
};

const initialState: AudioCacheState = {
  cache: new Map<string, CacheMetadata>(),
  progress: new Map<string, CacheProgress>(),
  prefetchQueue: [],
  activeDownloads: new Set<string>(),
  networkState: DEFAULT_NETWORK_STATE,
  config: DEFAULT_CACHE_CONFIG,
  prefetchConfig: DEFAULT_PREFETCH_CONFIG,
  totalCacheSize: 0,
  availableSpace: 0,
};

type StoreState = AudioCacheState & AudioCacheActions;

export const useAudioCacheStore = create<StoreState>()(
  persist(
    (set: (partial: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)) => void, 
     get: () => StoreState) => ({
      ...initialState,

      // Cache management
      getCacheMetadata: (songId: string) => {
        return get().cache.get(songId) ?? null;
      },

      setCacheMetadata: (metadata: CacheMetadata) => {
        set((state: StoreState) => {
          const newCache = new Map(state.cache);
          newCache.set(metadata.songId, metadata);
          return { cache: newCache };
        });
      },

      deleteCacheMetadata: (songId: string) => {
        set((state: StoreState) => {
          const newCache = new Map(state.cache);
          newCache.delete(songId);
          return { cache: newCache };
        });
      },

      updateLastAccessed: (songId: string) => {
        set((state: StoreState) => {
          const metadata = state.cache.get(songId);
          if (!metadata) return state;
          const newCache = new Map(state.cache);
          newCache.set(songId, {
            ...metadata,
            lastAccessed: Date.now(),
          });
          return { cache: newCache };
        });
      },

      incrementAccessCount: (songId: string) => {
        set((state: StoreState) => {
          const metadata = state.cache.get(songId);
          if (!metadata) return state;
          const newCache = new Map(state.cache);
          newCache.set(songId, {
            ...metadata,
            accessCount: metadata.accessCount + 1,
            lastAccessed: Date.now(),
          });
          return { cache: newCache };
        });
      },

      // Progress tracking
      getProgress: (songId: string) => {
        return get().progress.get(songId) ?? null;
      },

      setProgress: (progress: CacheProgress) => {
        set((state: StoreState) => {
          const newProgress = new Map(state.progress);
          newProgress.set(progress.songId, progress);
          return { progress: newProgress };
        });
      },

      clearProgress: (songId: string) => {
        set((state: StoreState) => {
          const newProgress = new Map(state.progress);
          newProgress.delete(songId);
          return { progress: newProgress };
        });
      },

      // Prefetch queue
      addToPrefetchQueue: (songId: string) => {
        set((state: StoreState) => {
          if (state.prefetchQueue.includes(songId)) return state;
          return { prefetchQueue: [...state.prefetchQueue, songId] };
        });
      },

      removeFromPrefetchQueue: (songId: string) => {
        set((state: StoreState) => ({
          prefetchQueue: state.prefetchQueue.filter((id) => id !== songId),
        }));
      },

      clearPrefetchQueue: () => {
        set({ prefetchQueue: [] });
      },

      getPrefetchQueue: () => {
        return get().prefetchQueue;
      },

      // Active downloads
      addActiveDownload: (songId: string) => {
        set((state: StoreState) => {
          const newActive = new Set(state.activeDownloads);
          newActive.add(songId);
          return { activeDownloads: newActive };
        });
      },

      removeActiveDownload: (songId: string) => {
        set((state: StoreState) => {
          const newActive = new Set(state.activeDownloads);
          newActive.delete(songId);
          return { activeDownloads: newActive };
        });
      },

      getActiveDownloads: () => {
        return Array.from(get().activeDownloads);
      },

      // Network state
      setNetworkState: (networkState: NetworkState) => {
        set({ networkState });
      },

      // Configuration
      setCacheConfig: (config: Partial<CacheConfig>) => {
        set((state: StoreState) => ({
          config: { ...state.config, ...config },
        }));
      },

      setPrefetchConfig: (config: Partial<PrefetchConfig>) => {
        set((state: StoreState) => ({
          prefetchConfig: { ...state.prefetchConfig, ...config },
        }));
      },

      // Statistics
      updateCacheSize: (size: number) => {
        set({ totalCacheSize: size });
      },

      setAvailableSpace: (space: number) => {
        set({ availableSpace: space });
      },

      // Offline mode
      getCachedSongs: () => {
        const state = get();
        const cachedSongs: SubsonicSong[] = [];
        state.cache.forEach((metadata: CacheMetadata) => {
          if (metadata.isComplete) {
            cachedSongs.push({
              id: metadata.songId,
              parent: '',
              isDir: false,
              title: metadata.title,
              album: metadata.album,
              artist: metadata.artist,
              track: 0,
              year: 0,
              coverArt: metadata.coverArt,
              size: metadata.size,
              contentType: metadata.contentType,
              suffix: '',
              duration: metadata.duration,
              bitRate: 0,
              path: '',
              discNumber: 0,
              created: '',
              albumId: '',
              artistId: '',
              type: 'music',
              mediaType: 'audio',
              bpm: 0,
              comment: '',
              sortName: '',
              musicBrainzId: '',
              isrc: [],
              genres: [],
              replayGain: {},
              channelCount: 0,
              samplingRate: 0,
              bitDepth: 0,
              moods: [],
              artists: [],
              displayArtist: metadata.artist,
              albumArtists: [],
              displayAlbumArtist: '',
              contributors: [],
              displayComposer: '',
              explicitStatus: 'none',
            });
          }
        });
        return cachedSongs;
      },

      isSongFullyCached: (songId: string) => {
        const metadata = get().cache.get(songId);
        return metadata?.isComplete ?? false;
      },

      getCachedSongIds: () => {
        const state = get();
        const ids: string[] = [];
        state.cache.forEach((metadata: CacheMetadata) => {
          if (metadata.isComplete) {
            ids.push(metadata.songId);
          }
        });
        return ids;
      },

      // Eviction
      evictLeastRecentlyUsed: async (bytesNeeded: number) => {
        const state = get();
        const sortedEntries = Array.from(state.cache.entries())
          .filter((entry: [string, CacheMetadata]): entry is [string, CacheMetadata] => entry[1].isComplete)
          .sort((a: [string, CacheMetadata], b: [string, CacheMetadata]) => a[1].lastAccessed - b[1].lastAccessed);

        let freedBytes = 0;
        const evictedSongs: string[] = [];

        for (const [songId, metadata] of sortedEntries) {
          if (freedBytes >= bytesNeeded) break;
          
          freedBytes += metadata.size;
          evictedSongs.push(songId);
          
          if (state.config.metadataRetentionDays > 0) {
            get().setCacheMetadata({
              ...metadata,
              isComplete: false,
              cachedChunks: [],
              filePath: '',
              size: 0,
            });
          } else {
            get().deleteCacheMetadata(songId);
          }
        }

        return { evictedSongs, freedBytes, success: freedBytes >= bytesNeeded };
      },

      evictSong: async (songId: string) => {
        const state = get();
        const metadata = state.cache.get(songId);
        if (!metadata) return false;

        try {
          if (state.config.metadataRetentionDays > 0) {
            get().setCacheMetadata({
              ...metadata,
              isComplete: false,
              cachedChunks: [],
              filePath: '',
              size: 0,
            });
          } else {
            get().deleteCacheMetadata(songId);
          }
          return true;
        } catch (error) {
          console.error(`Failed to evict ${songId}:`, error);
          return false;
        }
      },
    }),
    {
      name: 'audio-cache-store',
      storage: createJSONStorage(() => ({
        getItem: (name: string) => {
          const value = storage.getString(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name: string, value: unknown) => {
          storage.set(name, JSON.stringify(value));
        },
        removeItem: (name: string) => {
          storage.remove(name);
        },
      })),
      partialize: (state: StoreState) => ({
        config: state.config,
        prefetchConfig: state.prefetchConfig,
        cache: Array.from(state.cache.entries()),
      }),
      onRehydrateStorage: () => (state: StoreState | undefined) => {
        if (state) {
          if (Array.isArray(state.cache)) {
            state.cache = new Map(state.cache);
          }
          if (Array.isArray(state.progress)) {
            state.progress = new Map(state.progress);
          }
          if (!state.prefetchQueue) state.prefetchQueue = [];
          if (!state.activeDownloads) state.activeDownloads = new Set();
        }
      },
    }
  )
);

// Selectors for common use cases
export const useCacheMetadata = (songId: string) =>
  useAudioCacheStore((state: StoreState) => state.getCacheMetadata(songId));

export const useCacheProgress = (songId: string) =>
  useAudioCacheStore((state: StoreState) => state.getProgress(songId));

export const usePrefetchQueue = () =>
  useAudioCacheStore((state: StoreState) => state.prefetchQueue);

export const useNetworkState = () =>
  useAudioCacheStore((state: StoreState) => state.networkState);

export const useCacheConfig = () =>
  useAudioCacheStore((state: StoreState) => state.config);

export const usePrefetchConfig = () =>
  useAudioCacheStore((state: StoreState) => state.prefetchConfig);

export const useCachedSongIds = () =>
  useAudioCacheStore((state: StoreState) => state.getCachedSongIds());

export const useIsSongCached = (songId: string) =>
  useAudioCacheStore((state: StoreState) => state.isSongFullyCached(songId));