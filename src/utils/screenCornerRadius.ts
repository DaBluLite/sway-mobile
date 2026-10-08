import { NativeModules, Platform } from 'react-native';

export interface ScreenCornerRadii {
  /** Whether the platform exposes a public screen corner radius API. */
  isSupported: boolean;
  /** Radii in React Native layout units (dp), relative to the current orientation. */
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
}

interface ScreenCornerRadiusNativeModule {
  getCornerRadii(): Promise<ScreenCornerRadii>;
}

/** Reads the full display, rather than the app window, on Android 12+. */
export async function getScreenCornerRadii(): Promise<ScreenCornerRadii> {
  if (Platform.OS !== 'android') {
    return {
      isSupported: false,
      topLeft: 0,
      topRight: 0,
      bottomLeft: 0,
      bottomRight: 0,
    };
  }

  const nativeModule = NativeModules.ScreenCornerRadiusModule as
    | ScreenCornerRadiusNativeModule
    | undefined;

  if (!nativeModule) {
    throw new Error(
      'ScreenCornerRadiusModule is not registered. Rebuild the Android app after adding the native module.',
    );
  }

  return nativeModule.getCornerRadii();
}

/** Returns the largest of the four screen corner radii, in layout units (dp). */
export async function getScreenCornerRadius(): Promise<number> {
  const { topLeft, topRight, bottomLeft, bottomRight } =
    await getScreenCornerRadii();
  return Math.max(topLeft, topRight, bottomLeft, bottomRight);
}
