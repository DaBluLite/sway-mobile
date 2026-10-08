// Audio Cache Error Handling and Recovery Utilities

import { audioCacheService } from '../services/audio-cache-service';
import { useAudioCacheStore } from '../stores/audio-cache-store';
import type { CacheMetadata, CacheProgress } from '../types/audio-cache';

// Get the underlying store for non-React usage
const audioCacheStore = useAudioCacheStore;

export class AudioCacheError extends Error {
  constructor(
    message: string,
    public code: 
      | 'CACHE_CORRUPTED'
      | 'CACHE_MISSING'
      | 'DOWNLOAD_FAILED'
      | 'NETWORK_ERROR'
      | 'STORAGE_FULL'
      | 'PERMISSION_DENIED'
      | 'INVALID_METADATA'
      | 'STREAM_INTERRUPTED'
      | 'FILE_SYSTEM_ERROR'
      | 'UNKNOWN',
    public songId?: string,
    public recoverable: boolean = true,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AudioCacheError';
  }

  static fromError(error: unknown, songId?: string): AudioCacheError {
    if (error instanceof AudioCacheError) return error;
    
    if (error instanceof Error) {
      // Network errors
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        return new AudioCacheError(
          'Download was aborted',
          'STREAM_INTERRUPTED',
          songId,
          true,
          error
        );
      }
      
      if (error.message.includes('Network') || error.message.includes('fetch')) {
        return new AudioCacheError(
          `Network error: ${error.message}`,
          'NETWORK_ERROR',
          songId,
          true,
          error
        );
      }
      
      // Storage errors
      if (error.message.includes('quota') || error.message.includes('space')) {
        return new AudioCacheError(
          'Storage quota exceeded',
          'STORAGE_FULL',
          songId,
          true,
          error
        );
      }
      
      if (error.message.includes('permission') || error.message.includes('EACCES')) {
        return new AudioCacheError(
          'Permission denied accessing cache',
          'PERMISSION_DENIED',
          songId,
          false,
          error
        );
      }
      
      // File system errors
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        return new AudioCacheError(
          'Cache file not found',
          'CACHE_MISSING',
          songId,
          true,
          error
        );
      }
      
      return new AudioCacheError(
        error.message,
        'UNKNOWN',
        songId,
        true,
        error
      );
    }
    
    return new AudioCacheError(
      'Unknown cache error',
      'UNKNOWN',
      songId,
      true
    );
  }
}

export interface CacheRecoveryResult {
  success: boolean;
  recoveredSongs: string[];
  failedSongs: string[];
  errors: AudioCacheError[];
}

export async function verifyAndRepairCache(songIds?: string[]): Promise<CacheRecoveryResult> {
  const store = audioCacheStore.getState();
  const allSongIds = songIds ?? store.getCachedSongIds();
  
  const recoveredSongs: string[] = [];
  const failedSongs: string[] = [];
  const errors: AudioCacheError[] = [];

  const results = await Promise.all(
    allSongIds.map(async songId => {
      try {
        const isValid = await audioCacheService.verifyCacheIntegrity(songId);
        if (!isValid) {
          console.warn(`[CacheRecovery] Corrupted cache detected for ${songId}, attempting repair`);
          await audioCacheService.repairCache(songId);
          return { status: 'recovered' as const, songId };
        }
        return { status: 'ok' as const, songId };
      } catch (error) {
        const cacheError = AudioCacheError.fromError(error, songId);
        console.error(`[CacheRecovery] Failed to repair ${songId}:`, cacheError);
        return { status: 'failed' as const, songId, error: cacheError };
      }
    }),
  );
  for (const r of results) {
    if (r.status === 'recovered') recoveredSongs.push(r.songId);
    else if (r.status === 'failed') { failedSongs.push(r.songId); errors.push(r.error!); }
  }

  return {
    success: failedSongs.length === 0,
    recoveredSongs,
    failedSongs,
    errors,
  };
}

export async function handleStreamError(
  songId: string,
  error: unknown,
  onFallback?: (localUrl: string) => void
): Promise<boolean> {
  const cacheError = AudioCacheError.fromError(error, songId);
  
  console.error(`[StreamError] Error streaming ${songId}:`, cacheError);
  
  // Try to get cached version
  if (cacheError.recoverable) {
    try {
      const cachedUrl = await audioCacheService.getCachedFileUrl(songId);
      if (cachedUrl) {
        console.log(`[StreamError] Falling back to cached version for ${songId}`);
        onFallback?.(cachedUrl);
        return true;
      }
    } catch (fallbackError) {
      console.error(`[StreamError] Fallback failed for ${songId}:`, fallbackError);
    }
  }
  
  // Update progress state to error
  audioCacheStore.getState().setProgress({
    songId,
    progress: 0,
    bytesCached: 0,
    totalBytes: 0,
    status: 'error',
    error: cacheError.message,
  });
  
  return false;
}

export async function handleInterruptedDownload(songId: string): Promise<void> {
  // Clean up partial download
  const progress = audioCacheStore.getState().getProgress(songId);
  
  if (progress?.status === 'downloading' || progress?.status === 'paused') {
    // Keep partial data for resume capability
    audioCacheStore.getState().setProgress({
      ...progress,
      status: 'paused',
    });
  } else {
    // Clean up completely
    await audioCacheService.deleteAudioFile(songId);
    audioCacheStore.getState().clearProgress(songId);
  }
}

export async function resumeDownload(songId: string): Promise<string | null> {
  const progress = audioCacheStore.getState().getProgress(songId);
  const metadata = await audioCacheService.loadMetadata(songId);
  
  if (!progress || !metadata) {
    // No progress to resume, start fresh
    return null;
  }
  
  // Check if we have a partial file
  const fileInfo = await audioCacheService.getAudioFileInfo(songId);
  if (!fileInfo.exists || fileInfo.size === 0) {
    return null;
  }
  
  // Resume from where we left off
  // This would require Range request support from the server
  // For now, just restart the download
  return null;
}

export interface CacheHealthReport {
  totalSongs: number;
  completeSongs: number;
  incompleteSongs: number;
  corruptedSongs: number;
  totalSize: number;
  availableSpace: number;
  healthScore: number; // 0-100
  issues: string[];
}

export async function getCacheHealthReport(): Promise<CacheHealthReport> {
  const store = audioCacheStore.getState();
  const allSongIds = store.getCachedSongIds();
  
  let completeSongs = 0;
  let incompleteSongs = 0;
  let corruptedSongs = 0;
  const issues: string[] = [];
  
  const checks = await Promise.all(
    allSongIds.map(async songId => {
      const metadata = store.getCacheMetadata(songId);
      if (!metadata) return { kind: 'corrupted' as const, songId, reason: `Missing metadata for ${songId}` };
      if (!metadata.isComplete) return { kind: 'incomplete' as const, songId };
      const isValid = await audioCacheService.verifyCacheIntegrity(songId);
      return isValid ? { kind: 'complete' as const, songId } : { kind: 'corrupted' as const, songId, reason: `Corrupted cache for ${songId}` };
    }),
  );
  for (const c of checks) {
    if (c.kind === 'complete') completeSongs++;
    else if (c.kind === 'incomplete') incompleteSongs++;
    else { corruptedSongs++; issues.push(c.reason!); }
  }
  
  const totalSongs = allSongIds.length;
  const healthScore = totalSongs > 0 
    ? Math.round((completeSongs / totalSongs) * 100) 
    : 100;
  
  if (corruptedSongs > 0) {
    issues.push(`${corruptedSongs} corrupted cache entries found`);
  }
  
  if (incompleteSongs > totalSongs * 0.5) {
    issues.push('Many incomplete downloads - check network connectivity');
  }
  
  return {
    totalSongs,
    completeSongs,
    incompleteSongs,
    corruptedSongs,
    totalSize: store.totalCacheSize,
    availableSpace: store.availableSpace,
    healthScore,
    issues,
  };
}

export async function performCacheMaintenance(): Promise<void> {
  // 1. Update statistics
  await audioCacheService.updateCacheStatistics();
  
  // 2. Check and evict if needed
  await audioCacheService.checkAndEvictIfNeeded();
  
  // 3. Clean up orphaned metadata
  await audioCacheService.cleanupOrphanedMetadata();
  
  // 4. Sync offline metadata
  const { offlineModeService } = await import('../services/offline-mode');
  await offlineModeService.syncOfflineMetadata();
  
  console.log('[CacheMaintenance] Completed');
}

export function createCacheErrorBoundary() {
  return {
    onError: (error: Error, songId?: string) => {
      const cacheError = AudioCacheError.fromError(error, songId);
      console.error('[CacheErrorBoundary]', cacheError);
      return cacheError;
    },
    
    onRecover: async (songId: string) => {
      try {
        await audioCacheService.repairCache(songId);
        return true;
      } catch {
        return false;
      }
    },
    
    shouldRetry: (error: AudioCacheError) => {
      return error.recoverable && 
        error.code !== 'PERMISSION_DENIED' && 
        error.code !== 'INVALID_METADATA';
    },
  };
}

// Retry configuration for cache operations
export const CACHE_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

export async function withCacheRetry<T>(
  operation: () => Promise<T>,
  config = CACHE_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffFactor, attempt),
          config.maxDelay
        );
        
        console.warn(`[CacheRetry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
        await new Promise<void>(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}