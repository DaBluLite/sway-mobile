import { SubsonicSong } from '../types/subsonic';
import { audioCacheService } from './audio-cache-service';
import { useAudioCacheStore } from '../stores/audio-cache-store';
import type { PrefetchConfig, NetworkState, PrefetchJob } from '../types/audio-cache';

// Get the underlying store for non-React usage
const audioCacheStore = useAudioCacheStore;

interface PrefetchWorkerOptions {
  getQueue: () => SubsonicSong[];
  getCurrentSongId: () => string | null;
  getCurrentProgress: () => { position: number; duration: number };
  isPlaying: () => boolean;
}

export class PrefetchWorker {
  private static instance: PrefetchWorker;
  private options: PrefetchWorkerOptions | null = null;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private currentPrefetchJobs: Map<string, PrefetchJob> = new Map();
  private lastTriggeredSongId: string | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): PrefetchWorker {
    if (!PrefetchWorker.instance) {
      PrefetchWorker.instance = new PrefetchWorker();
    }
    return PrefetchWorker.instance;
  }

  configure(options: PrefetchWorkerOptions): void {
    this.options = options;
  }

  start(): void {
    if (this.isRunning || this.monitoringInterval) return;

    this.isRunning = true;
    this.monitoringInterval = setInterval(() => {
      this.checkAndPrefetch().catch((error) => {
        console.error('[PrefetchWorker] Check failed:', error);
      });
    }, 2000); // Check every 2 seconds

    console.log('[PrefetchWorker] Started');
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    this.currentPrefetchJobs.clear();
    this.lastTriggeredSongId = null;
    console.log('[PrefetchWorker] Stopped');
  }

  private async checkAndPrefetch(): Promise<void> {
    if (!this.options) return;
    if (!this.isRunning) return;

    const prefetchConfig = audioCacheStore.getState().prefetchConfig;
    if (!prefetchConfig.enabled) return;

    // const networkState = audioCacheService.getNetworkState();
    if (!audioCacheService.canPrefetchOnCurrentNetwork()) {
      return;
    }

    const queue = this.options.getQueue();
    if (queue.length === 0) return;

    const currentSongId = this.options.getCurrentSongId();
    if (!currentSongId) return;

    const progress = this.options.getCurrentProgress();
    if (progress.duration <= 0) return;

    const playbackPercentage = progress.position / progress.duration;
    const triggerThreshold = prefetchConfig.triggerPercentage;

    // Only trigger prefetch when crossing the threshold
    if (playbackPercentage >= triggerThreshold) {
      // Check if we already triggered for this song
      if (this.lastTriggeredSongId === currentSongId) {
        return;
      }

      this.lastTriggeredSongId = currentSongId;
      await this.prefetchNextTracks(queue, currentSongId, prefetchConfig);
    } else if (playbackPercentage < triggerThreshold * 0.5) {
      // Reset trigger when we go back significantly (e.g., seeking backwards)
      if (this.lastTriggeredSongId === currentSongId) {
        this.lastTriggeredSongId = null;
      }
    }
  }

  private async prefetchNextTracks(
    queue: SubsonicSong[],
    currentSongId: string,
    config: PrefetchConfig
  ): Promise<void> {
    const currentIndex = queue.findIndex((s) => s.id === currentSongId);
    if (currentIndex === -1) return;

    // Get next tracks to prefetch
    const nextTracks = queue.slice(currentIndex + 1, currentIndex + 1 + config.prefetchCount);
    if (nextTracks.length === 0) return;

    console.log(`[PrefetchWorker] Prefetching ${nextTracks.length} tracks after ${currentSongId}`);

    // Check active downloads limit
    const activeDownloads = audioCacheStore.getState().getActiveDownloads();
    if (activeDownloads.length >= config.maxConcurrentPrefetches) {
      console.log('[PrefetchWorker] Max concurrent prefetches reached, skipping');
      return;
    }

    // Prefetch each track
    for (const track of nextTracks) {
      // Check if already cached
      const isCached = audioCacheStore.getState().isSongFullyCached(track.id);
      if (isCached) {
        console.log(`[PrefetchWorker] ${track.title} already cached, skipping`);
        continue;
      }

      // Check if already downloading
      const isDownloading = activeDownloads.includes(track.id);
      if (isDownloading) {
        console.log(`[PrefetchWorker] ${track.title} already downloading, skipping`);
        continue;
      }

      // Check network again before each prefetch
      if (!audioCacheService.canPrefetchOnCurrentNetwork()) {
        console.log('[PrefetchWorker] Network conditions changed, stopping prefetch');
        break;
      }

      // Start prefetch
      await this.prefetchTrack(track, config);
    }
  }

  private async prefetchTrack(song: SubsonicSong, config: PrefetchConfig): Promise<void> {
    const jobId = `prefetch-${song.id}`;

    // Check if already in progress
    if (this.currentPrefetchJobs.has(jobId)) return;

    const job: PrefetchJob = {
      songId: song.id,
      priority: Date.now(),
      chunksToPrefetch: 3, // Prefetch first ~768KB (3 * 256KB)
      startedAt: Date.now(),
    };

    this.currentPrefetchJobs.set(jobId, job);
    audioCacheStore.getState().addActiveDownload(song.id);
    audioCacheStore.getState().addToPrefetchQueue(song.id);

    try {
      console.log(`[PrefetchWorker] Starting prefetch for ${song.title} (${song.id})`);

      await audioCacheService.prefetchChunks(
        song.id,
        job.chunksToPrefetch,
        config.chunkSize
      );

      console.log(`[PrefetchWorker] Completed prefetch for ${song.title}`);
    } catch (error) {
      console.error(`[PrefetchWorker] Prefetch failed for ${song.title}:`, error);
    } finally {
      this.currentPrefetchJobs.delete(jobId);
      audioCacheStore.getState().removeActiveDownload(song.id);
      audioCacheStore.getState().removeFromPrefetchQueue(song.id);
    }
  }

  // Manual prefetch trigger (e.g., when user adds to queue)
  async prefetchSpecificTracks(songIds: string[]): Promise<void> {
    const config = audioCacheStore.getState().prefetchConfig;
    if (!config.enabled) return;

    if (!audioCacheService.canPrefetchOnCurrentNetwork()) {
      console.log('[PrefetchWorker] Cannot prefetch - network conditions');
      return;
    }

    for (const songId of songIds) {
      const isCached = audioCacheStore.getState().isSongFullyCached(songId);
      if (isCached) continue;

      const activeDownloads = audioCacheStore.getState().getActiveDownloads();
      if (activeDownloads.includes(songId)) continue;

      // We need to get the song metadata - this would come from the library context
      // For now, just try to prefetch with the ID
      try {
        await audioCacheService.prefetchChunks(songId, 3, config.chunkSize);
      } catch (error) {
        console.error(`[PrefetchWorker] Manual prefetch failed for ${songId}:`, error);
      }
    }
  }

  // Get status for debugging
  getStatus(): {
    isRunning: boolean;
    activeJobs: number;
    queuedSongs: string[];
    lastTriggered: string | null;
  } {
    return {
      isRunning: this.isRunning,
      activeJobs: this.currentPrefetchJobs.size,
      queuedSongs: audioCacheStore.getState().prefetchQueue,
      lastTriggered: this.lastTriggeredSongId,
    };
  }

  // Update network state (called from NetInfo listener)
  onNetworkChange(networkState: NetworkState): void {
    audioCacheService.setNetworkState(networkState);

    // If network becomes available, resume any pending prefetches
    if (networkState.isConnected && this.isRunning) {
      this.checkAndPrefetch().catch(() => {});
    }
  }
}

export const prefetchWorker = PrefetchWorker.getInstance();
