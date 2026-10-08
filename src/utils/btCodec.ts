import { NativeModules } from 'react-native';
const { BtCodecModule } = NativeModules;

export type CodecInfo = { codecType: number; sampleRate: number; bitsPerSample: number };

export const BtCodec = {
  connect: (): Promise<boolean> => BtCodecModule.connect(),
  getCurrentCodecInfo: (): Promise<CodecInfo> => BtCodecModule.getCurrentCodecInfo(),
  applyPreferredParams: (sampleRate: number, bitsPerSample: number): Promise<boolean> =>
    BtCodecModule.applyPreferredParams(sampleRate, bitsPerSample),
};

export type SongCodecParams = {
  sampleRate?: number | null;
  bitDepth?: number | null;
};

export const getSongCodecParams = (
  song?: SongCodecParams | null,
): { sampleRate: number; bitDepth: number } | null => {
  if (!song) return null;
  const sampleRate = Number(song.sampleRate ?? 0);
  const bitDepth = Number(song.bitDepth ?? 0);
  if (!Number.isFinite(sampleRate) || !Number.isFinite(bitDepth)) return null;
  if (sampleRate <= 0 || bitDepth <= 0) return null;
  return { sampleRate, bitDepth };
};
