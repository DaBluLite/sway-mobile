import React, { useEffect } from 'react';
import { AppState, Dimensions } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { useScreenCornerRadius } from '../src/hooks/useScreenCornerRadius';
import { getScreenCornerRadius } from '../src/utils/screenCornerRadius';

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn() },
  Dimensions: { addEventListener: jest.fn() },
}));

jest.mock('../src/utils/screenCornerRadius', () => ({
  getScreenCornerRadius: jest.fn(),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const readRadius = jest.mocked(getScreenCornerRadius);
const removeDimensions = jest.fn();
const removeAppState = jest.fn();
let onDimensionsChange: () => void;
let onAppStateChange: (state: AppStateStatus) => void;
let renderer: ReactTestRenderer;
let radius: number;

function TestComponent() {
  const value = useScreenCornerRadius();
  useEffect(() => {
    radius = value;
  }, [value]);
  return null;
}

beforeEach(() => {
  jest.resetAllMocks();
  readRadius.mockResolvedValue(24);
  jest
    .mocked(Dimensions.addEventListener)
    .mockImplementation((_event, listener) => {
      onDimensionsChange = () => listener({} as Parameters<typeof listener>[0]);
      return { remove: removeDimensions };
    });
  jest
    .mocked(AppState.addEventListener)
    .mockImplementation((_event, listener) => {
      onAppStateChange = listener;
      return { remove: removeAppState };
    });
});

afterEach(async () => {
  await act(() => renderer.unmount());
});

async function mount() {
  await act(() => {
    renderer = create(<TestComponent />);
  });
}

it('starts at zero and loads the radius', async () => {
  let resolveRadius!: (value: number) => void;
  readRadius.mockReturnValueOnce(
    new Promise(resolve => {
      resolveRadius = resolve;
    }),
  );
  await mount();
  expect(radius).toBe(0);

  await act(() => resolveRadius(32));
  expect(radius).toBe(32);
});

it('refreshes after display changes and when the app resumes', async () => {
  await mount();
  expect(radius).toBe(24);

  readRadius.mockResolvedValueOnce(32);
  await act(() => onDimensionsChange());
  expect(radius).toBe(32);

  await act(() => onAppStateChange('background'));
  expect(readRadius).toHaveBeenCalledTimes(2);

  readRadius.mockResolvedValueOnce(40);
  await act(() => onAppStateChange('active'));
  expect(radius).toBe(40);
});

it('retains the last radius after a failed read and retries on resume', async () => {
  await mount();
  readRadius.mockRejectedValueOnce(new Error('No active Activity'));
  await act(() => onDimensionsChange());
  expect(radius).toBe(24);

  readRadius.mockResolvedValueOnce(32);
  await act(() => onAppStateChange('active'));
  expect(radius).toBe(32);
});

it('ignores stale reads that finish after newer requests', async () => {
  let resolveRadius!: (value: number) => void;
  readRadius.mockReturnValueOnce(
    new Promise(resolve => {
      resolveRadius = resolve;
    }),
  );
  await mount();

  readRadius.mockResolvedValueOnce(40);
  await act(() => onDimensionsChange());
  await act(() => resolveRadius(24));
  expect(radius).toBe(40);
});

it('removes subscriptions and ignores pending reads after unmount', async () => {
  let resolveRadius!: (value: number) => void;
  readRadius.mockReturnValueOnce(
    new Promise(resolve => {
      resolveRadius = resolve;
    }),
  );
  await mount();
  await act(() => renderer.unmount());
  expect(removeDimensions).toHaveBeenCalledTimes(1);
  expect(removeAppState).toHaveBeenCalledTimes(1);

  await act(() => resolveRadius(32));
  expect(radius).toBe(0);
});
