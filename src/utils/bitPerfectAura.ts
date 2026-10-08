import type { CodecInfo } from './btCodec';
import type { UsbAudio } from './usbAudio';

export const AURA_DURATION_MS = 5_000;
export const AURA_FADE_IN_MS = 400;
export const AURA_FADE_OUT_MS = 600;
export const AURA_COOLDOWN_MS = 5 * 60_000;

type UsbPlaybackState = Awaited<ReturnType<typeof UsbAudio.getPlaybackState>>;

/** Matches the app's direct-playback indicators, not end-to-end signal integrity. */
export function hasDirectPlaybackFormat(
  sampleRate: number,
  bitDepth: number,
  codec: CodecInfo | null,
  usb: UsbPlaybackState,
): boolean {
  if (
    !Number.isFinite(sampleRate) ||
    !Number.isFinite(bitDepth) ||
    sampleRate <= 0 ||
    bitDepth <= 0
  ) {
    return false;
  }

  if (usb?.connected && usb.exclusiveGranted) {
    // An exclusive DAC takes precedence over unrelated connected headphones.
    return (
      usb.directSupported === true &&
      usb.appliedSampleRate === sampleRate &&
      usb.appliedBitDepth === bitDepth
    );
  }

  return codec?.sampleRate === sampleRate && codec.bitsPerSample === bitDepth;
}

export function createBitPerfectAuraGate(lastShownAt: number | null = null) {
  let currentSongId: string | null = null;
  let currentSongAchieved = false;
  let previousSongAchieved = false;

  return {
    observe(
      songId: string | null,
      achieved: boolean,
      now: number,
      canShow = true,
    ): boolean {
      // Preserve history through transient no-track states during queue changes.
      if (!songId) return false;

      if (songId !== currentSongId) {
        previousSongAchieved = currentSongAchieved;
        currentSongId = songId;
        currentSongAchieved = false;
      }

      if (!achieved || currentSongAchieved) return false;
      currentSongAchieved = true;

      // Record achievements even when suppressed. Never queue them for later.
      if (
        !canShow ||
        previousSongAchieved ||
        (lastShownAt !== null && now - lastShownAt < AURA_COOLDOWN_MS)
      ) {
        return false;
      }

      lastShownAt = now;
      return true;
    },
  };
}
