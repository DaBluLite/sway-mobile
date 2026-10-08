import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV();

export const STORES = {
  FAVOURITES: 'favourites',
  SAVED_STATIONS: 'saved-stations',
  SETTINGS: 'settings',
  HISTORY: 'history',
  ALARMS: 'alarms',
  EQUALIZER: 'equalizer',
  RECORDINGS: 'recordings',
  CURATIONS: 'curations',
  BACKGROUNDS: 'backgrounds',
  SUBSONIC_SERVICE: 'subsonic-service',
  CARHOME_SLOTS: 'carhome-slots',
  NAVILOAD_CREDENTIALS: 'naviload-credentials',
  SPOTIFY_TRANSFER: 'spotify-transfer',
} as const;

export type StoreKey = (typeof STORES)[keyof typeof STORES];

function setItem(
  store: StoreKey,
  key: string,
  value: unknown,
) {
  const fullKey = `${store}:${key}`;
  try {
    storage.set(fullKey, JSON.stringify(value));
  } catch (error) {
    console.error(
      `Failed to set item in store ${store} with key ${key}:`,
      error,
    );
    throw error;
  }
}

function getItem<T>(store: StoreKey, key: string): T | null {
  const fullKey = `${store}:${key}`;
  try {
    const value = storage.getString(fullKey);
    return value ? (JSON.parse(value) as T) : null;
  } catch (error) {
    console.error(
      `Failed to get item from store ${store} with key ${key}:`,
      error,
    );
    throw error;
  }
}

function deleteItem(store: StoreKey, key: string) {
  const fullKey = `${store}:${key}`;
  try {
    storage.remove(fullKey);
  } catch (error) {
    console.error(
      `Failed to delete item from store ${store} with key ${key}:`,
      error,
    );
    throw error;
  }
}

export { setItem, getItem, deleteItem };
