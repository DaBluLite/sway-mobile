import {
  AURA_COOLDOWN_MS,
  AURA_DURATION_MS,
  createBitPerfectAuraGate,
  hasDirectPlaybackFormat,
} from '../src/utils/bitPerfectAura';
import type { CodecInfo } from '../src/utils/btCodec';
import type { UsbAudio } from '../src/utils/usbAudio';

type UsbPlaybackState = Awaited<ReturnType<typeof UsbAudio.getPlaybackState>>;

const matchingCodec: CodecInfo = {
  codecType: 0,
  sampleRate: 96000,
  bitsPerSample: 24,
};

const directUsb: NonNullable<UsbPlaybackState> = {
  connected: true,
  exclusiveGranted: true,
  directSupported: true,
  appliedSampleRate: 96000,
  appliedBitDepth: 24,
};

describe('createBitPerfectAuraGate', () => {
  it('exports a five-second duration and five-minute cooldown', () => {
    expect(AURA_DURATION_MS).toBe(5000);
    expect(AURA_COOLDOWN_MS).toBe(300000);
  });

  it('shows on the first qualifying observation, including at time zero', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe('a', false, 0)).toBe(false);
    expect(gate.observe('a', false, 1)).toBe(false);
    expect(gate.observe('a', true, 2)).toBe(true);
    expect(createBitPerfectAuraGate().observe('a', true, 0)).toBe(true);
  });

  it('records hidden achievements without starting a cooldown or queuing a show', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe('a', true, 0, false)).toBe(false);
    expect(gate.observe('a', true, 1, true)).toBe(false);
    expect(gate.observe('b', true, 2, true)).toBe(false);
    expect(gate.observe('c', false, 3, true)).toBe(false);
    expect(gate.observe('d', true, 4, true)).toBe(true);
  });

  it('never repeats for the same song after reconnect or pause toggles', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe('a', true, 0)).toBe(true);
    expect(gate.observe('a', true, 1)).toBe(false);
    expect(gate.observe('a', false, 2)).toBe(false);
    expect(gate.observe('a', true, AURA_COOLDOWN_MS)).toBe(false);
    expect(gate.observe('a', false, AURA_COOLDOWN_MS + 1)).toBe(false);
    expect(gate.observe('a', true, AURA_COOLDOWN_MS * 2)).toBe(false);
  });

  it('suppresses consecutive qualifying songs even after the cooldown', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe('a', true, 0)).toBe(true);
    expect(gate.observe('b', false, AURA_COOLDOWN_MS)).toBe(false);
    expect(gate.observe('b', true, AURA_COOLDOWN_MS + 1)).toBe(false);
    expect(gate.observe('c', true, AURA_COOLDOWN_MS * 2)).toBe(false);
  });

  it('allows a qualifying song after a nonqualifying song at the exact boundary', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe('a', true, 0)).toBe(true);
    expect(gate.observe('b', false, 1)).toBe(false);
    expect(gate.observe('c', true, AURA_COOLDOWN_MS)).toBe(true);
  });

  it('suppresses one millisecond before the boundary and does not queue a show', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe('a', true, 0)).toBe(true);
    expect(gate.observe('b', false, 1)).toBe(false);
    expect(gate.observe('c', true, AURA_COOLDOWN_MS - 1)).toBe(false);
    expect(gate.observe('c', true, AURA_COOLDOWN_MS)).toBe(false);
    expect(gate.observe('c', false, AURA_COOLDOWN_MS + 1)).toBe(false);
    expect(gate.observe('c', true, AURA_COOLDOWN_MS * 2)).toBe(false);
  });

  it('remembers a preceding song achieved playback even when cooldown suppressed its aura', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe('a', true, 0)).toBe(true);
    expect(gate.observe('b', false, 1)).toBe(false);
    expect(gate.observe('c', true, 2)).toBe(false);
    expect(gate.observe('c', false, 3)).toBe(false);
    expect(gate.observe('d', true, AURA_COOLDOWN_MS)).toBe(false);
  });

  it('remembers achievement permanently despite later nonmatching observations', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe('a', true, 0)).toBe(true);
    expect(gate.observe('a', false, 1)).toBe(false);
    expect(gate.observe('b', true, AURA_COOLDOWN_MS)).toBe(false);
    expect(gate.observe('b', false, AURA_COOLDOWN_MS + 1)).toBe(false);
    expect(gate.observe('c', true, AURA_COOLDOWN_MS * 2)).toBe(false);
  });

  it('handles nonqualifying and qualifying sequences using the immediately preceding song', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe('a', false, 0)).toBe(false);
    expect(gate.observe('b', false, 1)).toBe(false);
    expect(gate.observe('c', true, 2)).toBe(true);
    expect(gate.observe('d', true, AURA_COOLDOWN_MS + 2)).toBe(false);
    expect(gate.observe('e', false, AURA_COOLDOWN_MS + 3)).toBe(false);
    expect(gate.observe('f', false, AURA_COOLDOWN_MS + 4)).toBe(false);
    expect(gate.observe('g', true, AURA_COOLDOWN_MS + 5)).toBe(true);
  });

  it('stores each successful show time as the next cooldown origin', () => {
    const gate = createBitPerfectAuraGate();
    const firstShownAt = 100;
    const secondShownAt = firstShownAt + AURA_COOLDOWN_MS;

    expect(gate.observe('a', true, firstShownAt)).toBe(true);
    expect(gate.observe('b', false, firstShownAt + 1)).toBe(false);
    expect(gate.observe('c', true, secondShownAt)).toBe(true);
    expect(gate.observe('d', false, secondShownAt + 1)).toBe(false);
    expect(gate.observe('e', true, secondShownAt + AURA_COOLDOWN_MS - 1)).toBe(
      false,
    );
    expect(gate.observe('f', false, secondShownAt + AURA_COOLDOWN_MS)).toBe(
      false,
    );
    expect(gate.observe('g', true, secondShownAt + AURA_COOLDOWN_MS)).toBe(
      true,
    );
  });

  it('ignores initial null observations without marking any song achieved', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe(null, true, 0)).toBe(false);
    expect(gate.observe(null, false, 1)).toBe(false);
    expect(gate.observe('a', true, 2)).toBe(true);
  });

  it('preserves the same song and preceding achievement across transient null states', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe('a', true, 0)).toBe(true);
    expect(gate.observe(null, false, 1)).toBe(false);
    expect(gate.observe(null, true, AURA_COOLDOWN_MS)).toBe(false);
    expect(gate.observe('a', true, AURA_COOLDOWN_MS + 1)).toBe(false);
    expect(gate.observe(null, false, AURA_COOLDOWN_MS + 2)).toBe(false);
    expect(gate.observe('b', true, AURA_COOLDOWN_MS + 3)).toBe(false);
  });

  it('does not let a qualifying null observation mark a nonqualifying song achieved', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe('a', false, 0)).toBe(false);
    expect(gate.observe(null, true, 1)).toBe(false);
    expect(gate.observe('b', true, 2)).toBe(true);
  });

  it('can first qualify the same song after a transient null state', () => {
    const gate = createBitPerfectAuraGate();

    expect(gate.observe('a', false, 0)).toBe(false);
    expect(gate.observe(null, true, 1)).toBe(false);
    expect(gate.observe('a', true, 2)).toBe(true);
  });

  it.each([0, 12345])(
    'blocks cold-start shows inside cooldown from timestamp %s',
    lastShownAt => {
      const gate = createBitPerfectAuraGate(lastShownAt);

      expect(gate.observe('a', true, lastShownAt + AURA_COOLDOWN_MS - 1)).toBe(
        false,
      );
      expect(gate.observe('a', true, lastShownAt + AURA_COOLDOWN_MS)).toBe(
        false,
      );
      expect(gate.observe('b', true, lastShownAt + AURA_COOLDOWN_MS + 1)).toBe(
        false,
      );
    },
  );

  it.each([0, 12345])(
    'allows a cold-start show exactly at cooldown from timestamp %s',
    lastShownAt => {
      const gate = createBitPerfectAuraGate(lastShownAt);

      expect(gate.observe('a', true, lastShownAt + AURA_COOLDOWN_MS)).toBe(
        true,
      );
    },
  );

  it('allows a cold-start show with an explicitly absent timestamp', () => {
    expect(createBitPerfectAuraGate(null).observe('a', true, 1)).toBe(true);
  });
});

describe('hasDirectPlaybackFormat app indicators', () => {
  it('accepts matching Bluetooth format without USB state', () => {
    expect(hasDirectPlaybackFormat(96000, 24, matchingCodec, null)).toBe(true);
  });

  it.each([
    { ...matchingCodec, sampleRate: 48000 },
    { ...matchingCodec, bitsPerSample: 16 },
    { ...matchingCodec, sampleRate: 48000, bitsPerSample: 16 },
    null,
  ])('rejects mismatched or absent Bluetooth format: %j', codec => {
    expect(hasDirectPlaybackFormat(96000, 24, codec, null)).toBe(false);
  });

  it('accepts connected, exclusive, direct USB with exactly matching applied format', () => {
    expect(hasDirectPlaybackFormat(96000, 24, null, directUsb)).toBe(true);
  });

  it.each([
    { ...directUsb, connected: false },
    { ...directUsb, exclusiveGranted: false },
    { ...directUsb, directSupported: false },
    { ...directUsb, directSupported: undefined },
    { ...directUsb, appliedSampleRate: 48000 },
    { ...directUsb, appliedBitDepth: 16 },
    { ...directUsb, appliedSampleRate: undefined },
    { ...directUsb, appliedBitDepth: undefined },
    { connected: true, exclusiveGranted: true },
    null,
  ])('rejects unavailable or nonmatching direct USB: %j', usb => {
    expect(hasDirectPlaybackFormat(96000, 24, null, usb)).toBe(false);
  });

  it.each([
    { ...directUsb, appliedSampleRate: 48000 },
    { ...directUsb, appliedBitDepth: 16 },
    { ...directUsb, directSupported: false },
    { connected: true, exclusiveGranted: true },
  ])(
    'does not let Bluetooth qualify a connected exclusive USB route: %j',
    usb => {
      expect(hasDirectPlaybackFormat(96000, 24, matchingCodec, usb)).toBe(
        false,
      );
    },
  );

  it.each([
    { ...directUsb, connected: false },
    { ...directUsb, exclusiveGranted: false },
    { connected: false, exclusiveGranted: false },
  ])(
    'allows matching Bluetooth when USB is not connected and exclusive: %j',
    usb => {
      expect(hasDirectPlaybackFormat(96000, 24, matchingCodec, usb)).toBe(true);
    },
  );

  it('allows preferred matching USB despite a mismatching Bluetooth format', () => {
    const codec = { ...matchingCodec, sampleRate: 48000, bitsPerSample: 16 };

    expect(hasDirectPlaybackFormat(96000, 24, codec, directUsb)).toBe(true);
  });

  it.each([0, -1, NaN, Infinity, -Infinity])(
    'rejects invalid track sample rate %s on either route',
    sampleRate => {
      const codec = { ...matchingCodec, sampleRate };
      const usb = { ...directUsb, appliedSampleRate: sampleRate };

      expect(hasDirectPlaybackFormat(sampleRate, 24, codec, null)).toBe(false);
      expect(hasDirectPlaybackFormat(sampleRate, 24, null, usb)).toBe(false);
      expect(hasDirectPlaybackFormat(sampleRate, 24, codec, usb)).toBe(false);
    },
  );

  it.each([0, -1, NaN, Infinity, -Infinity])(
    'rejects invalid track bit depth %s on either route',
    bitDepth => {
      const codec = { ...matchingCodec, bitsPerSample: bitDepth };
      const usb = { ...directUsb, appliedBitDepth: bitDepth };

      expect(hasDirectPlaybackFormat(96000, bitDepth, codec, null)).toBe(false);
      expect(hasDirectPlaybackFormat(96000, bitDepth, null, usb)).toBe(false);
      expect(hasDirectPlaybackFormat(96000, bitDepth, codec, usb)).toBe(false);
    },
  );
});
