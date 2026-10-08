import { NativeModules, Platform } from 'react-native';
import {
  getScreenCornerRadii,
  getScreenCornerRadius,
} from '../src/utils/screenCornerRadius';

jest.mock('react-native', () => ({
  NativeModules: {},
  Platform: { OS: 'android' },
}));

const unsupportedRadii = {
  isSupported: false,
  topLeft: 0,
  topRight: 0,
  bottomLeft: 0,
  bottomRight: 0,
};

const getCornerRadii = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  NativeModules.ScreenCornerRadiusModule = { getCornerRadii };
});

it('returns all native radii without changing their layout units', async () => {
  const radii = {
    isSupported: true,
    topLeft: 24.5,
    topRight: 24.5,
    bottomLeft: 32,
    bottomRight: 32,
  };
  getCornerRadii.mockResolvedValueOnce(radii);

  await expect(getScreenCornerRadii()).resolves.toEqual(radii);
  expect(getCornerRadii).toHaveBeenCalledTimes(1);
});

it('returns the largest radius for displays with unequal corners', async () => {
  getCornerRadii.mockResolvedValueOnce({
    isSupported: true,
    topLeft: 20,
    topRight: 24,
    bottomLeft: 32,
    bottomRight: 28,
  });

  await expect(getScreenCornerRadius()).resolves.toBe(32);
});

it('preserves the unsupported result from older Android versions', async () => {
  getCornerRadii.mockResolvedValue(unsupportedRadii);

  await expect(getScreenCornerRadii()).resolves.toEqual(unsupportedRadii);
  await expect(getScreenCornerRadius()).resolves.toBe(0);
});

it('returns an unsupported result on iOS without calling native code', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });

  await expect(getScreenCornerRadii()).resolves.toEqual(unsupportedRadii);
  await expect(getScreenCornerRadius()).resolves.toBe(0);
  expect(getCornerRadii).not.toHaveBeenCalled();
});

it('reports a missing Android module instead of silently returning zero', async () => {
  delete NativeModules.ScreenCornerRadiusModule;

  await expect(getScreenCornerRadii()).rejects.toThrow('Rebuild the Android app');
});

it('propagates native failures so callers can handle unavailable activities', async () => {
  getCornerRadii.mockRejectedValueOnce(new Error('No active Activity'));

  await expect(getScreenCornerRadius()).rejects.toThrow('No active Activity');
});
