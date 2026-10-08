// Audio Cache Types and Interfaces

import type { SubsonicSong } from './subsonic';
export type { SubsonicSong } from './subsonic';

export interface CacheMetadata {
  songId: string;
  title: string;
  artist: string;
  album: string;
  coverArt: string;
  duration: number;
  contentType: string;
  size: number;
  cachedAt: number;
  lastAccessed: number;
  accessCount: number;
  isComplete: boolean;
  totalChunks: number;
  cachedChunks: number[];
  filePath: string;
}

export interface CacheChunk {
  songId: string;
  chunkIndex: number;
  startByte: number;
  endByte: number;
  size: number;
  cached: boolean;
}

export interface CacheProgress {
  songId: string;
  progress: number; // 0-1
  bytesCached: number;
  totalBytes: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error';
  error?: string;
}

export interface PrefetchConfig {
  enabled: boolean;
  triggerPercentage: number; // e.g., 50% = 0.5
  prefetchCount: number; // number of next tracks to prefetch
  chunkSize: number; // bytes per chunk
  maxConcurrentPrefetches: number;
  cellularAllowed: boolean;
}

export interface CacheConfig {
  maxSizeBytes: number; // e.g., 1GB = 1073741824
  maxSizePercentage: number; // e.g., 10% = 0.1
  minFreeSpaceBytes: number; // minimum free space to maintain
  evictionPolicy: 'lru' | 'fifo' | 'lfu';
  metadataRetentionDays: number; // keep metadata even after audio evicted
}

export interface NetworkState {
  isConnected: boolean;
  isMetered: boolean; // cellular connection
  type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
}

export interface AudioCacheState {
  // Cache entries
  cache: Map<string, CacheMetadata>;
  // Download progress
  progress: Map<string, CacheProgress>;
  // Prefetch queue
  prefetchQueue: string[];
  // Active downloads
  activeDownloads: Set<string>;
  // Network state
  networkState: NetworkState;
  // Configuration
  config: CacheConfig;
  prefetchConfig: PrefetchConfig;
  // Statistics
  totalCacheSize: number;
  availableSpace: number;
}

export interface AudioCacheActions {
  // Cache management
  getCacheMetadata: (songId: string) => CacheMetadata | null;
  setCacheMetadata: (metadata: CacheMetadata) => void;
  deleteCacheMetadata: (songId: string) => void;
  updateLastAccessed: (songId: string) => void;
  incrementAccessCount: (songId: string) => void;
  
  // Progress tracking
  getProgress: (songId: string) => CacheProgress | null;
  setProgress: (progress: CacheProgress) => void;
  clearProgress: (songId: string) => void;
  
  // Prefetch queue
  addToPrefetchQueue: (songId: string) => void;
  removeFromPrefetchQueue: (songId: string) => void;
  clearPrefetchQueue: () => void;
  getPrefetchQueue: () => string[];
  
  // Active downloads
  addActiveDownload: (songId: string) => void;
  removeActiveDownload: (songId: string) => void;
  getActiveDownloads: () => string[];
  
  // Network state
  setNetworkState: (state: NetworkState) => void;
  
  // Configuration
  setCacheConfig: (config: Partial<CacheConfig>) => void;
  setPrefetchConfig: (config: Partial<PrefetchConfig>) => void;
  
  // Statistics
  updateCacheSize: (size: number) => void;
  setAvailableSpace: (space: number) => void;
  
  // Offline mode
  getCachedSongs: () => SubsonicSong[];
  isSongFullyCached: (songId: string) => boolean;
  getCachedSongIds: () => string[];
  
  // Eviction
  evictLeastRecentlyUsed: (bytesNeeded: number) => Promise<string[]>;
  evictSong: (songId: string) => Promise<boolean>;
}

export type AudioCacheStore = AudioCacheState & AudioCacheActions;

export interface ChunkedStreamOptions {
  songId: string;
  url: string;
  chunkSize: number;
  onChunk: (chunk: Uint8Array, chunkIndex: number, totalChunks: number) => void;
  onProgress: (progress: number) => void;
  onComplete: (filePath: string) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export interface PrefetchJob {
  songId: string;
  priority: number;
  chunksToPrefetch: number;
  startedAt: number;
}

export interface CacheEvictionResult {
  evictedSongs: string[];
  freedBytes: number;
  success: boolean;
}