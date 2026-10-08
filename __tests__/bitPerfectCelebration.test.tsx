import React, { useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useReducedMotion,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useBitPerfectAura } from '../src/hooks/useBitPerfectAura';
import {
  BitPerfectCelebrationProvider,
  useBitPerfectCelebration,
} from '../src/contexts/bit-perfect-celebration-context';
import { BitPerfectLabel } from '../src/components/bit-perfect-label';

jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('react-native-reanimated', () => {
  const { useRef } = require('react');
  return {
    __esModule: true,
    default: { View: 'AnimatedView' },
    useSharedValue: (initial: number) => useRef({ value: initial }).current,
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useReducedMotion: jest.fn(() => false),
    cancelAnimation: jest.fn(),
    ReduceMotion: { Never: 'never' },
    Easing: {
      cubic: 'cubic',
      in: jest.fn((easing: unknown) => ({ direction: 'in', easing })),
      out: jest.fn((easing: unknown) => ({ direction: 'out', easing })),
    },
    withTiming: jest.fn((to: number, config: unknown) => ({ to, config })),
    withDelay: jest.fn(
      (delay: number, animation: unknown, reduceMotion: unknown) => ({
        delay,
        animation,
        reduceMotion,
      }),
    ),
    withSequence: jest.fn((...steps: unknown[]) => ({ steps })),
  };
});
jest.mock('../src/hooks/useBitPerfectAura', () => ({
  useBitPerfectAura: jest.fn(),
}));
jest.mock('../src/contexts/theme-context', () => ({
  useAppTheme: () => ({ theme: { colors: { textMuted: 'muted' } } }),
}));
jest.mock('../src/components/text', () => ({
  __esModule: true,
  default: 'AppText',
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Celebration = ReturnType<typeof useBitPerfectCelebration>;
const readAura = jest.mocked(useBitPerfectAura);
let renderer: ReactTestRenderer | undefined;
let consumers: Celebration[];

function Consumer({ index }: { index: number }) {
  const value = useBitPerfectCelebration();
  useEffect(() => {
    consumers[index] = value;
  }, [index, value]);
  return null;
}

function harness() {
  return (
    <BitPerfectCelebrationProvider>
      <Consumer index={0} />
      <Consumer index={1} />
      <BitPerfectLabel />
    </BitPerfectCelebrationProvider>
  );
}

async function mount(visible = false) {
  readAura.mockReturnValue(visible);
  await act(() => {
    renderer = create(harness());
  });
}

async function update(visible: boolean) {
  readAura.mockReturnValue(visible);
  await act(() => renderer!.update(harness()));
}

async function unmount() {
  await act(() => renderer!.unmount());
  renderer = undefined;
}

function label() {
  return renderer!.root.findByType('AnimatedView' as React.ElementType);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useReducedMotion).mockReturnValue(false);
  consumers = [];
  renderer = undefined;
});

afterEach(async () => {
  if (renderer) await unmount();
});

it('shares visibility and one stable progress value between consumers', async () => {
  await mount();
  const progress = consumers[0].progress;
  expect(readAura).toHaveBeenCalledTimes(1);
  expect(consumers[0]).toBe(consumers[1]);
  expect(consumers[0].visible).toBe(false);
  expect(progress.value).toBe(0);

  await update(true);
  expect(readAura).toHaveBeenCalledTimes(2);
  expect(consumers[0]).toBe(consumers[1]);
  expect(consumers[0].visible).toBe(true);
  expect(consumers[0].progress).toBe(progress);

  await update(false);
  expect(readAura).toHaveBeenCalledTimes(3);
  expect(consumers[0]).toBe(consumers[1]);
  expect(consumers[0].visible).toBe(false);
  expect(consumers[0].progress).toBe(progress);
});

it('configures a 400ms fade, 4000ms hold and 600ms fade with ReduceMotion.Never', async () => {
  await mount(true);
  expect(withTiming).toHaveBeenCalledTimes(2);
  expect(withTiming).toHaveBeenNthCalledWith(1, 1, {
    duration: 400,
    easing: Easing.out(Easing.cubic),
    reduceMotion: ReduceMotion.Never,
  });
  expect(withTiming).toHaveBeenNthCalledWith(2, 0, {
    duration: 600,
    easing: Easing.in(Easing.cubic),
    reduceMotion: ReduceMotion.Never,
  });
  const [fadeIn, fadeOut] = jest
    .mocked(withTiming)
    .mock.results.map(result => result.value);
  const hold = jest.mocked(withDelay).mock.results[0].value;
  expect(withDelay).toHaveBeenCalledTimes(1);
  expect(withDelay).toHaveBeenCalledWith(4000, fadeOut, ReduceMotion.Never);
  expect(withSequence).toHaveBeenCalledTimes(1);
  expect(withSequence).toHaveBeenCalledWith(ReduceMotion.Never, fadeIn, hold);
  expect(consumers[0].progress.value).toBe(
    jest.mocked(withSequence).mock.results[0].value,
  );
  const durations = jest
    .mocked(withTiming)
    .mock.calls.map(([, config]) => config!.duration!);
  expect(
    durations[0] + jest.mocked(withDelay).mock.calls[0][0] + durations[1],
  ).toBe(5000);
});

it('cancels and resets on hide without scheduling another sequence', async () => {
  await mount();
  expect(cancelAnimation).toHaveBeenCalledWith(consumers[0].progress);
  expect(withSequence).not.toHaveBeenCalled();
  await update(true);
  const progress = consumers[0].progress;
  progress.value = 0.5;
  jest.mocked(cancelAnimation).mockClear();

  await update(false);
  // The previous effect cleans up, then the hidden effect cancels and resets.
  expect(cancelAnimation).toHaveBeenCalledTimes(2);
  expect(cancelAnimation).toHaveBeenNthCalledWith(1, progress);
  expect(cancelAnimation).toHaveBeenNthCalledWith(2, progress);
  expect(progress.value).toBe(0);
  expect(withSequence).toHaveBeenCalledTimes(1);
});

it('cancels the shared animation on unmount', async () => {
  await mount(true);
  const progress = consumers[0].progress;
  jest.mocked(cancelAnimation).mockClear();
  await unmount();
  expect(cancelAnimation).toHaveBeenCalledTimes(1);
  expect(cancelAnimation).toHaveBeenCalledWith(progress);
});

it('rejects consumers outside the provider', async () => {
  let error: unknown;
  function MissingProvider() {
    let contextError: unknown;
    try {
      useBitPerfectCelebration();
    } catch (caught) {
      contextError = caught;
    }
    useEffect(() => {
      error = contextError;
    }, [contextError]);
    return null;
  }
  await act(() => {
    renderer = create(<MissingProvider />);
  });
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(
    'useBitPerfectCelebration must be used within BitPerfectCelebrationProvider',
  );
});

// These assertions evaluate the style factory, not UI-thread animation frames.
it.each([
  [0, 0, -4, 8],
  [0.5, 9, -2, 4],
  [1, 18, -0, 0],
])(
  'computes label styles at progress %s',
  async (progress, height, marginTop, translateY) => {
    await mount(true);
    consumers[0].progress.value = progress;
    await update(true);
    expect(label().props.style[1]).toEqual({
      opacity: progress,
      height,
      marginTop,
      transform: [{ translateY }],
    });
    const text = renderer!.root.findByType('AppText' as React.ElementType);
    expect(text.props.children).toBe('Bit-Perfect Mode');
    expect(text.props.style).toEqual([
      { fontSize: 10, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
      { color: 'muted' },
    ]);
  },
);

it.each([0, 0.5, 1])(
  'disables slide under reduced motion at progress %s',
  async progress => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await mount(true);
    consumers[0].progress.value = progress;
    await update(true);
    expect(label().props.style[1]).toEqual({
      opacity: progress,
      height: 18 * progress,
      marginTop: -4 * (1 - progress),
      transform: [{ translateY: 0 }],
    });
  },
);

it('is always noninteractive and hides accessibility descendants when invisible', async () => {
  await mount();
  expect(label().props).toMatchObject({
    pointerEvents: 'none',
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  });
  await update(true);
  expect(label().props).toMatchObject({
    pointerEvents: 'none',
    accessibilityElementsHidden: false,
    importantForAccessibility: 'auto',
  });
  await update(false);
  expect(label().props).toMatchObject({
    pointerEvents: 'none',
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  });
});
