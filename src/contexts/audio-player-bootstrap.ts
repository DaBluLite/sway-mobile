import { createAudioPlayer, type AudioPlayer, type CastDevice, type CastState } from '@dablulite/rn-audio-stream';

const DEFAULT_PLAYER_VOLUME = 1;
const DEFAULT_PLAYER_REPEAT = 'off' as const;
const GLOBAL_AUDIO_PLAYER_STORE_KEY = '__SWAY_AUDIO_PLAYER_STORE__';

type AudioPlayerStore = {
  player: AudioPlayer | null;
  promise: Promise<AudioPlayer> | null;
};

const getGlobalAudioPlayerStore = (): AudioPlayerStore => {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_AUDIO_PLAYER_STORE_KEY]?: AudioPlayerStore;
  };
  if (!globalStore[GLOBAL_AUDIO_PLAYER_STORE_KEY]) {
    globalStore[GLOBAL_AUDIO_PLAYER_STORE_KEY] = { player: null, promise: null };
  }
  return globalStore[GLOBAL_AUDIO_PLAYER_STORE_KEY];
};

// Subscribers so React layer can receive cast events without calling enableCast
type CastStateCb = (s: CastState, d: CastDevice | null) => void;
type CastDevicesCb = (d: CastDevice[]) => void;
type CastSessionStartCb = (d: CastDevice) => void;
type CastSessionEndCb = () => void;

const castStateSubs = new Set<CastStateCb>();
const castDevicesSubs = new Set<CastDevicesCb>();
const castSessionStartSubs = new Set<CastSessionStartCb>();
const castSessionEndSubs = new Set<CastSessionEndCb>();

export function subscribeCastState(cb: CastStateCb) { castStateSubs.add(cb); return () => castStateSubs.delete(cb); }
export function subscribeCastDevices(cb: CastDevicesCb) { castDevicesSubs.add(cb); return () => castDevicesSubs.delete(cb); }
export function subscribeCastSessionStart(cb: CastSessionStartCb) { castSessionStartSubs.add(cb); return () => castSessionStartSubs.delete(cb); }
export function subscribeCastSessionEnd(cb: CastSessionEndCb) { castSessionEndSubs.add(cb); return () => castSessionEndSubs.delete(cb); }

export function getOrCreatePlayer(): Promise<AudioPlayer> {
  const store = getGlobalAudioPlayerStore();
  if (store.player) return Promise.resolve(store.player);
  if (store.promise) return store.promise;
  store.promise = createAudioPlayer({
    volume: DEFAULT_PLAYER_VOLUME,
    repeatMode: DEFAULT_PLAYER_REPEAT,
    onCastStateChange: (s, d) => castStateSubs.forEach(cb => cb(s, d)),
    onCastDevicesChange: d => castDevicesSubs.forEach(cb => cb(d)),
    onCastSessionStart: d => castSessionStartSubs.forEach(cb => cb(d)),
    onCastSessionEnd: () => castSessionEndSubs.forEach(cb => cb()),
  },
    require('./assets/sway-dark.png'),
  )
    .then(player => {
      store.player = player;
      store.promise = null;
      return player;
    })
    .catch(err => { store.player = null; store.promise = null; throw err; });
  return store.promise;
}

export const bootstrapAudioPlayer = (): Promise<AudioPlayer> => getOrCreatePlayer();
