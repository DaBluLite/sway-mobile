import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useAudioPlayer } from '../contexts/audio-player-context';
import { BtCodec } from '../utils/btCodec';
import { UsbAudio } from '../utils/usbAudio';
import { getItem, setItem, STORES } from '../utils/storage';
import {
  AURA_DURATION_MS,
  createBitPerfectAuraGate,
  hasDirectPlaybackFormat,
} from '../utils/bitPerfectAura';

const LAST_SHOWN_KEY = 'bit-perfect-aura-last-shown';
const CHECK_INTERVAL_MS = 1_000;
const USB_EVENTS = [
  'UsbAudioParamsApplied',
  'UsbAudioExclusiveGranted',
  'UsbAudioExclusiveReleased',
  'UsbAudioDeviceAttached',
  'UsbAudioDeviceDetached',
  'UsbAudioDevicesChanged',
];

/** A five-second celebration of a newly achieved direct-playback song. */
export function useBitPerfectAura(): boolean {
  const { currentSong, currentSongId, isPlaying, isCasting } = useAudioPlayer();
  const songId = currentSongId ?? currentSong?.id ?? null;
  const sampleRate = currentSong?.id === songId ? currentSong.samplingRate : 0;
  const bitDepth = currentSong?.id === songId ? currentSong.bitDepth : 0;
  const [visible, setVisible] = useState(false);
  const gateRef = useRef<ReturnType<typeof createBitPerfectAuraGate> | null>(
    null,
  );
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!gateRef.current) {
      let lastShownAt: number | null = null;
      try {
        const saved = getItem<number>(STORES.SETTINGS, LAST_SHOWN_KEY);
        if (typeof saved === 'number' && Number.isFinite(saved))
          lastShownAt = saved;
      } catch {
        // Keep a session-local cooldown if storage is unavailable.
      }
      gateRef.current = createBitPerfectAuraGate(lastShownAt);
    }

    const gate = gateRef.current;
    gate.observe(songId, false, Date.now());
    if (
      Platform.OS !== 'android' ||
      !songId ||
      !isPlaying ||
      isCasting ||
      !Number.isFinite(sampleRate) ||
      !Number.isFinite(bitDepth) ||
      sampleRate <= 0 ||
      bitDepth <= 0
    ) {
      return;
    }

    let active = true;
    let requestId = 0;

    const checkPlayback = async () => {
      const currentRequest = ++requestId;

      const [codec, usb] = await Promise.all([
        Promise.resolve()
          .then(() => BtCodec.getCurrentCodecInfo())
          .catch(() => null),
        Promise.resolve()
          .then(() => UsbAudio.getPlaybackState())
          .catch(() => null),
      ]);
      if (!active || currentRequest !== requestId) {
        return;
      }

      const now = Date.now();
      const achieved = hasDirectPlaybackFormat(
        sampleRate,
        bitDepth,
        codec,
        usb,
      );
      // Background achievements still count for the previous-song rule.
      if (
        !gate.observe(songId, achieved, now, AppState.currentState === 'active')
      )
        return;

      try {
        setItem(STORES.SETTINGS, LAST_SHOWN_KEY, now);
      } catch {
        // The gate still enforces the cooldown for this mounted session.
      }
      setVisible(true);
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        setVisible(false);
      }, AURA_DURATION_MS);
    };

    // Bluetooth exposes no codec-change event, so poll for completed negotiation.
    const interval = setInterval(checkPlayback, CHECK_INTERVAL_MS);
    const usbSubscriptions = USB_EVENTS.map(event =>
      UsbAudio.addListener(event, checkPlayback),
    );
    const appSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') checkPlayback();
    });
    checkPlayback();

    return () => {
      active = false;
      clearInterval(interval);
      usbSubscriptions.forEach(subscription => subscription.remove());
      appSubscription.remove();
    };
  }, [songId, sampleRate, bitDepth, isPlaying, isCasting]);

  return visible;
}
