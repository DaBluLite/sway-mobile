import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
const { UsbAudioModule } = NativeModules as any;

export type UsbDeviceInfo = { id: number; name: string; type: number; sampleRates: number[]; channelCounts: number[]; productName: string };
export type UsbParamsResult = { requestedSampleRate: number; requestedBitDepth: number; appliedSampleRate: number; appliedBitDepth: number; directSupported: boolean; deviceId: number };

const emitter = UsbAudioModule ? new NativeEventEmitter(UsbAudioModule) : null;

export const UsbAudio = {
  isSupported: (): boolean => Platform.OS === 'android' && !!UsbAudioModule,
  getUsbDevices: (): Promise<UsbDeviceInfo[]> => UsbAudioModule ? UsbAudioModule.getUsbDevices() : Promise.resolve([]),
  requestExclusive: (deviceId?: number): Promise<boolean> => UsbAudioModule ? UsbAudioModule.requestExclusive(deviceId ?? -1) : Promise.resolve(false),
  requestUsbPermission: (): Promise<boolean> => UsbAudioModule?.requestUsbPermission ? UsbAudioModule.requestUsbPermission() : Promise.resolve(false),
  releaseExclusive: (): Promise<boolean> => UsbAudioModule ? UsbAudioModule.releaseExclusive() : Promise.resolve(false),
  isExclusiveGranted: (): Promise<boolean> => UsbAudioModule ? UsbAudioModule.isExclusiveGranted() : Promise.resolve(false),
  getPreferredDevice: (): Promise<UsbDeviceInfo | null> => UsbAudioModule ? UsbAudioModule.getPreferredDevice() : Promise.resolve(null),
  applyBitPerfectParams: (sampleRate: number, bitDepth: number): Promise<UsbParamsResult | boolean> =>
    UsbAudioModule ? UsbAudioModule.applyBitPerfectParams(sampleRate, bitDepth) : Promise.resolve(false),
  getPlaybackState: (): Promise<{ exclusiveGranted:boolean; connected:boolean; device?:UsbDeviceInfo; appliedSampleRate?:number; appliedBitDepth?:number; directSupported?:boolean } | null> =>
    UsbAudioModule?.getPlaybackState ? UsbAudioModule.getPlaybackState() : Promise.resolve(null),
  addListener: (event: string, cb: (d:any)=>void) => emitter?.addListener(event, cb) ?? { remove: () => {} } as any,
};

export const getSongUsbParams = (song?: { samplingRate?: number|null; bitDepth?: number|null } | null) => {
  if (!song) return null;
  const sr = Number(song.samplingRate ?? 0); const bd = Number(song.bitDepth ?? 0);
  if (!Number.isFinite(sr) || !Number.isFinite(bd) || sr<=0 || bd<=0) return null;
  return { sampleRate: sr, bitDepth: bd };
};
