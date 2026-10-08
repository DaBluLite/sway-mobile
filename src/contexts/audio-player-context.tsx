import { Station } from 'radio-browser-api';
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  type AudioPlayer,
  type RepeatMode,
  type Track,
  type CastDevice,
  type CastState,
} from '@dablulite/rn-audio-stream';
import TrackPlayer from 'react-native-track-player';
import { SubsonicSong } from '../types/subsonic';
import { SubsonicService } from '../services/subsonic-service';
import { getItem, setItem, STORES } from '../utils/storage';
import {
  AlbumArtResult,
  fetchTrackDataCached,
  TrackInfo,
} from '../utils/lyrics';
import { BtCodec, getSongCodecParams } from '../utils/btCodec';
import { UsbAudio, getSongUsbParams } from '../utils/usbAudio';
import {
  generateAutoplayQueue,
} from '../utils/autoplay';

interface AudioDevice {
  id: string;
  name: string;
}

interface AudioPlayerState {
  repeat: RepeatMode;
  volume: number;
  shuffle: boolean;
  gaplessEnabled: boolean;
  exclusiveEnabled: boolean;
  bitPerfectEnabled: boolean;
  autoplayEnabled: boolean;
  audioDevice: string | null;
}

type StationPlayHistoryItem =
  | {
      type: 'song';
      track: TrackInfo;
      albumArt: AlbumArtResult;
    }
  | {
      type: 'intermission';
    };

interface AudioPlayerContextType {
  // State
  isPlaying: boolean;
  currentStation: Station | null;
  currentStationSong: { track: TrackInfo; albumArt: AlbumArtResult } | null;
  stationPlayHistory: StationPlayHistoryItem[];
  currentSong: SubsonicSong | null;
  currentSongId: string | null;
  queue: SubsonicSong[];
  shuffle: boolean;
  repeat: RepeatMode;
  duration: number;
  currentTime: number;
  isSeekable: boolean;
  isLoading: boolean;
  error: string | null;

  // Settings
  gaplessEnabled: boolean;
  exclusiveEnabled: boolean;
  bitPerfectEnabled: boolean;
  autoplayEnabled: boolean;
  audioDevice: string | null;

  // Controls
  play: (station: Station) => void;
  playSong: (songs: SubsonicSong[], index: number) => void;
  shufflePlay: (songs: SubsonicSong[]) => void;
  playFromQueue: (songId: string) => void;
  pause: () => void;
  stop: () => void;
  resume: () => Promise<void>;
  seek: (time: number) => void;
  updateSettings: (settings: Partial<AudioPlayerState>) => Promise<void>;
  getAudioDevices: () => Promise<AudioDevice[]>;
  refreshDevices: () => Promise<void>;
  onSongEnded: (callback: () => void) => () => void;
  onDevicesChanged: (callback: (devices: AudioDevice[]) => void) => () => void;

  // Queue Controls
  addToQueue: (song: SubsonicSong) => void;
  queueNext: (song: SubsonicSong) => void;
  clearQueue: () => void;
  removeFromQueue: (songId: string) => void;
  toggleShuffle: () => void;
  setRepeat: (mode: RepeatMode) => void;
  playNext: () => void;
  playPrevious: () => void;

  // Cast
  castDevices: CastDevice[];
  castState: CastState | null;
  connectedCastDevice: CastDevice | null;
  isCasting: boolean;
  castStartSession: (deviceId: string) => Promise<boolean>;
  castEndSession: (stopCasting?: boolean) => Promise<void>;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(
  undefined,
);

interface AudioPlayerProviderProps {
  children: React.ReactNode;
}

const QUEUE_STORAGE_KEY = 'audio-player-queue';
const SHUFFLED_QUEUE_STORAGE_KEY = 'audio-player-shuffled-queue';
const SHUFFLE_STORAGE_KEY = 'audio-player-shuffle';
const CURRENT_SONG_ID_STORAGE_KEY = 'audio-player-current-song-id';
const IS_PLAYING_STORAGE_KEY = 'audio-player-is-playing';
const GAPLESS_STORAGE_KEY = 'audio-player-gapless';
const EXCLUSIVE_STORAGE_KEY = 'audio-player-exclusive';
const BIT_PERFECT_STORAGE_KEY = 'audio-player-bit-perfect';
const AUDIO_DEVICE_STORAGE_KEY = 'audio-player-device';
const AUTOPLAY_STORAGE_KEY = 'audio-player-autoplay';
const DEFAULT_PLAYER_REPEAT: RepeatMode = 'off';
const DEFAULT_PLAYER_GAPLESS = false;
const DEFAULT_PLAYER_AUTOPLAY = true;

// ─── Singleton player management ─────────────────────────────────────────────
//
// We keep ONE AudioPlayer alive for the lifetime of the JS bundle. The key
// insight is that we must distinguish between two things:
//
//   1. The *player itself* — should survive across provider re-mounts so that
//      audio never cuts out mid-song due to a minor UI crash.
//   2. The *React listeners* on that player — must be torn down and re-attached
//      on every provider mount, because the old closure refs are dead after a
//      remount and will never trigger a setState on the new component instance.
//
// The bug in the original code: `attachPlayerListeners` had an early-return
// guard (`if (unsubscribeStateChangeRef.current) return`) that prevented
// re-attachment after a crash-triggered remount, leaving the new provider
// instance with no live subscriptions.

import { getOrCreatePlayer, subscribeCastDevices, subscribeCastSessionEnd, subscribeCastSessionStart, subscribeCastState } from './audio-player-bootstrap';

// ─── Provider ─────────────────────────────────────────────────────────────────

const useAudioPlayerProvider: React.FC<AudioPlayerProviderProps> = ({
  children,
}) => {
  // We store the player in a ref so we never need it as a reactive dependency.
  // The ref is populated once during init and never changes for the lifetime of
  // this provider instance.
  const playerRef = useRef<AudioPlayer | null>(null);
  const subsonicServiceRef = useRef<SubsonicService>(new SubsonicService());
  const songMapRef = useRef<Map<string, SubsonicSong>>(new Map());
  const lastAppliedCodecRef = useRef<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStation, setCurrentStation] = useState<Station | null>(null);
  const [currentStationSong, setCurrentStationSong] = useState<{
    track: TrackInfo;
    albumArt: AlbumArtResult;
  } | null>(null);
  const [stationPlayHistory, setStationPlayHistory] = useState<
    StationPlayHistoryItem[]
  >([]);
  const [currentSong, setCurrentSong] = useState<SubsonicSong | null>(null);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [originalQueue, setOriginalQueue] = useState<SubsonicSong[]>([]);
  const [shuffledQueue, setShuffledQueue] = useState<SubsonicSong[]>([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>(DEFAULT_PLAYER_REPEAT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeekable, setIsSeekable] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Settings
  const [gaplessEnabled, setGaplessEnabled] = useState(DEFAULT_PLAYER_GAPLESS);
  const [exclusiveEnabled, setExclusiveEnabled] = useState(false);
  const [bitPerfectEnabled, setBitPerfectEnabled] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(DEFAULT_PLAYER_AUTOPLAY);
  const [audioDevice, setAudioDevice] = useState<string | null>(null);

  const [castDevices, setCastDevices] = useState<CastDevice[]>([]);
  const [castState, setCastState] = useState<CastState | null>(null);
  const [connectedCastDevice, setConnectedCastDevice] = useState<CastDevice | null>(null);
  const [isCasting, setIsCasting] = useState(false);

  const onSongEndedCallbacks = useRef<Set<() => void>>(new Set());

  const cleanupRef = useRef<(() => void) | null>(null);
  const stationSongPollingIntervalRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const stationPlayHistoryLastEntryRef = useRef<
    `song:${string}` | 'intermission' | null
  >(null);
  const queueMutationLockRef = useRef<Promise<void>>(Promise.resolve());
  const runQueueMutation = useCallback(async (work: () => Promise<void>) => {
    const next = queueMutationLockRef.current.then(work);
    queueMutationLockRef.current = next.catch(() => undefined);
    return next;
  }, []);

  const runQueueMutationSync = useCallback((work: () => void) => {
    const next = queueMutationLockRef.current.then(() => {
      work();
    });
    queueMutationLockRef.current = next.catch(() => undefined);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toSongTrack = useCallback(async (song: SubsonicSong): Promise<Track | null> => {
    // Caching disconnected — always stream directly. Cache will be re-implemented
    // inside rn-audio-stream closer to RNTP for instant playback / seamless switch.
    const streamUrl = subsonicServiceRef.current.generateStreamUrl(song.id);
    if (!streamUrl) return null;
    return {
      id: song.id,
      url: streamUrl,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      artwork: song.coverArt
        ? subsonicServiceRef.current.getCoverArtUrl(song.coverArt) ?? undefined
        : undefined,
    };
  }, []);

  const shuffleArray = useCallback(<T,>(array: T[]): T[] => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, []);

  const buildPlayQueue = useCallback(
    (songs: SubsonicSong[], index: number, shuffleEnabled: boolean) => {
      if (index < 0 || index >= songs.length) return [];
      const selected = songs[index];
      if (!shuffleEnabled) {
        if (index === 0) return songs;
        return [...songs.slice(index), ...songs.slice(0, index)];
      }

      const rest = songs.filter((_, songIndex) => songIndex !== index);
      return [selected, ...shuffleArray(rest)];
    },
    [shuffleArray],
  );

  type PlayableTrack = { song: SubsonicSong; track: Track };

  const buildPlayableQueue = useCallback(
    async (songs: SubsonicSong[]): Promise<PlayableTrack[]> => {
      const playable: PlayableTrack[] = [];
      for (const song of songs) {
        songMapRef.current.set(song.id, song);
        const track = await toSongTrack(song);
        if (track) playable.push({ song, track });
      }
      return playable;
    },
    [toSongTrack],
  );

  const resolveQueueIndex = useCallback(
    (playable: PlayableTrack[], songId?: string | null): number => {
      if (!songId) return 0;
      const index = playable.findIndex(item => item.song.id === songId);
      return index >= 0 ? index : 0;
    },
    [],
  );

  const warmCache = useCallback((_songId: string) => {
    // No-op — caching disabled. rn-audio-stream will handle prefetch/caching natively.
  }, []);

  // ── State sync from player → React ────────────────────────────────────────
  //
  // We keep this in a ref so that the player's `stateChange` listener closure
  // always calls the *latest* version without needing to re-subscribe every
  // time a dependency changes.

  const shuffleRef = useRef(shuffle);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  const syncFromPlayer = useCallback((state: AudioPlayer['state']) => {
    setIsPlaying(state.playbackState === 'playing');
    setCurrentSongId(state.currentTrack?.id ?? null);
    setCurrentSong(
      state.currentTrack
        ? songMapRef.current.get(state.currentTrack.id) ?? null
        : null,
    );
    setDuration(Number.isFinite(state.duration) ? state.duration : 0);
    setCurrentTime(state.position);
    setIsSeekable(!state.currentTrack?.isLive);
    setRepeatState(state.repeatMode);
    setError(state.error?.message ?? null);

    if (state.queue.length > 0) {
      const queueSongs = state.queue
        .map(t => songMapRef.current.get(t.id))
        .filter((s): s is SubsonicSong => Boolean(s));

      if (shuffleRef.current) {
        setShuffledQueue(queueSongs);
      } else {
        setOriginalQueue(queueSongs);
      }
    }

    const currentTrackId = state.currentTrack?.id;
    if (!currentTrackId) {
      lastAppliedCodecRef.current = null;
      return;
    }

    const queueIds = state.queue.map(track => track.id);
    const currentIndex = queueIds.findIndex(id => id === currentTrackId);
    if (currentIndex < 0) return;

    const currentSongMeta = songMapRef.current.get(currentTrackId);
    const nextSongMeta =
      currentIndex + 1 < queueIds.length
        ? songMapRef.current.get(queueIds[currentIndex + 1])
        : null;

    const currentCodecParams = getSongCodecParams({
      sampleRate: currentSongMeta?.samplingRate,
      bitDepth: currentSongMeta?.bitDepth,
    });
    const nextCodecParams = getSongCodecParams({
      sampleRate: nextSongMeta?.samplingRate,
      bitDepth: nextSongMeta?.bitDepth,
    });

    const targetParams = currentCodecParams ?? nextCodecParams;
    if (!targetParams) return;

    const applyKey = `${currentTrackId}:${targetParams.sampleRate}:${targetParams.bitDepth}`;
    if (lastAppliedCodecRef.current === applyKey) return;
    lastAppliedCodecRef.current = applyKey;

    BtCodec.applyPreferredParams(targetParams.sampleRate, targetParams.bitDepth).catch(
      () => undefined,
    );
    // USB bit-perfect: if exclusive+bitPerfect enabled, push params to USB DAC (best-effort bypass EQ via DIRECT)
    try {
      const usbParams = getSongUsbParams({ samplingRate: targetParams.sampleRate, bitDepth: targetParams.bitDepth });
      if (usbParams) UsbAudio.applyBitPerfectParams(usbParams.sampleRate, usbParams.bitDepth).catch(()=>undefined);
    } catch {}
  }, []); // stable — reads shuffle via ref, not closure

  const syncFromPlayerRef = useRef(syncFromPlayer);
  useEffect(() => {
    syncFromPlayerRef.current = syncFromPlayer;
  }, [syncFromPlayer]);

  const tryHydrateAttachedPlayer = useCallback(
    async (
      player: AudioPlayer,
      restoredOriginalQueue: SubsonicSong[],
      restoredShuffledQueue: SubsonicSong[],
      restoredCurrentSongId: string | null,
      restoredWasPlaying: boolean,
    ): Promise<boolean> => {
      try {
        const nativeQueue = await TrackPlayer.getQueue();
        if (!Array.isArray(nativeQueue) || nativeQueue.length === 0) {
          return false;
        }

        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        if (
          activeIndex === undefined ||
          activeIndex === null ||
          activeIndex < 0
        ) {
          return false;
        }

        const knownSongs = [...restoredOriginalQueue, ...restoredShuffledQueue];
        if (knownSongs.length === 0) {
          return false;
        }

        const songById = new Map<string, SubsonicSong>();
        knownSongs.forEach(song => {
          songById.set(song.id, song);
        });

        const nativeIds = nativeQueue.map(track => String(track.id));
        const recoveredSongs = nativeIds
          .map(id => songById.get(id))
          .filter((song): song is SubsonicSong => Boolean(song));

        if (recoveredSongs.length === 0) {
          return false;
        }

        const playable = await buildPlayableQueue(recoveredSongs);
        if (playable.length === 0) {
          return false;
        }

        const activeNativeId = nativeIds[activeIndex];
        const targetSongId = restoredCurrentSongId ?? activeNativeId;
        const startIndex = resolveQueueIndex(playable, targetSongId);
        const progress = await TrackPlayer.getProgress();
        const shouldPlay = restoredWasPlaying;

        await player.setQueue(
          playable.map(item => item.track),
          startIndex,
          false,
        );
        if (Number.isFinite(progress.position) && progress.position > 0) {
          await player.seek(progress.position);
        }
        if (shouldPlay) {
          await player.play();
        }

        if (shuffleRef.current) {
          setShuffledQueue(playable.map(item => item.song));
        } else {
          setOriginalQueue(playable.map(item => item.song));
        }

        return true;
      } catch {
        return false;
      }
    },
    [buildPlayableQueue, resolveQueueIndex],
  );

  // ── Player init & listener wiring ──────────────────────────────────────────
  //
  // This effect runs once per provider *mount*. On every mount — including
  // crash-triggered remounts — it:
  //   1. Gets (or creates) the shared player.
  //   2. Attaches fresh listeners that close over this component instance's
  //      setState functions.
  //   3. Immediately syncs state from the player (catches any changes that
  //      happened while the provider was unmounted/crashed).
  //   4. On unmount: removes *only the listeners*, leaving the player running.

  useEffect(() => {
    let mounted = true;

    // Restore persisted queue state immediately so the UI isn't blank.
    const savedQueue = getItem<SubsonicSong[]>(
      STORES.SETTINGS,
      QUEUE_STORAGE_KEY,
    );
    const savedShuffledQueue = getItem<SubsonicSong[]>(
      STORES.SETTINGS,
      SHUFFLED_QUEUE_STORAGE_KEY,
    );
    const savedShuffle = getItem<boolean>(STORES.SETTINGS, SHUFFLE_STORAGE_KEY);
    const savedCurrentSongId = getItem<string>(
      STORES.SETTINGS,
      CURRENT_SONG_ID_STORAGE_KEY,
    );
    const savedWasPlaying = getItem<boolean>(
      STORES.SETTINGS,
      IS_PLAYING_STORAGE_KEY,
    );

    const savedGapless = getItem<boolean>(STORES.SETTINGS, GAPLESS_STORAGE_KEY);
    if (savedGapless !== null) setGaplessEnabled(savedGapless);
    const savedExclusive = getItem<boolean>(
      STORES.SETTINGS,
      EXCLUSIVE_STORAGE_KEY,
    );
    if (savedExclusive !== null) setExclusiveEnabled(savedExclusive);
    const savedBitPerfect = getItem<boolean>(
      STORES.SETTINGS,
      BIT_PERFECT_STORAGE_KEY,
    );
    if (savedBitPerfect !== null) setBitPerfectEnabled(savedBitPerfect);
    const savedAudioDevice = getItem<string>(
      STORES.SETTINGS,
      AUDIO_DEVICE_STORAGE_KEY,
    );
    if (savedAudioDevice) setAudioDevice(savedAudioDevice);
    const savedAutoplay = getItem<boolean>(
      STORES.SETTINGS,
      AUTOPLAY_STORAGE_KEY,
    );
    if (savedAutoplay !== null) setAutoplayEnabled(savedAutoplay);

    const restoredOriginalQueue = savedQueue ?? [];
    const restoredShuffledQueue = savedShuffledQueue ?? [];

    // Preload song map so a reattached player can resolve currentTrack -> SubsonicSong.
    [...restoredOriginalQueue, ...restoredShuffledQueue].forEach(song => {
      songMapRef.current.set(song.id, song);
    });

    if (savedQueue) setOriginalQueue(savedQueue);
    if (savedShuffledQueue) setShuffledQueue(savedShuffledQueue);
    if (savedShuffle !== null) setShuffle(savedShuffle);

    setIsLoading(true);

    getOrCreatePlayer()
      .then(async player => {
        if (!mounted) return;

        playerRef.current = player;

        // Cast callbacks are wired via createAudioPlayer in audio-player-bootstrap.
        // Subscribe here so React state stays in sync without calling enableCast.
        const unsubCastState = subscribeCastState((s, d) => {
          setCastState(s);
          setConnectedCastDevice(d);
          setIsCasting(s === 'connected');
        });
        const unsubCastDevices = subscribeCastDevices(d => {
          console.log(d);
          setCastDevices(d);
        });
        const unsubCastSessionStart = subscribeCastSessionStart(d => {
          setConnectedCastDevice(d);
          setCastState('connected');
          setIsCasting(true);
        });
        const unsubCastSessionEnd = subscribeCastSessionEnd(() => {
          setConnectedCastDevice(null);
          setCastState('not_connected');
          setIsCasting(false);
        });
        // Seed initial cast state from player if available
        try {
          setCastState((player as unknown as { castState: CastState }).castState ?? null);
          setConnectedCastDevice((player as unknown as { connectedDevice: CastDevice | null }).connectedDevice ?? null);
        } catch {}

        // Always attach fresh listeners — never guard with an early return.
        // The old listener refs (from a previous mount) were cleaned up in the
        // effect cleanup below, so this is always a new subscription.
        const offStateChange = player.on('stateChange', state => {
          syncFromPlayerRef.current(state);
        });

        const offQueueEnd = player.on('queueEnd', () => {
          onSongEndedCallbacks.current.forEach(cb => cb());
        });

        // If this JS instance was recreated while native playback survives,
        // rebuild the wrapper state from native queue/progress + persisted songs.
        const didHydrate = await tryHydrateAttachedPlayer(
          player,
          restoredOriginalQueue,
          restoredShuffledQueue,
          savedCurrentSongId ?? null,
          savedWasPlaying ?? false,
        );

        // Sync whatever state the player is already in (e.g. still playing
        // after a crash-triggered remount).
        if (!didHydrate) {
          syncFromPlayerRef.current(player.state);
        }

        setIsInitialized(true);
        setIsLoading(false);

        // Store unsubscribe fns so the cleanup below can remove them.
        return () => {
          offStateChange();
          offQueueEnd();
          unsubCastState();
          unsubCastDevices();
          unsubCastSessionStart();
          unsubCastSessionEnd();
        };
      })
      .then(cleanup => {
        // If we got a cleanup fn back, wire it into the effect cleanup.
        // We do this in a second `.then` so `mounted` is already set to false
        // by the time the outer cleanup runs.
        if (!mounted && cleanup) cleanup();
        if (mounted) {
          // Store for cleanup below — we can't return from an async effect
          // directly, so we keep it in a ref.
          cleanupRef.current = cleanup ?? null;
        }
      })
      .catch(err => {
        if (!mounted) return;
        setIsInitialized(false);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to initialize audio player',
        );
        setIsLoading(false);
      });

    return () => {
      mounted = false;
      // Remove this mount's listeners but do NOT destroy/stop the player.
      // The audio will continue; the next mount will re-attach listeners and
      // sync state from whatever the player is currently doing.
      cleanupRef.current?.();
      cleanupRef.current = null;
      playerRef.current = null;
    };
  }, [tryHydrateAttachedPlayer]); // intentionally once per mount; callback is stable

  // ── Persist queue ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isInitialized) return;
    setItem(STORES.SETTINGS, QUEUE_STORAGE_KEY, originalQueue);
    setItem(STORES.SETTINGS, SHUFFLED_QUEUE_STORAGE_KEY, shuffledQueue);
    setItem(STORES.SETTINGS, SHUFFLE_STORAGE_KEY, shuffle);
  }, [originalQueue, shuffledQueue, shuffle, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    setItem(STORES.SETTINGS, CURRENT_SONG_ID_STORAGE_KEY, currentSongId);
    setItem(STORES.SETTINGS, IS_PLAYING_STORAGE_KEY, isPlaying);
  }, [currentSongId, isPlaying, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    setItem(STORES.SETTINGS, GAPLESS_STORAGE_KEY, gaplessEnabled);
    setItem(STORES.SETTINGS, EXCLUSIVE_STORAGE_KEY, exclusiveEnabled);
    setItem(STORES.SETTINGS, BIT_PERFECT_STORAGE_KEY, bitPerfectEnabled);
    setItem(STORES.SETTINGS, AUDIO_DEVICE_STORAGE_KEY, audioDevice);
    setItem(STORES.SETTINGS, AUTOPLAY_STORAGE_KEY, autoplayEnabled);
  }, [
    audioDevice,
    autoplayEnabled,
    bitPerfectEnabled,
    exclusiveEnabled,
    gaplessEnabled,
    isInitialized,
  ]);

  // ── Active queue ───────────────────────────────────────────────────────────

  const queue = useMemo(
    () => (shuffle ? shuffledQueue : originalQueue),
    [shuffle, shuffledQueue, originalQueue],
  );

  // ── ensurePlayer ──────────────────────────────────────────────────────────
  //
  // Used by all imperative controls. Returns the player if available; if it's
  // still initialising (shouldn't happen in practice after the effect above)
  // it awaits the shared promise.

  const ensurePlayer = useCallback(async (): Promise<AudioPlayer | null> => {
    if (playerRef.current) return playerRef.current;
    try {
      const player = await getOrCreatePlayer();
      playerRef.current = player;
      return player;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audio player unavailable');
      return null;
    }
  }, []);

  // ── Controls ───────────────────────────────────────────────────────────────

  const onSongEnded = useCallback((callback: () => void) => {
    onSongEndedCallbacks.current.add(callback);
    return () => {
      onSongEndedCallbacks.current.delete(callback);
    };
  }, []);

  // ── Autoplay ───────────────────────────────────────────────────────────────
  //
  // When the queue reaches its natural end (repeat "off") and autoplay is
  // enabled, seed similarity lookups from the ENTIRE current queue and append
  // the recommended tracks, then keep playing.

  const autoplayEnabledRef = useRef(autoplayEnabled);
  useEffect(() => {
    autoplayEnabledRef.current = autoplayEnabled;
  }, [autoplayEnabled]);

  const repeatRef = useRef(repeat);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  const currentStationRef = useRef(currentStation);
  useEffect(() => {
    currentStationRef.current = currentStation;
  }, [currentStation]);

  const triggerAutoplay = useCallback(async () => {
    if (!autoplayEnabledRef.current) return;
    if (repeatRef.current !== 'off') return;
    if (currentStationRef.current) return; // never autoplay radio streams

    const player = playerRef.current;
    if (!player) return;

    const activeQueue = shuffle ? shuffledQueue : originalQueue;
    const current = currentSong ? [currentSong] : [];
    const seedSongs = current
      .concat(activeQueue.filter(s => s.id !== currentSong?.id));
    if (seedSongs.length === 0) return;

    const queueItems = seedSongs.map(song => ({ song, played: true }));

    const recommended = await generateAutoplayQueue(queueItems, {
      count: 10,
    });
    if (recommended.length === 0) return;

    await runQueueMutation(async () => {
      const playable = await buildPlayableQueue(recommended);
      if (playable.length === 0) return;

      // Only append those that are actually playable offline
      const playableIds = new Set(playable.map(p => p.song.id));
      const filteredRecommended = recommended.filter(r => playableIds.has(r.id));
      setOriginalQueue(prev => [...prev, ...filteredRecommended]);
      setShuffledQueue(prev => [...prev, ...filteredRecommended]);

      await player.addToQueue(playable.map(item => item.track));
      await player.next();
    });
  }, [
    buildPlayableQueue,
    currentSong,
    originalQueue,
    runQueueMutation,
    shuffle,
    shuffledQueue,
  ]);

  useEffect(() => {
    if (!autoplayEnabled) return;
    return onSongEnded(() => {
      triggerAutoplay().catch(() => undefined);
    });
  }, [autoplayEnabled, onSongEnded, triggerAutoplay]);

  const seek = useCallback(
    (time: number) => {
      runQueueMutationSync(() => {
        playerRef.current?.seek(time).catch(() => undefined);
      });
    },
    [runQueueMutationSync],
  );

  const clearStationSongPollingTimer = useCallback(() => {
    if (stationSongPollingIntervalRef.current) {
      clearInterval(stationSongPollingIntervalRef.current);
      stationSongPollingIntervalRef.current = null;
    }
  }, []);

  const clearStationPlayHistory = useCallback(() => {
    stationPlayHistoryLastEntryRef.current = null;
    setStationPlayHistory([]);
  }, []);

  const addSongToStationPlayHistory = useCallback(
    (entry: { track: TrackInfo; albumArt: AlbumArtResult }) => {
      const songKey = `song:${entry.track.title.trim()}::${entry.track.artist.trim()}`;
      if (stationPlayHistoryLastEntryRef.current === songKey) return;
      stationPlayHistoryLastEntryRef.current = songKey as `song:${string}`;
      setStationPlayHistory(prev => [...prev, { type: 'song', ...entry }]);
    },
    [],
  );

  const addIntermissionToStationPlayHistory = useCallback(() => {
    if (!stationPlayHistoryLastEntryRef.current) return;
    if (stationPlayHistoryLastEntryRef.current === 'intermission') return;
    stationPlayHistoryLastEntryRef.current = 'intermission';
    setStationPlayHistory(prev => [...prev, { type: 'intermission' }]);
  }, []);

  const updateStationNotificationMetadata = useCallback(
    async (
      station: Station,
      stationSongEntry?: { track: TrackInfo; albumArt: AlbumArtResult } | null,
    ) => {
      const stationUrl = station.urlResolved || station.url;
      if (!stationUrl) return;

      const songTitle = stationSongEntry?.track.title.trim();
      const songArtist = stationSongEntry?.track.artist.trim();

      try {
        await TrackPlayer.updateMetadataForTrack(0, {
          title: songTitle || station.name,
          artist: songArtist || station.country,
          artwork: stationSongEntry?.albumArt.imageUrl || undefined,
        });
      } catch (err) {
        console.error('Failed to update station notification metadata:', err);
      }
    },
    [],
  );

  const play = useCallback(
    async (station: Station) => {
      await runQueueMutation(async () => {
        const player = await ensurePlayer();
        if (!player) return;

        const stationUrl = station.urlResolved || station.url;
        if (!stationUrl) return;

        clearStationSongPollingTimer();
        setCurrentStation(station);
        setCurrentStationSong(null);
        clearStationPlayHistory();
        setCurrentSong(null);
        songMapRef.current.clear();

        await player.setQueue(
          [
            {
              id: `station:${stationUrl}`,
              url: stationUrl,
              title: station.name,
              artist: station.country,
              isLive: true,
            },
          ],
          0,
          true,
        );
      });
    },
    [
      clearStationPlayHistory,
      clearStationSongPollingTimer,
      ensurePlayer,
      runQueueMutation,
    ],
  );

  const playSong = useCallback(
    async (songs: SubsonicSong[], index: number) => {
      await runQueueMutation(async () => {
        const player = await ensurePlayer();
        if (!player) return;

        if (index < 0 || index >= songs.length) return;

        clearStationSongPollingTimer();
        setCurrentStation(null);
        setCurrentStationSong(null);
        clearStationPlayHistory();
        const nextOriginalQueue = songs;
        const nextShuffledQueue = buildPlayQueue(songs, index, true);

        setOriginalQueue(nextOriginalQueue);
        setShuffledQueue(nextShuffledQueue);
        setShuffle(shuffle);

        const activeSongs = shuffle ? nextShuffledQueue : nextOriginalQueue;
        const playable = await buildPlayableQueue(activeSongs);
        if (playable.length === 0) {
          setError('No playable tracks available offline');
          return;
        }
        await player.setQueue(
          playable.map(item => item.track),
          resolveQueueIndex(playable, activeSongs[index]?.id ?? null),
          true,
        );
        // Warm cache for offline: current track in background (RNFS, not fetch streaming)
        warmCache(activeSongs[index]?.id ?? playable[0]?.song.id ?? '');
      });
    },
    [
      buildPlayQueue,
      buildPlayableQueue,
      clearStationPlayHistory,
      clearStationSongPollingTimer,
      ensurePlayer,
      resolveQueueIndex,
      runQueueMutation,
      shuffle,
      warmCache,
    ],
  );

  const shufflePlay = useCallback(
    async (songs: SubsonicSong[]) => {
      await runQueueMutation(async () => {
        const player = await ensurePlayer();
        if (!player) return;

        clearStationSongPollingTimer();
        setShuffle(true);
        const shuffled = buildPlayQueue(songs, 0, true);
        setOriginalQueue(songs);
        setShuffledQueue(shuffled);
        setCurrentStation(null);
        setCurrentStationSong(null);
        clearStationPlayHistory();

        const playable = await buildPlayableQueue(shuffled);
        if (playable.length === 0) {
          setError('No playable tracks available');
          return;
        }

        await player.setQueue(
          playable.map(item => item.track),
          0,
          true,
        );
        warmCache(playable[0]?.song.id ?? shuffled[0]?.id ?? '');
      });
    },
    [
      buildPlayQueue,
      buildPlayableQueue,
      clearStationPlayHistory,
      clearStationSongPollingTimer,
      ensurePlayer,
      runQueueMutation,
      warmCache,
    ],
  );

  const playFromQueue = useCallback(
    async (songId: string) => {
      await runQueueMutation(async () => {
        const player = await ensurePlayer();
        if (!player) return;

        const activeQueue = shuffle ? shuffledQueue : originalQueue;
        const playable = await buildPlayableQueue(activeQueue);
        if (playable.length === 0) return;

        const index = resolveQueueIndex(playable, songId);
        await player.setQueue(
          playable.map(item => item.track),
          index,
          true,
        );
      });
    },
    [
      buildPlayableQueue,
      ensurePlayer,
      originalQueue,
      resolveQueueIndex,
      runQueueMutation,
      shuffledQueue,
      shuffle,
    ],
  );

  const playNext = useCallback(async () => {
    await runQueueMutation(async () => {
      const player = await ensurePlayer();
      if (!player) return;
      await player.next();
    });
  }, [ensurePlayer, runQueueMutation]);

  const playPrevious = useCallback(async () => {
    await runQueueMutation(async () => {
      const player = await ensurePlayer();
      if (!player) return;
      await player.previous();
    });
  }, [ensurePlayer, runQueueMutation]);

  const toggleShuffle = useCallback(async () => {
    await runQueueMutation(async () => {
      const player = await ensurePlayer();
      if (!player) return;

      const nextShuffle = !shuffle;
      setShuffle(nextShuffle);
      shuffleRef.current = nextShuffle;

      const nextQueue = nextShuffle
        ? shuffleArray(originalQueue)
        : [...originalQueue];
      if (nextShuffle) setShuffledQueue(nextQueue);

      const playable = await buildPlayableQueue(nextQueue);
      if (playable.length === 0) return;

      const targetId = currentSong?.id ?? nextQueue[0]?.id;
      const index = resolveQueueIndex(playable, targetId);
      await player.setQueue(
        playable.map(item => item.track),
        index,
        isPlaying,
      );
    });
  }, [
    buildPlayableQueue,
    currentSong,
    ensurePlayer,
    isPlaying,
    originalQueue,
    resolveQueueIndex,
    runQueueMutation,
    shuffle,
    shuffleArray,
  ]);

  const enqueueSong = useCallback(
    async (song: SubsonicSong, position: 'next' | 'last') => {
      await runQueueMutation(async () => {
        const player = await ensurePlayer();
        if (!player) return;

        const activeQueue = shuffle ? [...shuffledQueue] : [...originalQueue];

        if (activeQueue.length === 0) {
          await playSong([song], 0);
          return;
        }

        const targetSongId = currentSongId ?? activeQueue[0]?.id ?? song.id;
        const baseQueue = activeQueue.filter(
          queuedSong => queuedSong.id !== song.id,
        );
        const currentIndex = baseQueue.findIndex(
          queuedSong => queuedSong.id === targetSongId,
        );
        const insertionIndex =
          position === 'next'
            ? currentIndex >= 0
              ? currentIndex + 1
              : baseQueue.length
            : baseQueue.length;

        const nextQueue = [
          ...baseQueue.slice(0, insertionIndex),
          song,
          ...baseQueue.slice(insertionIndex),
        ];

        if (shuffle) {
          setShuffledQueue(nextQueue);
        } else {
          setOriginalQueue(nextQueue);
        }

        const playable = await buildPlayableQueue(nextQueue);
        if (playable.length === 0) return;

        const playbackIndex = resolveQueueIndex(playable, targetSongId);
        await player.setQueue(
          playable.map(item => item.track),
          playbackIndex,
          isPlaying,
        );
      });
    },
    [
      buildPlayableQueue,
      currentSongId,
      ensurePlayer,
      isPlaying,
      originalQueue,
      playSong,
      resolveQueueIndex,
      runQueueMutation,
      shuffle,
      shuffledQueue,
    ],
  );

  const addToQueue = useCallback(
    (song: SubsonicSong) => {
      enqueueSong(song, 'last').catch(() => undefined);
    },
    [enqueueSong],
  );

  const queueNext = useCallback(
    (song: SubsonicSong) => {
      enqueueSong(song, 'next').catch(() => undefined);
    },
    [enqueueSong],
  );

  const clearQueue = useCallback(() => {
    runQueueMutationSync(() => {
      setOriginalQueue([]);
      setShuffledQueue([]);
      setCurrentSongId(null);
      setCurrentSong(null);
      songMapRef.current.clear();
      playerRef.current?.clearQueue().catch(() => undefined);
    });
  }, [runQueueMutationSync]);

  const removeFromQueue = useCallback(
    (songId: string) => {
      setOriginalQueue(prev => prev.filter(s => s.id !== songId));
      setShuffledQueue(prev => prev.filter(s => s.id !== songId));
      songMapRef.current.delete(songId);
      if (currentSongId === songId) playNext();
    },
    [currentSongId, playNext],
  );

  const setRepeat = useCallback(
    async (mode: RepeatMode) => {
      await runQueueMutation(async () => {
        const player = await ensurePlayer();
        if (!player) return;
        setRepeatState(mode);
        await player.setRepeatMode(mode);
      });
    },
    [ensurePlayer, runQueueMutation],
  );

  const resume = useCallback(async () => {
    await runQueueMutation(async () => {
      const player = await ensurePlayer();
      if (!player) return;
      await player.play();
    });
  }, [ensurePlayer, runQueueMutation]);

  const pause = useCallback(async () => {
    await runQueueMutation(async () => {
      const player = await ensurePlayer();
      if (!player) return;
      clearStationSongPollingTimer();
      setCurrentStationSong(null);
      await player.pause();
    });
  }, [clearStationSongPollingTimer, ensurePlayer, runQueueMutation]);

  const stop = useCallback(async () => {
    await runQueueMutation(async () => {
      const player = await ensurePlayer();
      if (!player) return;
      clearStationSongPollingTimer();
      setCurrentStationSong(null);
      clearStationPlayHistory();
      await player.stop();
    });
  }, [
    clearStationPlayHistory,
    clearStationSongPollingTimer,
    ensurePlayer,
    runQueueMutation,
  ]);

  useEffect(() => {
    clearStationSongPollingTimer();

    if (!isPlaying || !currentStation?.url || currentSong) {
      setCurrentStationSong(null);
      return;
    }

    const stationUrl = currentStation.urlResolved || currentStation.url;
    if (!stationUrl) {
      setCurrentStationSong(null);
      return;
    }

    setCurrentStationSong(null);
    updateStationNotificationMetadata(currentStation, null);

    let cancelled = false;

    const fetchSongMetadata = async () => {
      try {
        const response = await fetch(
          `https://sway.dablulite.dev/api/radio/get-song?url=${encodeURIComponent(
            stationUrl,
          )}`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;

        if (!data.error && data.StreamTitle) {
          const metaRes = await fetchTrackDataCached(
            data.StreamTitle as string,
          );

          if (metaRes.track && metaRes.albumArt) {
            const stationSongEntry = {
              track: metaRes.track,
              albumArt: metaRes.albumArt,
            };
            await updateStationNotificationMetadata(
              currentStation,
              stationSongEntry,
            );
            setCurrentStationSong(stationSongEntry);
            addSongToStationPlayHistory(stationSongEntry);
          }
        } else {
          await updateStationNotificationMetadata(currentStation, null);
          setCurrentStationSong(null);
          addIntermissionToStationPlayHistory();
          if (data.error === 'No metadata available') {
            console.log(
              `Station ${currentStation.name} does not support song metadata`,
            );
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch song metadata:', err);
        await updateStationNotificationMetadata(currentStation, null);
        setCurrentStationSong(null);
      }
    };

    fetchSongMetadata();
    stationSongPollingIntervalRef.current = setInterval(
      fetchSongMetadata,
      10000,
    );

    return () => {
      cancelled = true;
      clearStationSongPollingTimer();
    };
  }, [
    clearStationSongPollingTimer,
    currentSong,
    currentStation,
    currentStation?.name,
    currentStation?.url,
    currentStation?.urlResolved,
    isPlaying,
    addIntermissionToStationPlayHistory,
    addSongToStationPlayHistory,
    updateStationNotificationMetadata,
  ]);

  const updateSettings = useCallback(
    async (settings: Partial<AudioPlayerState>) => {
      await runQueueMutation(async () => {
        const player = await ensurePlayer();
        if (!player) return;

        if (settings.repeat !== undefined) {
          setRepeatState(settings.repeat);
          await player.setRepeatMode(settings.repeat);
        }
        if (settings.shuffle !== undefined && settings.shuffle !== shuffle) {
          await toggleShuffle();
        }
        if (settings.gaplessEnabled !== undefined)
          setGaplessEnabled(settings.gaplessEnabled);
        if (settings.exclusiveEnabled !== undefined) {
          setExclusiveEnabled(settings.exclusiveEnabled);
          if (settings.exclusiveEnabled) { UsbAudio.requestExclusive(settings.audioDevice ? Number(settings.audioDevice) : undefined).catch(()=>undefined) }
          else UsbAudio.releaseExclusive().catch(()=>undefined);
        }
        if (settings.bitPerfectEnabled !== undefined)
          setBitPerfectEnabled(settings.bitPerfectEnabled);
        if (settings.autoplayEnabled !== undefined)
          setAutoplayEnabled(settings.autoplayEnabled);
        if (settings.audioDevice !== undefined)
          setAudioDevice(settings.audioDevice);
      });
    },
    [ensurePlayer, runQueueMutation, shuffle, toggleShuffle],
  );

  const getAudioDevices = useCallback(async (): Promise<AudioDevice[]> => {
    try { const devs = await UsbAudio.getUsbDevices(); return devs.map(d=>({id:String(d.id),name:d.name})) } catch { return [] }
  }, []);
  const refreshDevices = useCallback(async () => {}, []);
  const onDevicesChanged = useCallback(
    (cb: (devices: AudioDevice[]) => void) => {
      const sub = UsbAudio.addListener('UsbAudioExclusiveGranted', async () => {
        try { const devs = await UsbAudio.getUsbDevices(); cb(devs.map(d=>({id:String(d.id),name:d.name}))) } catch {}
      });
      return () => sub.remove();
    },
    [],
  );

  const castStartSession = useCallback(async (deviceId: string) => {
    const p = playerRef.current ?? (await ensurePlayer());
    if (!p) return false;
    return p.castStartSession(deviceId);
  }, [ensurePlayer]);
  const castEndSession = useCallback(async (stopCasting = false) => {
    await playerRef.current?.castEndSession(stopCasting);
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────

  const contextValue = useMemo(
    () => ({
        isPlaying,
        currentStation,
        currentStationSong,
        stationPlayHistory,
        currentSong,
        currentSongId,
        queue,
        shuffle,
        repeat,
        duration,
        currentTime,
        isSeekable,
        isLoading,
        error,
        gaplessEnabled,
        exclusiveEnabled,
        bitPerfectEnabled,
        autoplayEnabled,
        audioDevice,
        play,
        playSong,
        shufflePlay,
        playFromQueue,
        resume,
        pause,
        stop,
        seek,
        updateSettings,
        getAudioDevices,
        refreshDevices,
        onSongEnded,
        onDevicesChanged,
        addToQueue,
        queueNext,
        clearQueue,
        removeFromQueue,
        toggleShuffle,
        setRepeat,
        playNext,
        playPrevious,
        castDevices,
        castState,
        connectedCastDevice,
        isCasting,
        castStartSession,
        castEndSession,
    }),
    [
      isPlaying, currentStation, currentStationSong, stationPlayHistory,
      currentSong, currentSongId, queue, shuffle, repeat, duration, currentTime,
      isSeekable, isLoading, error, gaplessEnabled, exclusiveEnabled,
      bitPerfectEnabled, autoplayEnabled, audioDevice, play, playSong, shufflePlay,
      playFromQueue, resume, pause, stop, seek, updateSettings, getAudioDevices,
      refreshDevices, onSongEnded, onDevicesChanged, addToQueue, queueNext,
      clearQueue, removeFromQueue, toggleShuffle, setRepeat, playNext, playPrevious,
      castDevices, castState, connectedCastDevice, isCasting, castStartSession, castEndSession,
    ],
  );

  return (
    <AudioPlayerContext.Provider value={contextValue}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const AudioPlayerProvider = useAudioPlayerProvider;

export const useAudioPlayer = (): AudioPlayerContextType => {
  const context = useContext(AudioPlayerContext);
  if (!context)
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  return context;
};
