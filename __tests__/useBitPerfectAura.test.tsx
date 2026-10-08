import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { useBitPerfectAura } from '../src/hooks/useBitPerfectAura';
import { useAudioPlayer } from '../src/contexts/audio-player-context';
import { BtCodec } from '../src/utils/btCodec';
import { UsbAudio } from '../src/utils/usbAudio';
import { getItem, setItem, STORES } from '../src/utils/storage';
import {
  AURA_COOLDOWN_MS,
  AURA_DURATION_MS,
} from '../src/utils/bitPerfectAura';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { currentState: 'active', addEventListener: jest.fn() },
}));
jest.mock('../src/contexts/audio-player-context', () => ({
  useAudioPlayer: jest.fn(),
}));
jest.mock('../src/utils/btCodec', () => ({
  BtCodec: { getCurrentCodecInfo: jest.fn() },
}));
jest.mock('../src/utils/usbAudio', () => ({
  UsbAudio: { getPlaybackState: jest.fn(), addListener: jest.fn() },
}));
jest.mock('../src/utils/storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  STORES: { SETTINGS: 'settings' },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const START = 1_000_000;
const matchingCodec = { codecType: 0, sampleRate: 96000, bitsPerSample: 24 };
const mismatchingCodec = { ...matchingCodec, sampleRate: 48000 };
const directUsb = {
  connected: true,
  exclusiveGranted: true,
  directSupported: true,
  appliedSampleRate: 96000,
  appliedBitDepth: 24,
};
const readCodec = jest.mocked(BtCodec.getCurrentCodecInfo);
const readUsb = jest.mocked(UsbAudio.getPlaybackState);
const readPlayer = jest.mocked(useAudioPlayer);
const usbListeners = new Map<string, () => void>();
const removeSubscriptions: jest.Mock[] = [];
let onAppStateChange: (state: AppStateStatus) => void;
let renderer: ReactTestRenderer | undefined;
let visible: boolean;
let player: {
  currentSong: { id: string; samplingRate: number; bitDepth: number } | null;
  currentSongId: string | null;
  isPlaying: boolean;
  isCasting: boolean;
};

function TestComponent() {
  const value = useBitPerfectAura();
  useEffect(() => {
    visible = value;
  }, [value]);
  return null;
}

function providePlayer() {
  readPlayer.mockReturnValue(player as ReturnType<typeof useAudioPlayer>);
}

async function mount() {
  providePlayer();
  await act(() => {
    renderer = create(<TestComponent />);
  });
}

async function update(overrides: Partial<typeof player>) {
  player = { ...player, ...overrides };
  providePlayer();
  await act(() => renderer!.update(<TestComponent />));
}

async function changeSong(id: string) {
  await update({
    currentSongId: id,
    currentSong: { id, samplingRate: 96000, bitDepth: 24 },
  });
}

async function advance(ms: number) {
  await act(() => jest.advanceTimersByTime(ms));
}

async function emitUsb(event = 'UsbAudioParamsApplied') {
  const listener = usbListeners.get(event);
  expect(listener).toBeDefined();
  await act(() => listener!());
}

async function changeAppState(state: AppStateStatus) {
  Object.defineProperty(AppState, 'currentState', {
    value: state,
    configurable: true,
  });
  await act(() => onAppStateChange(state));
}

async function unmount() {
  await act(() => renderer!.unmount());
  renderer = undefined;
}

function deferredCodec() {
  let resolve!: (codec: typeof matchingCodec) => void;
  const promise = new Promise<typeof matchingCodec>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(START);
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  usbListeners.clear();
  removeSubscriptions.length = 0;
  renderer = undefined;
  visible = false;
  player = {
    currentSongId: 'a',
    currentSong: { id: 'a', samplingRate: 96000, bitDepth: 24 },
    isPlaying: true,
    isCasting: false,
  };
  readCodec.mockResolvedValue(matchingCodec);
  readUsb.mockResolvedValue(null);
  jest.mocked(UsbAudio.addListener).mockImplementation((event, listener) => {
    usbListeners.set(event, () => listener({}));
    const remove = jest.fn(() => usbListeners.delete(event));
    removeSubscriptions.push(remove);
    return { remove };
  });
  jest
    .mocked(AppState.addEventListener)
    .mockImplementation((_event, listener) => {
      onAppStateChange = listener;
      const remove = jest.fn();
      removeSubscriptions.push(remove);
      return { remove };
    });
});

afterEach(async () => {
  if (renderer) await unmount();
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('shows for matching Bluetooth and hides exactly five seconds later', async () => {
  await mount();
  expect(visible).toBe(true);
  expect(getItem).toHaveBeenCalledWith(
    STORES.SETTINGS,
    'bit-perfect-aura-last-shown',
  );
  expect(setItem).toHaveBeenCalledWith(
    STORES.SETTINGS,
    'bit-perfect-aura-last-shown',
    START,
  );

  await advance(AURA_DURATION_MS - 1);
  expect(visible).toBe(true);
  await advance(1);
  expect(visible).toBe(false);
  await advance(1000);
  expect(visible).toBe(false);
  expect(setItem).toHaveBeenCalledTimes(1);
});

it('shows for matching direct USB playback state without Bluetooth', async () => {
  readCodec.mockRejectedValue(new Error('No Bluetooth device'));
  readUsb.mockResolvedValue(directUsb);
  await mount();
  expect(visible).toBe(true);
});

it.each([
  'UsbAudioParamsApplied',
  'UsbAudioExclusiveGranted',
  'UsbAudioDeviceAttached',
])('checks newly qualifying USB playback on %s', async event => {
  readCodec.mockResolvedValue(mismatchingCodec);
  await mount();
  expect(visible).toBe(false);

  readUsb.mockResolvedValue(directUsb);
  await emitUsb(event);
  expect(visible).toBe(true);
  expect(Date.now()).toBe(START);
});

it('detects late Bluetooth negotiation on the one-second poll', async () => {
  readCodec.mockResolvedValue(mismatchingCodec);
  await mount();
  expect(visible).toBe(false);
  readCodec.mockResolvedValue(matchingCodec);

  await advance(999);
  expect(visible).toBe(false);
  expect(readCodec).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(visible).toBe(true);
  expect(readCodec).toHaveBeenCalledTimes(2);
});

it.each(['paused', 'casting', 'nonAndroid', 'no metadata', 'no song'])(
  'does not display or read playback while %s',
  async condition => {
    if (condition === 'paused') player.isPlaying = false;
    if (condition === 'casting') player.isCasting = true;
    if (condition === 'nonAndroid') {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        configurable: true,
      });
    }
    if (condition === 'no metadata') player.currentSong!.samplingRate = 0;
    if (condition === 'no song') {
      player.currentSongId = null;
      player.currentSong = null;
    }
    await mount();
    await advance(1000);
    expect(visible).toBe(false);
    expect(readCodec).not.toHaveBeenCalled();
    expect(readUsb).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  },
);

it('checks playback when the app resumes from the background', async () => {
  Object.defineProperty(AppState, 'currentState', {
    value: 'background',
    configurable: true,
  });
  readCodec.mockResolvedValue(mismatchingCodec);
  await mount();
  expect(visible).toBe(false);
  readCodec.mockResolvedValue(matchingCodec);
  await changeAppState('active');
  expect(visible).toBe(true);
});

it('records background achievements without showing or consuming the cooldown', async () => {
  Object.defineProperty(AppState, 'currentState', {
    value: 'background',
    configurable: true,
  });
  await mount();
  expect(visible).toBe(false);
  expect(setItem).not.toHaveBeenCalled();
  await changeSong('b');
  await changeAppState('active');
  expect(visible).toBe(false);
  expect(setItem).not.toHaveBeenCalled();

  readCodec.mockResolvedValue(mismatchingCodec);
  await changeSong('c');
  readCodec.mockResolvedValue(matchingCodec);
  await changeSong('d');
  expect(visible).toBe(true);
  expect(setItem).toHaveBeenCalledTimes(1);
});

it('preserves preceding achievement after disconnect and five minutes elapsed', async () => {
  await mount();
  await advance(AURA_DURATION_MS);
  readCodec.mockRejectedValue(new Error('Disconnected'));
  await advance(1000);
  await update({ isPlaying: false });
  jest.setSystemTime(START + AURA_COOLDOWN_MS);
  readCodec.mockResolvedValue(matchingCodec);
  await update({ isPlaying: true });
  expect(visible).toBe(false);
  await changeSong('b');
  expect(visible).toBe(false);
  expect(setItem).toHaveBeenCalledTimes(1);
});

it('enforces cooldown across nonqualifying songs and allows a fresh song at its boundary', async () => {
  await mount();
  await advance(AURA_DURATION_MS);
  readCodec.mockResolvedValue(mismatchingCodec);
  await changeSong('b');
  jest.setSystemTime(START + AURA_COOLDOWN_MS - 1);
  readCodec.mockResolvedValue(matchingCodec);
  await changeSong('c');
  expect(visible).toBe(false);

  readCodec.mockResolvedValue(mismatchingCodec);
  await changeSong('d');
  jest.setSystemTime(START + AURA_COOLDOWN_MS);
  readCodec.mockResolvedValue(matchingCodec);
  await changeSong('e');
  expect(visible).toBe(true);
  expect(setItem).toHaveBeenCalledTimes(2);
});

it('respects a persisted timestamp and never queues an already-qualified song at five minutes', async () => {
  jest.mocked(getItem).mockReturnValue(START);
  await mount();
  expect(visible).toBe(false);
  await advance(AURA_COOLDOWN_MS);
  expect(visible).toBe(false);
  expect(setItem).not.toHaveBeenCalled();

  readCodec.mockResolvedValue(mismatchingCodec);
  await changeSong('b');
  readCodec.mockResolvedValue(matchingCodec);
  await changeSong('c');
  expect(visible).toBe(true);
  expect(setItem).toHaveBeenCalledWith(
    STORES.SETTINGS,
    'bit-perfect-aura-last-shown',
    START + AURA_COOLDOWN_MS,
  );
});

it('allows a cold-start show exactly five minutes after the persisted timestamp', async () => {
  jest.mocked(getItem).mockReturnValue(START - AURA_COOLDOWN_MS);
  await mount();
  expect(visible).toBe(true);
});

it('ignores stale async playback results after the song changes', async () => {
  const pending = deferredCodec();
  readCodec.mockReturnValueOnce(pending.promise);
  readCodec.mockResolvedValue(mismatchingCodec);
  await mount();
  await changeSong('b');
  await act(() => pending.resolve(matchingCodec));
  expect(visible).toBe(false);
  expect(setItem).not.toHaveBeenCalled();

  readCodec.mockResolvedValue(matchingCodec);
  await emitUsb();
  expect(visible).toBe(true);
});

it('ignores a stale request after a newer playback check finishes', async () => {
  const pending = deferredCodec();
  readCodec.mockReturnValueOnce(pending.promise);
  readCodec.mockResolvedValue(mismatchingCodec);
  await mount();
  await emitUsb();
  await act(() => pending.resolve(matchingCodec));
  expect(visible).toBe(false);
  expect(setItem).not.toHaveBeenCalled();
});

it('records in-flight background achievements without queuing an aura on resume', async () => {
  const pending = deferredCodec();
  readCodec.mockReturnValueOnce(pending.promise);
  await mount();
  await changeAppState('background');
  await act(() => pending.resolve(matchingCodec));
  expect(visible).toBe(false);
  expect(setItem).not.toHaveBeenCalled();
  await changeAppState('active');
  expect(visible).toBe(false);
});

it('removes subscriptions and ignores pending async playback after unmount', async () => {
  const pending = deferredCodec();
  readCodec.mockReturnValueOnce(pending.promise);
  await mount();
  expect(usbListeners.size).toBe(6);
  expect(removeSubscriptions).toHaveLength(7);
  await unmount();
  removeSubscriptions.forEach(remove =>
    expect(remove).toHaveBeenCalledTimes(1),
  );
  expect(usbListeners.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);

  await act(() => pending.resolve(matchingCodec));
  await advance(1000);
  expect(visible).toBe(false);
  expect(setItem).not.toHaveBeenCalled();
  expect(readCodec).toHaveBeenCalledTimes(1);
});

it('cleans up both the hide timeout and polling interval on unmount', async () => {
  await mount();
  expect(visible).toBe(true);
  expect(jest.getTimerCount()).toBe(2);
  await unmount();
  expect(jest.getTimerCount()).toBe(0);
  removeSubscriptions.forEach(remove =>
    expect(remove).toHaveBeenCalledTimes(1),
  );
});

it('cleans up old subscriptions and polling when playback pauses', async () => {
  readCodec.mockResolvedValue(mismatchingCodec);
  await mount();
  const oldSubscriptions = [...removeSubscriptions];
  await update({ isPlaying: false });
  oldSubscriptions.forEach(remove => expect(remove).toHaveBeenCalledTimes(1));
  expect(jest.getTimerCount()).toBe(0);
  expect(usbListeners.size).toBe(0);
  await advance(1000);
  expect(readCodec).toHaveBeenCalledTimes(1);
  expect(visible).toBe(false);
});
