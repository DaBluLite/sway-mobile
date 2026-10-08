import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import { Station } from 'radio-browser-api';
import { getItem, setItem, STORES } from '../utils/storage';
import subsonicService from '../utils/subsonic';
import { SubsonicAlbum, SubsonicPlaylist, SubsonicSong } from '../types/subsonic';
import { useFlyout } from '../components/flyout-menu';
import { useAudioPlayer } from './audio-player-context';

export const CARHOME_SLOT_COUNT = 6;

export type CarHomeSlotItem =
  | { type: 'playlist'; playlist: SubsonicPlaylist }
  | { type: 'album'; album: SubsonicAlbum }
  | { type: 'station'; station: Station };

interface CarHomeSlotsContextType {
  slots: (CarHomeSlotItem | null)[];
  saveToSlot: (item: CarHomeSlotItem, index: number) => void;
  clearSlot: (index: number) => void;
  playSlot: (index: number) => Promise<void>;
  isSlotFilled: (index: number) => boolean;
  openSaveToSlotMenu: (item: CarHomeSlotItem) => void;
}

const CarHomeSlotsContext = createContext<CarHomeSlotsContextType | undefined>(
  undefined,
);

const STORAGE_KEY = 'slots';

const emptySlots = (): (CarHomeSlotItem | null)[] =>
  Array.from({ length: CARHOME_SLOT_COUNT }, () => null);

export const CarHomeSlotsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { openFlyout } = useFlyout();
  const { play, playSong } = useAudioPlayer();
  const [slots, setSlots] = useState<(CarHomeSlotItem | null)[]>(emptySlots);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = getItem<(CarHomeSlotItem | null)[]>(
      STORES.CARHOME_SLOTS,
      STORAGE_KEY,
    );
    if (Array.isArray(stored)) {
      const next = emptySlots();
      stored.slice(0, CARHOME_SLOT_COUNT).forEach((item, index) => {
        if (item) next[index] = item;
      });
      setSlots(next);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      setItem(STORES.CARHOME_SLOTS, STORAGE_KEY, slots);
    }
  }, [slots, isLoaded]);

  const saveToSlot = useCallback((item: CarHomeSlotItem, index: number) => {
    setSlots(prev => prev.map((existing, i) => (i === index ? item : existing)));
  }, []);

  const clearSlot = useCallback((index: number) => {
    setSlots(prev => prev.map((existing, i) => (i === index ? null : existing)));
  }, []);

  const isSlotFilled = useCallback(
    (index: number) => Boolean(slots[index]),
    [slots],
  );

  const playSlot = useCallback(
    async (index: number): Promise<void> => {
      const item = slots[index];
      if (!item) return;

      if (item.type === 'station') {
        play(item.station);
        return;
      }

      if (item.type === 'album') {
        const result = await subsonicService.getAlbum(item.album.id);
        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to load album tracks');
        }
        const songs = (result.data as { song?: SubsonicSong[] }).song ?? [];
        if (!songs.length) {
          throw new Error('No tracks available in this album');
        }
        await playSong(songs, 0);
        return;
      }

      const result = await subsonicService.getPlaylist(item.playlist.id);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to load playlist tracks');
      }
      const songs = (result.data as { entry?: SubsonicSong[] }).entry ?? [];
      if (!songs.length) {
        throw new Error('No tracks available in this playlist');
      }
      await playSong(songs, 0);
    },
    [play, playSong, slots],
  );

  const slotLabel = useCallback((item: CarHomeSlotItem | null, index: number) => {
    if (!item) return `Slot ${index + 1} — Empty`;

    const label = (() => {
      switch (item.type) {
        case 'playlist':
          return item.playlist.name;
        case 'album':
          return item.album.name;
        case 'station':
          return item.station.name;
      }
    })();

    return `Slot ${index + 1} — ${label}`;
  }, []);

  const openSaveToSlotMenu = useCallback(
    (item: CarHomeSlotItem) => {
      openFlyout({
        title: 'Save to speed dial',
        subtitle: slotLabel(item, slots.findIndex(s => s === item)),
        actions: Array.from({ length: CARHOME_SLOT_COUNT }, (_, index) => ({
          id: `slot-${index}`,
          label: slotLabel(slots[index], index),
          onPress: () => saveToSlot(item, index),
        })),
      });
    },
    [openFlyout, saveToSlot, slotLabel, slots],
  );

  const contextValue = useMemo(
    () => ({
        slots,
        saveToSlot,
        clearSlot,
        playSlot,
        isSlotFilled,
        openSaveToSlotMenu,
    }),
    [slots, saveToSlot, clearSlot, playSlot, isSlotFilled, openSaveToSlotMenu],
  );

  return (
    <CarHomeSlotsContext.Provider value={contextValue}>
      {children}
    </CarHomeSlotsContext.Provider>
  );
};

export const useCarHomeSlots = (): CarHomeSlotsContextType => {
  const context = useContext(CarHomeSlotsContext);
  if (!context) {
    throw new Error('useCarHomeSlots must be used within CarHomeSlotsProvider');
  }
  return context;
};
