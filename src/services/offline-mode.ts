import { SubsonicSong } from '../types/subsonic';
import { audioCacheService } from './audio-cache-service';
import { useAudioCacheStore } from '../stores/audio-cache-store';
import type { NetworkState } from '../types/audio-cache';

// Get the underlying store for non-React usage
const audioCacheStore = useAudioCacheStore;

export interface OfflineModeState {
  isOffline: boolean;
  availableOfflineSongs: SubsonicSong[];
  lastSyncTime: number;
}

export interface OfflineModeActions {
  checkOfflineAvailability: (songs: SubsonicSong[]) => SubsonicSong[];
  getOfflineQueue: (queue: SubsonicSong[]) => SubsonicSong[];
  getCachedStreamUrl: (songId: string) => Promise<string | null>;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
  isOfflineModeEnabled: () => boolean;
  syncOfflineMetadata: () => Promise<void>;
}

class OfflineModeService implements OfflineModeActions {
  private isOfflineMode = false;
  private networkState: NetworkState = {
    isConnected: true,
    isMetered: false,
    type: 'unknown',
  };

  private static instance: OfflineModeService;

  private constructor() {}

  static getInstance(): OfflineModeService {
    if (!OfflineModeService.instance) {
      OfflineModeService.instance = new OfflineModeService();
    }
    return OfflineModeService.instance;
  }

  setNetworkState(state: NetworkState): void {
    this.networkState = state;
    // Auto-enable offline mode when disconnected
    if (!state.isConnected && !this.isOfflineMode) {
      this.enableOfflineMode();
    } else if (state.isConnected && this.isOfflineMode) {
      this.disableOfflineMode();
    }
  }

  enableOfflineMode(): void {
    this.isOfflineMode = true;
    console.log('[OfflineMode] Offline mode enabled');
  }

  disableOfflineMode(): void {
    this.isOfflineMode = false;
    console.log('[OfflineMode] Offline mode disabled');
  }

  isOfflineModeEnabled(): boolean {
    return this.isOfflineMode || !this.networkState.isConnected;
  }

  checkOfflineAvailability(songs: SubsonicSong[]): SubsonicSong[] {
    const cachedIds = audioCacheStore.getState().getCachedSongIds();
    const cachedSet = new Set(cachedIds);
    return songs.filter((song) => cachedSet.has(song.id));
  }

  getOfflineQueue(queue: SubsonicSong[]): SubsonicSong[] {
    return this.checkOfflineAvailability(queue);
  }

  async getCachedStreamUrl(songId: string): Promise<string | null> {
    // First verify cache integrity
    const isValid = await audioCacheService.verifyCacheIntegrity(songId);
    if (!isValid) {
      console.warn(`[OfflineMode] Cache invalid for ${songId}, attempting repair`);
      await audioCacheService.repairCache(songId);
      return null;
    }

    return audioCacheService.getCachedFileUrl(songId);
  }

  async syncOfflineMetadata(): Promise<void> {
    // Clean up orphaned metadata
    await audioCacheService.cleanupOrphanedMetadata();

    // Update cache statistics
    await audioCacheService.updateCacheStatistics();

    // Check and evict if needed
    await audioCacheService.checkAndEvictIfNeeded();
  }

  getOfflineState(songs: SubsonicSong[], _: SubsonicSong[]): OfflineModeState {
    const availableOffline = this.checkOfflineAvailability(songs);
    // const offlineQueue = this.getOfflineQueue(queue);

    return {
      isOffline: this.isOfflineModeEnabled(),
      availableOfflineSongs: availableOffline,
      lastSyncTime: Date.now(),
    };
  }

  // Filter library to show only cached content
  filterLibraryForOffline(allSongs: SubsonicSong[]): SubsonicSong[] {
    if (!this.isOfflineModeEnabled()) {
      return allSongs;
    }
    return this.checkOfflineAvailability(allSongs);
  }

  // Filter queue to show only playable offline tracks
  filterQueueForOffline(queue: SubsonicSong[]): SubsonicSong[] {
    if (!this.isOfflineModeEnabled()) {
      return queue;
    }
    return this.getOfflineQueue(queue);
  }

  // Get offline-capable recommendations
  getOfflineRecommendations(
    seedSongs: SubsonicSong[],
    allSongs: SubsonicSong[],
    count: number = 10
  ): SubsonicSong[] {
    const cachedSongs = this.checkOfflineAvailability(allSongs);
    const seedIds = new Set(seedSongs.map(s => s.id));

    // Simple recommendation: return cached songs not in seed, prioritizing by artist match
    const recommendations = cachedSongs
      .filter(s => !seedIds.has(s.id))
      .sort((a, b) => {
        // Prioritize same artist as seed songs
        const aMatches = seedSongs.some(s => s.artist === a.artist) ? 1 : 0;
        const bMatches = seedSongs.some(s => s.artist === b.artist) ? 1 : 0;
        return bMatches - aMatches;
      })
      .slice(0, count);

    return recommendations;
  }
}

export const offlineModeService = OfflineModeService.getInstance();
