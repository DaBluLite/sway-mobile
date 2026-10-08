import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { SubsonicService } from '../services/subsonic-service';
import type {
  SubsonicCredentials,
} from '../types/subsonic';
import type {
  CacheMetadata,
  CacheProgress,
  ChunkedStreamOptions,
  NetworkState,
} from '../types/audio-cache';
import { useAudioCacheStore } from '../stores/audio-cache-store';

// Get the underlying store for non-React usage
const audioCacheStore = useAudioCacheStore;

const CACHE_DIR = `${RNFS.CachesDirectoryPath}/audio-cache`;
// const METADATA_FILE = `${CACHE_DIR}/metadata.json`;

interface AudioFileInfo {
  filePath: string;
  size: number;
  exists: boolean;
}

export class AudioCacheService {
  private static instance: AudioCacheService;
  private subsonicService: SubsonicService;
  private credentials: SubsonicCredentials | null = null;
  private abortControllers: Map<string, AbortController> = new Map();
  private isInitialized = false;

  private constructor() {
    this.subsonicService = new SubsonicService();
  }

  static getInstance(): AudioCacheService {
    if (!AudioCacheService.instance) {
      AudioCacheService.instance = new AudioCacheService();
    }
    return AudioCacheService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ensure cache directory exists
      const exists = await RNFS.exists(CACHE_DIR);
      if (!exists) {
        await RNFS.mkdir(CACHE_DIR);
      }

      // Load credentials from SubsonicService
      const status = await this.subsonicService.getCredentialsStatus();
      if (status.configured && status.username) {
        // We need to get the actual credentials - this is a limitation
        // The service stores them internally, we'll need to access them differently
        // For now, we'll generate stream URLs using the service
      }

      this.isInitialized = true;
      console.log('[AudioCacheService] Initialized successfully');
    } catch (error) {
      console.error('[AudioCacheService] Initialization failed:', error);
      throw error;
    }
  }

  setCredentials(credentials: SubsonicCredentials): void {
    this.credentials = credentials;
  }

  private getStreamUrl(songId: string): string | null {
    return this.subsonicService.generateStreamUrl(songId);
  }

  private getCacheFilePath(songId: string): string {
    return `${CACHE_DIR}/${songId}.cache`;
  }

  private getMetadataFilePath(songId: string): string {
    return `${CACHE_DIR}/${songId}.meta.json`;
  }

  async ensureCacheDirectory(): Promise<void> {
    const exists = await RNFS.exists(CACHE_DIR);
    if (!exists) {
      await RNFS.mkdir(CACHE_DIR);
    }
  }

  async getAudioFileInfo(songId: string): Promise<AudioFileInfo> {
    const filePath = this.getCacheFilePath(songId);
    const exists = await RNFS.exists(filePath);
    if (exists) {
      const stat = await RNFS.stat(filePath);
      return { filePath, size: stat.size, exists: true };
    }
    return { filePath, size: 0, exists: false };
  }

  async saveMetadata(metadata: CacheMetadata): Promise<void> {
    const filePath = this.getMetadataFilePath(metadata.songId);
    await RNFS.writeFile(filePath, JSON.stringify(metadata), 'utf8');
  }

  async loadMetadata(songId: string): Promise<CacheMetadata | null> {
    const filePath = this.getMetadataFilePath(songId);
    const exists = await RNFS.exists(filePath);
    if (!exists) return null;
    try {
      const content = await RNFS.readFile(filePath, 'utf8');
      return JSON.parse(content) as CacheMetadata;
    } catch (error) {
      console.error(`[AudioCacheService] Failed to load metadata for ${songId}:`, error);
      return null;
    }
  }

  async deleteMetadata(songId: string): Promise<void> {
    const filePath = this.getMetadataFilePath(songId);
    const exists = await RNFS.exists(filePath);
    if (exists) {
      await RNFS.unlink(filePath);
    }
  }

  async deleteAudioFile(songId: string): Promise<void> {
    const filePath = this.getCacheFilePath(songId);
    const exists = await RNFS.exists(filePath);
    if (exists) {
      await RNFS.unlink(filePath);
    }
  }

  async deleteAllCacheFiles(songId: string): Promise<void> {
    await Promise.all([
      this.deleteAudioFile(songId),
      this.deleteMetadata(songId),
    ]);
  }

  async streamAndCacheChunked(
    songId: string,
    options: Partial<ChunkedStreamOptions> = {}
  ): Promise<string> {
    const streamUrl = this.getStreamUrl(songId);
    if (!streamUrl) {
      throw new Error('No stream URL available - check Subsonic credentials');
    }

    const signal = options.signal;
    const filePath = this.getCacheFilePath(songId);

    // Check if already fully cached
    const existingMeta = await this.loadMetadata(songId);
    if (existingMeta?.isComplete) {
      const fileInfo = await this.getAudioFileInfo(songId);
      if (fileInfo.exists && fileInfo.size === existingMeta.size) {
        return filePath;
      }
    }

    const abortController = new AbortController();
    this.abortControllers.set(songId, abortController);
    const effectiveSignal = signal ?? abortController.signal;

    const progress: CacheProgress = {
      songId,
      progress: 0,
      bytesCached: 0,
      totalBytes: 0,
      status: 'downloading',
    };
    audioCacheStore.getState().setProgress(progress);

    const tmpPath = `${filePath}.tmp`;
    let totalBytes = 0;
    let contentType = 'audio/mpeg';
    let jobId = -1;

    try {
      await this.ensureCacheDirectory();
      // Remove stale tmp
      if (await RNFS.exists(tmpPath)) await RNFS.unlink(tmpPath).catch(() => {});

      const job = RNFS.downloadFile({
        fromUrl: streamUrl,
        toFile: tmpPath,
        background: false,
        discretionary: false,
        progressDivider: 1,
        begin: (res: any) => {
          totalBytes = res.contentLength ?? 0;
          if (res.headers && res.headers['Content-Type']) contentType = res.headers['Content-Type'];
          audioCacheStore.getState().setProgress({ ...progress, totalBytes });
        },
        progress: (res: any) => {
          const bytesWritten = res.bytesWritten ?? 0;
          totalBytes = res.contentLength ?? totalBytes;
          const p = totalBytes > 0 ? bytesWritten / totalBytes : 0;
          audioCacheStore.getState().setProgress({
            songId,
            progress: p,
            bytesCached: bytesWritten,
            totalBytes,
            status: 'downloading',
          });
          options.onProgress?.(p);
        },
      } as any);
      jobId = (job as any).jobId ?? -1;

      const abortHandler = () => {
        try { if (jobId !== -1) RNFS.stopDownload(jobId); } catch {}
      };
      if (effectiveSignal.aborted) abortHandler();
      else effectiveSignal.addEventListener?.('abort', abortHandler);

      const result: any = await (job as any).promise;
      try { effectiveSignal.removeEventListener?.('abort', abortHandler); } catch {}

      if (result.statusCode !== 200 && result.statusCode !== 206) {
        throw new Error(`HTTP ${result.statusCode}`);
      }

      // Move tmp to final (atomic)
      if (await RNFS.exists(filePath)) await RNFS.unlink(filePath).catch(() => {});
      await RNFS.moveFile(tmpPath, filePath);

      const stat = await RNFS.stat(filePath);
      const bytesReceived = stat.size;

      const metadata: CacheMetadata = {
        songId,
        title: '',
        artist: '',
        album: '',
        coverArt: '',
        duration: 0,
        contentType,
        size: stat.size,
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        isComplete: true,
        totalChunks: 1,
        cachedChunks: [0],
        filePath,
      };

      await this.saveMetadata(metadata);
      audioCacheStore.getState().setCacheMetadata(metadata);
      audioCacheStore.getState().setProgress({
        songId,
        progress: 1,
        bytesCached: bytesReceived,
        totalBytes: totalBytes || bytesReceived,
        status: 'completed',
      });

      options.onComplete?.(filePath);
      this.abortControllers.delete(songId);
      return filePath;
    } catch (error) {
      // Cleanup tmp
      await RNFS.unlink(tmpPath).catch(() => {});
      if (error instanceof Error && (error.name === 'AbortError' || (effectiveSignal as any)?.aborted)) {
        audioCacheStore.getState().setProgress({
          songId,
          progress: 0,
          bytesCached: 0,
          totalBytes: 0,
          status: 'paused',
        });
      } else {
        audioCacheStore.getState().setProgress({
          songId,
          progress: 0,
          bytesCached: 0,
          totalBytes: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        await this.deleteAudioFile(songId).catch(() => {});
      }
      this.abortControllers.delete(songId);
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async prefetchChunks(
    songId: string,
    chunkCount: number,
    chunkSize: number = 262144
  ): Promise<void> {
    const streamUrl = this.getStreamUrl(songId);
    if (!streamUrl) {
      throw new Error('No stream URL available');
    }

    const existingMeta = await this.loadMetadata(songId);
    if (existingMeta?.isComplete) return;

    const abortController = new AbortController();
    this.abortControllers.set(`prefetch-${songId}`, abortController);

    const filePath = this.getCacheFilePath(songId);
    const tmpPath = `${filePath}.tmp`;
    try {
      const endByte = chunkCount * chunkSize - 1;
      await this.ensureCacheDirectory();
      if (await RNFS.exists(tmpPath)) await RNFS.unlink(tmpPath).catch(() => {});

      const job: any = RNFS.downloadFile({
        fromUrl: streamUrl,
        toFile: tmpPath,
        headers: { Range: `bytes=0-${endByte}` },
        background: false,
        discretionary: false,
      } as any);

      const abortHandler = () => {
        try { RNFS.stopDownload(job.jobId); } catch {}
      };
      abortController.signal.addEventListener?.('abort', abortHandler);

      const result: any = await job.promise;
      try { abortController.signal.removeEventListener?.('abort', abortHandler); } catch {}

      if (result.statusCode !== 200 && result.statusCode !== 206) {
        throw new Error(`HTTP ${result.statusCode}`);
      }

      if (await RNFS.exists(filePath)) await RNFS.unlink(filePath).catch(() => {});
      await RNFS.moveFile(tmpPath, filePath);
      const stat = await RNFS.stat(filePath);
      const bytesReceived = stat.size;

      const metadata: CacheMetadata = {
        songId,
        title: '',
        artist: '',
        album: '',
        coverArt: '',
        duration: 0,
        contentType: 'audio/mpeg',
        size: bytesReceived,
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        isComplete: false,
        totalChunks: Math.ceil((existingMeta?.size || bytesReceived) / chunkSize),
        cachedChunks: Array.from({ length: chunkCount }, (_, i) => i),
        filePath,
      };

      await this.saveMetadata(metadata);
      audioCacheStore.getState().setCacheMetadata(metadata);
    } catch (error) {
      await RNFS.unlink(tmpPath).catch(() => {});
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error(`[AudioCacheService] Prefetch failed for ${songId}:`, error);
      }
      await this.deleteAudioFile(songId).catch(() => {});
    } finally {
      this.abortControllers.delete(`prefetch-${songId}`);
    }
  }

  abortDownload(songId: string): void {
    const controller = this.abortControllers.get(songId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(songId);
    }
    const prefetchController = this.abortControllers.get(`prefetch-${songId}`);
    if (prefetchController) {
      prefetchController.abort();
      this.abortControllers.delete(`prefetch-${songId}`);
    }
  }

  abortAllDownloads(): void {
    this.abortControllers.forEach((controller) => controller.abort());
    this.abortControllers.clear();
  }

  async getCachedFileUrl(songId: string): Promise<string | null> {
    const fileInfo = await this.getAudioFileInfo(songId);
    if (fileInfo.exists) {
      // Return file:// URL for local playback
      return Platform.OS === 'ios'
        ? `file://${fileInfo.filePath}`
        : fileInfo.filePath;
    }
    return null;
  }

  async getCacheSize(): Promise<number> {
    try {
      const files = await RNFS.readDir(CACHE_DIR);
      let totalSize = 0;
      for (const file of files) {
        if (file.isFile() && (file.name.endsWith('.cache') || file.name.endsWith('.meta.json'))) {
          totalSize += file.size;
        }
      }
      return totalSize;
    } catch {
      return 0;
    }
  }

  async getAvailableSpace(): Promise<number> {
    try {
      // Use RNFS to get free space
      const fsInfo = await RNFS.getFSInfo();
      return fsInfo.freeSpace;
    } catch {
      return 0;
    }
  }

  async updateCacheStatistics(): Promise<void> {
    const [totalSize, availableSpace] = await Promise.all([
      this.getCacheSize(),
      this.getAvailableSpace(),
    ]);
    audioCacheStore.getState().updateCacheSize(totalSize);
    audioCacheStore.getState().setAvailableSpace(availableSpace);
  }

  async checkAndEvictIfNeeded(): Promise<void> {
    const state = audioCacheStore.getState();
    const config = state.config;
    const totalSize = state.totalCacheSize;
    const availableSpace = state.availableSpace;

    // Check if we need to evict based on max size
    const maxSize = Math.min(
      config.maxSizeBytes,
      Math.floor(availableSpace * config.maxSizePercentage)
    );

    if (totalSize > maxSize) {
      const bytesNeeded = totalSize - maxSize + config.minFreeSpaceBytes;
      await state.evictLeastRecentlyUsed(bytesNeeded);
      await this.updateCacheStatistics();
    }

    // Also check minimum free space
    if (availableSpace < config.minFreeSpaceBytes) {
      const bytesNeeded = config.minFreeSpaceBytes - availableSpace + 104857600; // +100MB buffer
      await state.evictLeastRecentlyUsed(bytesNeeded);
      await this.updateCacheStatistics();
    }
  }

  async evictSong(songId: string): Promise<boolean> {
    try {
      await this.deleteAllCacheFiles(songId);
      audioCacheStore.getState().evictSong(songId);
      await this.updateCacheStatistics();
      return true;
    } catch (error) {
      console.error(`[AudioCacheService] Failed to evict ${songId}:`, error);
      return false;
    }
  }

  async verifyCacheIntegrity(songId: string): Promise<boolean> {
    try {
      const metadata = await this.loadMetadata(songId);
      if (!metadata) return false;
      if (!metadata.isComplete) return false;

      const fileInfo = await this.getAudioFileInfo(songId);
      if (!fileInfo.exists) return false;
      if (fileInfo.size !== metadata.size) return false;

      // Could add checksum verification here
      return true;
    } catch {
      return false;
    }
  }

  async repairCache(songId: string): Promise<boolean> {
    // Delete corrupted cache and re-download
    await this.deleteAllCacheFiles(songId);
    audioCacheStore.getState().deleteCacheMetadata(songId);
    audioCacheStore.getState().clearProgress(songId);
    return true;
  }

  getNetworkState(): NetworkState {
    // This would ideally come from a network monitoring library
    // For now, return a default - the app should update this via NetInfo
    return audioCacheStore.getState().networkState;
  }

  setNetworkState(state: NetworkState): void {
    audioCacheStore.getState().setNetworkState(state);
  }

  canPrefetchOnCurrentNetwork(): boolean {
    const networkState = this.getNetworkState();
    const prefetchConfig = audioCacheStore.getState().prefetchConfig;

    if (!networkState.isConnected) return false;
    if (networkState.isMetered && !prefetchConfig.cellularAllowed) return false;
    return true;
  }

  async cleanupOrphanedMetadata(): Promise<number> {
    let cleaned = 0;
    try {
      const files = await RNFS.readDir(CACHE_DIR);
      const metaFiles = files.filter(f => f.name.endsWith('.meta.json'));
      const results = await Promise.all(
        metaFiles.map(async file => {
          const songId = file.name.replace('.meta.json', '');
          const audioFile = `${CACHE_DIR}/${songId}.cache`;
          const [audioExists, metadata] = await Promise.all([
            RNFS.exists(audioFile),
            this.loadMetadata(songId),
          ]);
          if (metadata && metadata.isComplete && !audioExists) {
            await this.deleteMetadata(songId);
            audioCacheStore.getState().deleteCacheMetadata(songId);
            return 1;
          }
          return 0;
        }),
      );
      cleaned = results.reduce((a, b) => Math.min(a + b, 1) as 0 | 1, 0);
    } catch (error) {
      console.error('[AudioCacheService] Cleanup failed:', error);
    }
    return cleaned;
  }
}

export const audioCacheService = AudioCacheService.getInstance();
