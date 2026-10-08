import { DeviceEventEmitter, NativeModules } from 'react-native';
const { SystemUiModule } = NativeModules;

export type NetworkType = 'wifi' | 'cellular' | 'none';

export interface SystemUiListener {
  remove(): void;
}

const EVENT_BATTERY = 'onSystemBatteryLevel';
const EVENT_NETWORK = 'onSystemNetworkType';
const EVENT_BLUETOOTH = 'onSystemBluetoothState';

export const SystemUi = {
  enterCarHomeUi: (): Promise<boolean> => SystemUiModule.enterCarHomeUi(),
  exitCarHomeUi: (): Promise<boolean> => SystemUiModule.exitCarHomeUi(),

  // Each listener fires immediately with the current state on subscribe, then
  // on every native update (broadcast / network callback) plus a fallback
  // interval as a safety net for changes that can't be captured as events.
  onBatteryLevel: (callback: (level: number) => void): SystemUiListener => {
    const sub = DeviceEventEmitter.addListener(EVENT_BATTERY, (level: unknown) =>
      callback(Number(level)),
    );
    SystemUiModule.startBatteryUpdates();
    return {
      remove: () => {
        sub.remove();
        SystemUiModule.stopBatteryUpdates();
      },
    };
  },

  onNetworkType: (callback: (type: NetworkType) => void): SystemUiListener => {
    const sub = DeviceEventEmitter.addListener(EVENT_NETWORK, (type: unknown) =>
      callback(type as NetworkType),
    );
    SystemUiModule.startNetworkUpdates();
    return {
      remove: () => {
        sub.remove();
        SystemUiModule.stopNetworkUpdates();
      },
    };
  },

  onBluetoothState: (callback: (state: boolean) => void): SystemUiListener => {
    const sub = DeviceEventEmitter.addListener(EVENT_BLUETOOTH, (state: unknown) =>
      callback(Boolean(state)),
    );
    SystemUiModule.startBluetoothUpdates();
    return {
      remove: () => {
        sub.remove();
        SystemUiModule.stopBluetoothUpdates();
      },
    };
  },
};
