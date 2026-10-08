import {
  SubsonicCredentials,
  SubsonicCommandResult,
  SubsonicConfig,
  DEFAULT_SUBSONIC_CONFIG,
  SubsonicError,
  SubsonicSong,
  ISubsonicService,
  SubsonicSearchCommand,
  SubsonicSearchResult,
} from '../types/subsonic';
import crypto from 'react-native-quick-crypto';
import { deleteItem, getItem, setItem, STORES } from '../utils/storage';

async function fetchJsonChecked(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new SubsonicError(`HTTP ${response.status}: ${response.statusText}`, 'API_ERROR');
  }
  return response;
}

/**
 * Generates a random salt string.
 * - Default length: 12
 * - Enforces a minimum length of 6 characters
 * - Uses hex encoding (2 chars per byte)
 */
export function generateSalt(length = 12): string {
  const safeLen = Math.max(6, Math.floor(length));

  // hex encoding produces 2 characters per byte, so we need ceil(len / 2) bytes
  const bytes = Math.ceil(safeLen / 2);

  return crypto.randomBytes(bytes).toString('hex').slice(0, safeLen);
}

/**
 * Returns the MD5 hex digest of the input.
 */
export function md5(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

export class SubsonicService implements ISubsonicService {
  private credentialsChangedCallbacks = new Set<
    (status: { configured: boolean; username?: string }) => void
  >();

  private store: {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
    delete: (key: string) => void;
  };
  private credentials: SubsonicCredentials | null = null;
  private config: SubsonicConfig;
  private registeredWindows: Set<number> = new Set();

  constructor() {
    this.config = DEFAULT_SUBSONIC_CONFIG;

    // Initialize electron-store for persistent storage
    this.store = {
      get: (key: string) => {
        return getItem(STORES.SUBSONIC_SERVICE, key);
      },
      set: (key: string, value: any) => {
        setItem(STORES.SUBSONIC_SERVICE, key, value);
      },
      delete: (key: string) => {
        deleteItem(STORES.SUBSONIC_SERVICE, key);
      },
    };

    // Load credentials from store
    this.loadCredentials();
  }

  /**
   * Load credentials from persistent storage
   */
  private loadCredentials(): void {
    try {
      const storedData = this.store.get('credentials') as
        | Record<string, unknown>
        | undefined;
      if (storedData && typeof storedData === 'object') {
        const creds = storedData as Record<string, unknown>;
        // Decrypt sensitive fields using safeStorage
        const decryptedPassword = creds.hashedPassword;
        const decryptedSalt = creds.passwordSalt;

        this.credentials = {
          username: creds.username as string,
          serverUrl: creds.serverUrl as string,
          hashedPassword: decryptedPassword as string,
          passwordSalt: decryptedSalt as string,
        };
      }
    } catch (error) {
      console.error('Failed to load Subsonic credentials:', error);
      this.credentials = null;
    } finally {
      this.emitCredentialsChanged();
    }
  }

  /**
   * Save credentials to persistent storage with encryption
   */
  private async saveCredentials(): Promise<void> {
    try {
      if (!this.credentials) {
        this.store.delete('credentials');
        return;
      }

      // Encrypt sensitive fields using safeStorage
      const encryptedPassword = this.credentials.hashedPassword;
      const encryptedSalt = this.credentials.passwordSalt;

      this.store.set('credentials', {
        username: this.credentials.username,
        serverUrl: this.credentials.serverUrl,
        hashedPassword: encryptedPassword,
        passwordSalt: encryptedSalt,
      });
    } catch {
      throw new SubsonicError(
        'Failed to save credentials to storage',
        'STORAGE_ERROR',
      );
    }
  }

  /**
   * Set Subsonic credentials
   */
  async setCredentials(
    username: string,
    password: string,
    serverUrl: string,
  ): Promise<SubsonicCommandResult> {
    // Validate server URL
    if (!this.validateServerUrl(serverUrl)) {
      throw new SubsonicError('Invalid server URL format', 'INVALID_URL');
    }

    // Normalize server URL (remove trailing slash)
    const normalizedUrl = serverUrl.replace(/\/$/, '');

    // Generate a permanent salt for this password
    const salt = generateSalt(12);

    // Hash the password with the salt
    const hashedPassword = md5(password + salt);

    try {
      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: salt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        f: 'json',
      });

      const apiUrl = `${normalizedUrl}/rest/ping?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok') {
        throw new SubsonicError('Ping failed', 'API_ERROR');
      }

      // Store credentials
      this.credentials = {
        username,
        serverUrl: normalizedUrl,
        hashedPassword,
        passwordSalt: salt,
      };

      await this.saveCredentials();
      this.emitCredentialsChanged();

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Ping failed';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic ping error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  /**
   * Clear stored credentials
   */
  async clearCredentials(): Promise<SubsonicCommandResult> {
    this.credentials = null;
    try {
      await this.saveCredentials();
      this.emitCredentialsChanged();
      return { success: true };
    } catch {
      throw new SubsonicError('Failed to clear credentials', 'STORAGE_ERROR');
    }
  }

  /**
   * Check if credentials are configured
   */
  hasCredentials(): boolean {
    return this.credentials !== null;
  }

  /**
   * Get credentials status
   */
  async getCredentialsStatus(): Promise<{
    configured: boolean;
    username?: string;
  }> {
    if (!this.credentials) {
      return { configured: false };
    }

    return {
      configured: true,
      username: this.credentials.username,
    };
  }

  async getNewlyAddedAlbums(
    options: { size: string; offset: string } = { size: '10', offset: '0' },
  ): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        type: 'newest',
        f: 'json',
        ...options,
      });

      const apiUrl = `${serverUrl}/rest/getAlbumList2?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok' || !subsonicResponse.albumList2) {
        throw new SubsonicError(
          'Failed to parse newly added albums',
          'API_ERROR',
        );
      }

      const albumList = subsonicResponse.albumList2.album;

      return {
        success: true,
        data: albumList,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch newly added albums';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic getNewlyAddedAlbums error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  get username() {
    return this.credentials?.username || null;
  }

  async ping(): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        f: 'json',
      });

      const apiUrl = `${serverUrl}/rest/ping?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok') {
        throw new SubsonicError('Ping failed', 'API_ERROR');
      }

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Ping failed';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic ping error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  private async fetchSongs(
    endpoint: string,
    params: Record<string, string>,
    extract: (res: Record<string, unknown>) => SubsonicSong[],
  ): Promise<SubsonicSong[]> {
    if (!this.credentials) return [];

    const { serverUrl, username, hashedPassword, passwordSalt } =
      this.credentials;

    const urlParams = new URLSearchParams({
      u: username,
      t: hashedPassword,
      s: passwordSalt,
      c: this.config.clientName,
      v: this.config.apiVersion,
      f: 'json',
      ...params,
    });

    const apiUrl = `${serverUrl}/rest/${endpoint}?${urlParams.toString()}`;
    const response = await fetchJsonChecked(apiUrl);
    const res = await response.json();
    const subsonicResponse = res['subsonic-response'];

    if (subsonicResponse.status !== 'ok') return [];
    return extract(subsonicResponse);
  }

  async getSimilarSongs2(id: string, count = 50): Promise<SubsonicSong[]> {
    try {
      return await this.fetchSongs(
        'getSimilarSongs2',
        { id, count: String(count) },
        res => {
          const similar = (res as { similarSongs2?: { song?: SubsonicSong[] } })
            .similarSongs2;
          return similar?.song ?? [];
        },
      );
    } catch {
      return [];
    }
  }

  async getSongsByGenre(genre: string, count = 50): Promise<SubsonicSong[]> {
    try {
      return await this.fetchSongs(
        'getSongsByGenre',
        { genre, count: String(count) },
        res => {
          const byGenre = (res as { songsByGenre?: { song?: SubsonicSong[] } })
            .songsByGenre;
          return byGenre?.song ?? [];
        },
      );
    } catch {
      return [];
    }
  }

  async getTopSongs(artist: string, count = 50): Promise<SubsonicSong[]> {
    try {
      return await this.fetchSongs(
        'getTopSongs',
        { artist, count: String(count) },
        res => {
          const top = (res as { topSongs?: { song?: SubsonicSong[] } }).topSongs;
          return top?.song ?? [];
        },
      );
    } catch {
      return [];
    }
  }

  async getRandomSongs(count = 50): Promise<SubsonicSong[]> {
    try {
      return await this.fetchSongs(
        'getRandomSongs',
        { count: String(count) },
        res => {
          const random = (res as { randomSongs?: { song?: SubsonicSong[] } })
            .randomSongs;
          return random?.song ?? [];
        },
      );
    } catch {
      return [];
    }
  }

  async getGenres(): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        f: 'json',
      });

      const apiUrl = `${serverUrl}/rest/getGenres?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (
        subsonicResponse.status !== 'ok' ||
        !subsonicResponse.genres ||
        !Array.isArray(subsonicResponse.genres.genre)
      ) {
        throw new SubsonicError('Failed to fetch genres', 'API_ERROR');
      }

      return {
        success: true,
        data: subsonicResponse.genres.genre as string[],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch genres';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic getGenres error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  /**
   * Validate server URL format
   */
  validateServerUrl(serverUrl: string): boolean {
    try {
      const url = new URL(serverUrl);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Generate a stream URL for a song
   */
  generateStreamUrl(songId: string): string | null {
    if (!this.credentials) {
      return null;
    }

    if (!songId || songId.trim() === '') {
      return null;
    }

    const { serverUrl, username, hashedPassword, passwordSalt } =
      this.credentials;

    // Build the stream endpoint URL
    const params = new URLSearchParams({
      u: username,
      t: hashedPassword,
      s: passwordSalt,
      c: this.config.clientName,
      v: this.config.apiVersion,
      id: songId,
      format: 'raw',
    });

    return `${serverUrl}/rest/stream?${params.toString()}`;
  }

  async scrobble(
    songId: string,
    submission: boolean,
  ): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      if (!songId || songId.trim() === '') {
        throw new SubsonicError('Invalid song ID provided', 'INVALID_SONG_ID');
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        id: songId,
        f: 'json',
        submission: String(submission),
      });

      const apiUrl = `${serverUrl}/rest/scrobble?${params.toString()}`;

      // Fetch song metadata
      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok' || !subsonicResponse.albumList2) {
        throw new SubsonicError('Failed to scrobble song', 'API_ERROR');
      }

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to scrobble song';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic scrobble error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  /**
   * Returns a cover art image URL.
   */
  getCoverArtUrl(id: string, size?: number): string | null {
    if (!this.credentials) {
      return null;
    }

    if (!id || id.trim() === '') {
      return null;
    }

    const { serverUrl, username, hashedPassword, passwordSalt } =
      this.credentials;

    // Build the stream endpoint URL
    const params = new URLSearchParams({
      u: username,
      t: hashedPassword,
      s: passwordSalt,
      c: this.config.clientName,
      v: this.config.apiVersion,
      id,
      size: size ? size.toString() : '',
    });

    return `${serverUrl}/rest/getCoverArt?${params.toString()}`;
  }

  async getMostPlayed(
    options: { offset: string; size: string } = { offset: '0', size: '10' },
  ): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      // Build the getSong endpoint URL
      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        type: 'frequent',
        f: 'json',
        ...options,
      });

      const apiUrl = `${serverUrl}/rest/getAlbumList2?${params.toString()}`;

      // Fetch song metadata
      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok' || !subsonicResponse.albumList2) {
        throw new SubsonicError('Failed to parse song metadata', 'API_ERROR');
      }

      const albumList = subsonicResponse.albumList2;

      if (!albumList) {
        throw new SubsonicError('Failed to parse song metadata', 'API_ERROR');
      }

      return {
        success: true,
        data: albumList,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch song metadata';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic getSong error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async getRandomAlbums(
    options: { size: string } = { size: '10' },
  ): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        type: 'random',
        f: 'json',
        ...options,
      });

      const apiUrl = `${serverUrl}/rest/getAlbumList2?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok' || !subsonicResponse.albumList2) {
        throw new SubsonicError('Failed to parse random albums', 'API_ERROR');
      }

      const albumList = subsonicResponse.albumList2.album;

      return {
        success: true,
        data: albumList,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch random albums';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic getRandomAlbums error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async search(options: SubsonicSearchCommand): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      if (!options.query || options.query.trim() === '') {
        return { success: true, data: { song: [], album: [], artist: [] } };
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        query: options.query,
        songCount: (options.size || 20).toString(),
        albumCount: (options.size || 20).toString(),
        artistCount: (options.size || 20).toString(),
        songOffset: (options.offset || 0).toString(),
        albumOffset: (options.offset || 0).toString(),
        artistOffset: (options.offset || 0).toString(),
        f: 'json',
      });

      const apiUrl = `${serverUrl}/rest/search3?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok' || !subsonicResponse.searchResult3) {
        throw new SubsonicError(
          'Failed to search Subsonic library',
          'API_ERROR',
        );
      }

      return {
        success: true,
        data: subsonicResponse.searchResult3 as SubsonicSearchResult,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to search Subsonic library';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic search error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async getSong(songId: string): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      if (!songId || songId.trim() === '') {
        throw new SubsonicError('Invalid song ID provided', 'INVALID_SONG_ID');
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      // Build the getSong endpoint URL
      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        id: songId,
        f: 'json',
      });

      const apiUrl = `${serverUrl}/rest/getSong?${params.toString()}`;

      // Fetch song metadata
      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok' || !subsonicResponse.song) {
        throw new SubsonicError('Failed to parse song metadata', 'API_ERROR');
      }

      const song = subsonicResponse.song as SubsonicSong;

      if (!song) {
        throw new SubsonicError('Failed to parse song metadata', 'API_ERROR');
      }

      return {
        success: true,
        data: song,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch song metadata';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic getSong error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async getAlbum(albumId: string): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      if (!albumId || albumId.trim() === '') {
        throw new SubsonicError(
          'Invalid album ID provided',
          'INVALID_ALBUM_ID',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      // Build the getSong endpoint URL
      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        id: albumId,
        f: 'json',
      });

      const apiUrl = `${serverUrl}/rest/getAlbum?${params.toString()}`;

      console.log(`Subsonic: Fetching album for ${albumId}`);

      // Fetch song metadata
      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok' || !subsonicResponse.album) {
        throw new SubsonicError('Failed to parse album metadata', 'API_ERROR');
      }

      console.log(
        `Subsonic: Retrieved album "${subsonicResponse.album.name}" by ${subsonicResponse.album.artist}`,
      );

      return {
        success: true,
        data: subsonicResponse.album,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch song metadata';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic getSong error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async reportPlayback(
    songId: string,
    position: number,
    state: 'starting' | 'playing' | 'paused' | 'stopped',
  ): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      if (!songId || songId.trim() === '') {
        throw new SubsonicError('Invalid song ID provided', 'INVALID_SONG_ID');
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        mediaId: songId,
        mediaType: 'song',
        position: position.toString(),
        ignoreScrobble: 'false',
        state,
        f: 'json',
      });

      const apiUrl = `${serverUrl}/rest/reportPlayback?${params.toString()}`;

      // Report playback position
      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok') {
        throw new SubsonicError(
          'Failed to report playback position',
          'API_ERROR',
        );
      }

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to report playback position';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic reportPlayback error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async getArtist(artistId: string): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      if (!artistId || artistId.trim() === '') {
        throw new SubsonicError(
          'Invalid artist ID provided',
          'INVALID_ARTIST_ID',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      // Build the getArtist endpoint URL
      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        id: artistId,
        f: 'json',
      });

      const apiUrl = `${serverUrl}/rest/getArtist?${params.toString()}`;

      console.log(`Subsonic: Fetching artist for ${artistId}`);

      // Fetch artist metadata
      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok' || !subsonicResponse.artist) {
        throw new SubsonicError('Failed to parse artist metadata', 'API_ERROR');
      }

      console.log(
        `Subsonic: Retrieved artist "${subsonicResponse.artist.name}"`,
      );

      return {
        success: true,
        data: subsonicResponse.artist,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch artist metadata';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic getArtist error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async getPlaylists(): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      // Build the getPlaylists endpoint URL
      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        f: 'json',
      });

      const apiUrl = `${serverUrl}/rest/getPlaylists?${params.toString()}`;

      // Fetch playlist metadata
      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok' || !subsonicResponse.playlists) {
        throw new SubsonicError(
          'Failed to parse playlist metadata',
          'API_ERROR',
        );
      }

      return {
        success: true,
        data: subsonicResponse.playlists.playlist,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch playlists';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic getPlaylists error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async getPlaylist(playlistId: string): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        id: playlistId,
        f: 'json',
      });

      const apiUrl = `${serverUrl}/rest/getPlaylist?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok' || !subsonicResponse.playlist) {
        throw new SubsonicError('Failed to fetch playlist', 'API_ERROR');
      }

      return {
        success: true,
        data: subsonicResponse.playlist,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch playlist';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic getPlaylist error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async createPlaylist(
    name: string,
    songIds: string[],
  ): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        name,
        f: 'json',
      });

      songIds.forEach(id => params.append('songId', id));

      const apiUrl = `${serverUrl}/rest/createPlaylist?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok') {
        throw new SubsonicError('Failed to create playlist', 'API_ERROR');
      }

      return {
        success: true,
        data: subsonicResponse.playlist,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create playlist';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic createPlaylist error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async deletePlaylist(playlistId: string): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        id: playlistId,
        f: 'json',
      });

      const apiUrl = `${serverUrl}/rest/deletePlaylist?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok') {
        throw new SubsonicError('Failed to delete playlist', 'API_ERROR');
      }

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete playlist';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic deletePlaylist error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async updatePlaylist(
    playlistId: string,
    name?: string,
    comment?: string,
  ): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        playlistId,
        f: 'json',
      });

      if (name) params.append('name', name);
      if (comment) params.append('comment', comment);

      const apiUrl = `${serverUrl}/rest/updatePlaylist?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok') {
        throw new SubsonicError('Failed to update playlist', 'API_ERROR');
      }

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update playlist';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic updatePlaylist error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  private credentialsStatusSnapshot(): {
    configured: boolean;
    username?: string;
  } {
    if (!this.credentials) {
      return { configured: false };
    }
    return { configured: true, username: this.credentials.username };
  }

  private emitCredentialsChanged() {
    const status = this.credentialsStatusSnapshot();
    this.credentialsChangedCallbacks.forEach(cb => cb(status));
  }

  onCredentialsChanged(
    callback: (status: { configured: boolean; username?: string }) => void,
  ): () => void {
    this.credentialsChangedCallbacks.add(callback);
    callback(this.credentialsStatusSnapshot());
    return () => {
      this.credentialsChangedCallbacks.delete(callback);
    };
  }

  async replacePlaylistSongs(
    playlistId: string,
    songIds: string[],
  ): Promise<SubsonicCommandResult> {
    try {
      // For createPlaylist with an existing id, it replaces the songs
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        playlistId,
        f: 'json',
      });

      songIds.forEach(id => params.append('songId', id));

      const apiUrl = `${serverUrl}/rest/createPlaylist?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok') {
        throw new SubsonicError('Failed to update playlist songs', 'API_ERROR');
      }

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to update playlist songs';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic replacePlaylistSongs error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async getStarred(): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        f: 'json',
      });

      const apiUrl = `${serverUrl}/rest/getStarred?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok') {
        throw new SubsonicError('Failed to fetch starred items', 'API_ERROR');
      }

      return {
        success: true,
        data: subsonicResponse.starred || {},
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch starred items';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic getStarred error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async star(options: {
    id?: string;
    artistId?: string;
    albumId?: string;
  }): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        f: 'json',
      });

      if (options.id) params.append('id', options.id);
      if (options.artistId) params.append('artistId', options.artistId);
      if (options.albumId) params.append('albumId', options.albumId);

      const apiUrl = `${serverUrl}/rest/star?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      if (response.ok) {
        const res = await response.json();
        const subsonicResponse = res['subsonic-response'];

        if (subsonicResponse.status !== 'ok') {
          throw new SubsonicError('Failed to star item', 'API_ERROR');
        }

        return {
          success: true,
        };
      }
      return {
        success: false,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to star item';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic star error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  async unstar(options: {
    id?: string;
    artistId?: string;
    albumId?: string;
  }): Promise<SubsonicCommandResult> {
    try {
      if (!this.credentials) {
        throw new SubsonicError(
          'Subsonic credentials not configured',
          'NO_CREDENTIALS',
        );
      }

      const { serverUrl, username, hashedPassword, passwordSalt } =
        this.credentials;

      const params = new URLSearchParams({
        u: username,
        t: hashedPassword,
        s: passwordSalt,
        c: this.config.clientName,
        v: this.config.apiVersion,
        f: 'json',
      });

      if (options.id) params.append('id', options.id);
      if (options.artistId) params.append('artistId', options.artistId);
      if (options.albumId) params.append('albumId', options.albumId);

      const apiUrl = `${serverUrl}/rest/unstar?${params.toString()}`;

      const response = await fetchJsonChecked(apiUrl);
      const res = await response.json();
      const subsonicResponse = res['subsonic-response'];

      if (subsonicResponse.status !== 'ok') {
        throw new SubsonicError('Failed to unstar item', 'API_ERROR');
      }

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to unstar item';
      const subsonicError =
        error instanceof SubsonicError
          ? error
          : new SubsonicError(errorMessage, 'API_ERROR');

      console.error('Subsonic unstar error:', subsonicError);

      return {
        success: false,
        error: subsonicError.message,
      };
    }
  }

  /**
   * Register a window to receive state updates
   */
  registerWindow(windowId: number): void {
    this.registeredWindows.add(windowId);
  }

  /**
   * Unregister a window
   */
  unregisterWindow(windowId: number): void {
    this.registeredWindows.delete(windowId);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.registeredWindows.clear();
  }
}
