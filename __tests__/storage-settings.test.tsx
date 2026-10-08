import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, getSnapshot } from '../src/components/custom-alert-api';
import {
  clearStorageCache,
  getStorageStats,
  releaseStoragePlayback,
} from '../src/services/storage-service';
import { useAudioPlayer } from '../src/contexts/audio-player-context';
import StorageSettingsScreen from '../src/screens/settings/storage';

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useFocusEffect: jest.fn((callback: () => () => void) => {
    const { useEffect } = require('react');
    useEffect(callback, [callback]);
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft' }));
jest.mock('../src/components/text', () => ({
  __esModule: true,
  default: 'AppText',
}));
jest.mock('../src/contexts/theme-context', () => ({
  useAppTheme: () => ({
    theme: {
      colors: {
        text: 'black',
        textMuted: 'gray',
        background: 'white',
        notification: 'red',
      },
    },
  }),
}));
jest.mock('../src/contexts/audio-player-context', () => ({
  useAudioPlayer: jest.fn(),
}));
jest.mock('../src/services/storage-service', () => ({
  getStorageStats: jest.fn(),
  clearStorageCache: jest.fn(),
  releaseStoragePlayback: jest.fn(),
  formatStorageBytes: (bytes: number) => `${bytes} B`,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
const initialStats = { cacheBytes: 100, freeBytes: 900, totalBytes: 1000 };
const clearedStats = { cacheBytes: 0, freeBytes: 1000, totalBytes: 1000 };
const stop = jest.fn();
const clearQueue = jest.fn();

async function mount() {
  await act(async () => {
    renderer = create(<StorageSettingsScreen />);
  });
}

function button(text: string) {
  return renderer.root
    .findAllByType('Pressable' as React.ElementType)
    .find(node =>
      node
        .findAllByType('AppText' as React.ElementType)
        .some(child => child.props.children === text),
    )!;
}

function texts() {
  return renderer.root
    .findAllByType('AppText' as React.ElementType)
    .map(node => node.props.children);
}

async function confirm() {
  await act(async () => {
    button('Clear cache').props.onPress();
  });
  const destructive = getSnapshot().buttons.find(
    item => item.style === 'destructive',
  )!;
  Alert.dismiss();
  await act(async () => {
    destructive.onPress?.();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  Alert.dismiss();
  jest
    .mocked(useAudioPlayer)
    .mockReturnValue({
      stop,
      clearQueue,
      isPlaying: false,
      currentSongId: null,
      currentStation: null,
      queue: [],
    } as unknown as ReturnType<typeof useAudioPlayer>);
  jest.mocked(releaseStoragePlayback).mockResolvedValue(undefined);
  jest.mocked(getStorageStats).mockResolvedValue(initialStats);
  jest.mocked(clearStorageCache).mockImplementation(async options => {
    await options?.releasePlayback?.();
    return { stats: clearedStats, failedPaths: [], retainedTemporaryPaths: [] };
  });
});

afterEach(async () => {
  if (renderer) {
    await act(async () => {
      renderer.unmount();
    });
  }
  Alert.dismiss();
});

test('reads disk stats on focus and displays cache and available space', async () => {
  await mount();
  expect(getStorageStats).toHaveBeenCalledTimes(1);
  expect(texts()).toContain('100 B');
  expect(texts()).toContain('900 B');
});

test('requires confirmation and cancel does not delete files', async () => {
  await mount();
  await act(async () => {
    button('Clear cache').props.onPress();
  });
  expect(clearStorageCache).not.toHaveBeenCalled();
  expect(getSnapshot().title).toBe('Clear cache?');
  expect(getSnapshot().message).toContain(
    'files saved outside the app cache will not be removed',
  );
  await act(async () => {
    getSnapshot()
      .buttons.find(item => item.style === 'cancel')!
      .onPress?.();
  });
  Alert.dismiss();
  expect(clearStorageCache).not.toHaveBeenCalled();
  await confirm();
  expect(clearStorageCache).toHaveBeenCalledTimes(1);
  expect(texts()).toContain('0 B');
  expect(texts()).toContain('1000 B');
  expect(texts()).toContain('Cache cleared.');
});

test('disables actions while clearing and ignores a duplicate callback', async () => {
  await mount();
  let resolve!: (value: {
    stats: typeof clearedStats;
    failedPaths: string[];
    retainedTemporaryPaths: string[];
  }) => void;
  jest.mocked(clearStorageCache).mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    }),
  );
  await confirm();
  expect(button('Clear cache').props.disabled).toBe(true);
  expect(button('Refresh').props.disabled).toBe(true);
  await act(async () => {
    button('Clear cache').props.onPress();
  });
  expect(clearStorageCache).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve({
      stats: clearedStats,
      failedPaths: [],
      retainedTemporaryPaths: [],
    });
  });
  expect(button('Clear cache').props.disabled).toBe(false);
});

test('refreshes on app return and renewed focus', async () => {
  await mount();
  jest
    .mocked(getStorageStats)
    .mockResolvedValue({ ...initialStats, cacheBytes: 200 });
  const listener = jest.mocked(AppState.addEventListener).mock.calls[0][1];
  await act(async () => {
    listener('active');
  });
  expect(texts()).toContain('200 B');
  const focusCallback = jest.mocked(useFocusEffect).mock.calls[0][0];
  let cleanup: (() => void) | undefined;
  await act(async () => {
    cleanup = focusCallback() as () => void;
  });
  cleanup?.();
  expect(getStorageStats).toHaveBeenCalledTimes(3);
});

test('shows storage errors and allows a retry', async () => {
  jest
    .mocked(getStorageStats)
    .mockRejectedValueOnce(new Error('Storage unavailable'));
  await mount();
  expect(texts()).toContain('Storage unavailable');
  expect(button('Refresh').props.disabled).toBe(false);
  await act(async () => {
    button('Refresh').props.onPress();
  });
  expect(texts()).toContain('100 B');
  expect(texts()).not.toContain('Storage unavailable');
});

test('reports partial clearing rather than claiming all cache was removed', async () => {
  jest.mocked(clearStorageCache).mockResolvedValueOnce({
    stats: { ...clearedStats, cacheBytes: 40 },
    failedPaths: ['/cache/locked'],
    retainedTemporaryPaths: [],
  });
  await mount();
  await confirm();
  expect(getSnapshot().title).toBe('Cache partly cleared');
  expect(texts()).toContain('40 B');
  expect(texts()).not.toContain('Cache cleared.');
});

test('warns explicitly about stopping and losing the queue, and cancellation does not release playback', async () => {
  jest
    .mocked(useAudioPlayer)
    .mockReturnValue({
      ...useAudioPlayer(),
      isPlaying: true,
      currentSongId: 'song',
    });
  await mount();
  await act(async () => {
    button('Clear cache').props.onPress();
  });
  expect(getSnapshot().title).toBe('Stop playback and clear cache?');
  expect(getSnapshot().message).toContain('queued tracks will be removed');
  expect(getSnapshot().message).toContain('playback position will be lost');
  expect(releaseStoragePlayback).not.toHaveBeenCalled();
  getSnapshot()
    .buttons.find(item => item.style === 'cancel')!
    .onPress?.();
  Alert.dismiss();
  expect(releaseStoragePlayback).not.toHaveBeenCalled();
  await confirm();
  expect(releaseStoragePlayback).toHaveBeenCalledWith({ stop, clearQueue });
  expect(texts()).toContain('0 B');
});

test('reports retained temporary files with wait and retry guidance, not a restart requirement', async () => {
  jest
    .mocked(clearStorageCache)
    .mockResolvedValueOnce({
      stats: { ...clearedStats, cacheBytes: 10 },
      failedPaths: [],
      retainedTemporaryPaths: ['/cache/audio-cache/song.cache.tmp'],
    });
  await mount();
  await confirm();
  expect(getSnapshot().title).toBe('Cache partly cleared');
  expect(getSnapshot().message).toContain('Wait a moment, then retry');
  expect(getSnapshot().message).toContain('does not mean a download is active');
  expect(texts()).toContain('10 B');
  expect(button('Clear cache').props.disabled).toBe(false);
});

test('explains failed playback release and refreshes stats after a rejected clear', async () => {
  jest
    .mocked(clearStorageCache)
    .mockRejectedValueOnce(new Error('Playback could not be released'));
  await mount();
  await confirm();
  expect(getSnapshot().title).toBe('Unable to clear cache');
  expect(getSnapshot().message).toBe('Playback could not be released');
  expect(getStorageStats).toHaveBeenCalledTimes(2);
  expect(button('Clear cache').props.disabled).toBe(false);
});
