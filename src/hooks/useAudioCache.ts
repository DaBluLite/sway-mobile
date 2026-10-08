import { useEffect, useCallback, useRef } from 'react';
import { SubsonicSong } from '../types/subsonic';
import { audioCacheService } from '../services/audio-cache-service';
import { prefetchWorker } from '../services/prefetch-worker';
import { offlineModeService } from '../services/offline-mode';
import { useAudioCacheStore } from '../stores/audio-cache-store';
import { useAudioPlayer } from '../contexts/audio-player-context';
import type { NetworkState } from '../types/audio-cache';

// Try to import NetInfo, fallback to basic online detection
let NetInfo: any = null;
try {
  NetInfo = require('@react-native-community/netinfo');
} catch {
  console.warn('[useAudioCache] @react-native-community/netinfo not available, using basic online detection');
}

export function useAudioCache() {
  const {
    queue,
    currentSongId,
    currentTime,
    duration,
    isPlaying,
  } = useAudioPlayer();

  const {
    config,
    prefetchConfig,
    totalCacheSize,
    availableSpace,
    networkState: storedNetworkState,
    isSongFullyCached,
    getCachedSongIds,
    getCachedSongs,
  } = useAudioCacheStore();

  const isInitialized = useRef(false);
  const workerConfigured = useRef(false);

  // Initialize cache service
  useEffect(() => {
    if (isInitialized.current) return;
    
    const init = async () => {
      try {
        await audioCacheService.initialize();
        await audioCacheService.updateCacheStatistics();
        await offlineModeService.syncOfflineMetadata();
        isInitialized.current = true;
      } catch (error) {
        console.error('[useAudioCache] Initialization failed:', error);
      }
    };
    
    init();
  }, []);

  // Configure prefetch worker with audio player data
  useEffect(() => {
    if (workerConfigured.current) return;
    
    prefetchWorker.configure({
      getQueue: () => queue,
      getCurrentSongId: () => currentSongId,
      getCurrentProgress: () => ({ position: currentTime, duration }),
      isPlaying: () => isPlaying,
    });
    
    workerConfigured.current = true;
  }, [queue, currentSongId, currentTime, duration, isPlaying]);

  // Start/stop prefetch worker based on playback state
  useEffect(() => {
    if (isPlaying && queue.length > 0) {
      prefetchWorker.start();
    } else {
      prefetchWorker.stop();
    }
    
    return () => {
      prefetchWorker.stop();
    };
  }, [isPlaying, queue.length]);

  // Network monitoring
  useEffect(() => {
    if (!NetInfo) {
      // Fallback: assume online
      const networkState: NetworkState = {
        isConnected: true,
        isMetered: false,
        type: 'unknown',
      };
      audioCacheService.setNetworkState(networkState);
      offlineModeService.setNetworkState(networkState);
      useAudioCacheStore.getState().setNetworkState(networkState);
      return;
    }

    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const networkState: NetworkState = {
        isConnected: state.isConnected ?? false,
        isMetered: state.isConnectionExpensive ?? false,
        type: state.type === 'cellular' ? 'cellular' : 
              state.type === 'wifi' ? 'wifi' : 
              state.type === 'ethernet' ? 'ethernet' : 'unknown',
      };
      
      audioCacheService.setNetworkState(networkState);
      offlineModeService.setNetworkState(networkState);
      useAudioCacheStore.getState().setNetworkState(networkState);
    });
    
    return unsubscribe;
  }, []);

  // Periodic cache maintenance
  useEffect(() => {
    const interval = setInterval(async () => {
      await audioCacheService.updateCacheStatistics();
      await audioCacheService.checkAndEvictIfNeeded();
      await offlineModeService.syncOfflineMetadata();
    }, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, []);

  // Cache management functions
  const cacheSong = useCallback(async (song: SubsonicSong): Promise<string> => {
    return audioCacheService.streamAndCacheChunked(song.id);
  }, []);

  const prefetchSong = useCallback(async (songId: string): Promise<void> => {
    await audioCacheService.prefetchChunks(songId, 3, prefetchConfig.chunkSize);
  }, [prefetchConfig.chunkSize]);

  const removeFromCache = useCallback(async (songId: string): Promise<boolean> => {
    return audioCacheService.evictSong(songId);
  }, []);

  const clearCache = useCallback(async (): Promise<void> => {
    const cachedIds = getCachedSongIds();
    for (const songId of cachedIds) {
      await audioCacheService.evictSong(songId);
    }
  }, [getCachedSongIds]);

  const getOfflineQueue = useCallback((currentQueue: SubsonicSong[]): SubsonicSong[] => {
    return offlineModeService.getOfflineQueue(currentQueue);
  }, []);

  const getOfflineLibrary = useCallback((library: SubsonicSong[]): SubsonicSong[] => {
    return offlineModeService.filterLibraryForOffline(library);
  }, []);

  const getCachedStreamUrl = useCallback(async (songId: string): Promise<string | null> => {
    return offlineModeService.getCachedStreamUrl(songId);
  }, []);

  const isAvailableOffline = useCallback((songId: string): boolean => {
    return isSongFullyCached(songId);
  }, [isSongFullyCached]);

  return {
    // State
    cacheSize: totalCacheSize,
    availableSpace,
    networkState: storedNetworkState,
    isOffline: offlineModeService.isOfflineModeEnabled(),
    prefetchConfig,
    cacheConfig: config,
    
    // Cache status
    isSongCached: isAvailableOffline,
    getCachedSongs,
    getCachedSongIds,
    
    // Actions
    cacheSong,
    prefetchSong,
    removeFromCache,
    clearCache,
    getOfflineQueue,
    getOfflineLibrary,
    getCachedStreamUrl,
    
    // Services (for advanced usage)
    audioCacheService,
    prefetchWorker,
    offlineModeService,
  };
}

// Hook for offline mode specifically
export function useOfflineMode(library: SubsonicSong[], queue: SubsonicSong[]) {
  const offlineState = offlineModeService.getOfflineState(library, queue);
  const offlineQueue = offlineModeService.getOfflineQueue(queue);
  const offlineLibrary = offlineModeService.filterLibraryForOffline(library);

  return {
    isOffline: offlineState.isOffline,
    offlineQueue,
    offlineLibrary,
    availableOfflineSongs: offlineState.availableOfflineSongs,
    lastSyncTime: offlineState.lastSyncTime,
    getOfflineRecommendations: offlineModeService.getOfflineRecommendations.bind(offlineModeService),
  };
}