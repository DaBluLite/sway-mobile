"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Station } from "radio-browser-api";
import { getItem, setItem, STORES } from "../utils/storage";

interface FavouritesContextType {
  favourites: Station[];
  addFavourite: (station: Station) => void;
  removeFavourite: (id: string) => void;
  isFavourite: (id: string) => boolean;
  toggleFavourite: (station: Station) => void;
  clearFavourites: () => void;
  importFavourites: (stations: Station[], merge?: boolean) => void;
}

const FavouritesContext = createContext<FavouritesContextType | undefined>(
  undefined,
);

const STORAGE_KEY = "favourites-list";

interface FavouritesProviderProps {
  children: React.ReactNode;
}

export const FavouritesProvider: React.FC<FavouritesProviderProps> = ({
  children,
}) => {
  const [favourites, setFavourites] = useState<Station[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load favourites from IndexedDB on mount
  useEffect(() => {
    const loadFavourites = async () => {
      try {
        const stored = getItem<Station[]>(STORES.FAVOURITES, STORAGE_KEY);
        if (stored && Array.isArray(stored)) {
          setFavourites(stored);
        }
      } catch (error) {
        console.error("Failed to load favourites from IndexedDB:", error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadFavourites();
  }, []);

  // Save favourites to IndexedDB whenever they change
  useEffect(() => {
    if (isInitialized) {
      try {
        setItem(STORES.FAVOURITES, STORAGE_KEY, favourites)
      } catch(error) {
        console.error("Failed to save favourites to IndexedDB:", error);
      }
    }
  }, [favourites, isInitialized]);

  const addFavourite = useCallback((station: Station) => {
    setFavourites((prev) => {
      if (prev.some((fav) => fav.id === station.id)) {
        return prev;
      }
      return [...prev, station];
    });
  }, []);

  const removeFavourite = useCallback((id: string) => {
    setFavourites((prev) => prev.filter((fav) => fav.id !== id));
  }, []);

  const isFavourite = useCallback(
    (id: string): boolean => {
      return favourites.some((fav) => fav.id === id);
    },
    [favourites],
  );

  const toggleFavourite = useCallback((station: Station) => {
    setFavourites((prev) => {
      const exists = prev.some((fav) => fav.id === station.id);
      if (exists) {
        return prev.filter((fav) => fav.id !== station.id);
      }
      return [...prev, station];
    });
  }, []);

  const clearFavourites = useCallback(() => {
    setFavourites([]);
  }, []);

  /**
   * Import favourites from backup data
   * @param stations - Array of stations to import
   * @param merge - If true, merge with existing favourites. If false, replace all.
   */
  const importFavourites = useCallback(
    (stations: Station[], merge: boolean = true) => {
      if (!Array.isArray(stations)) return;

      setFavourites((prev) => {
        if (!merge) {
          // Replace all favourites
          return stations;
        }

        // Merge: add new stations that don't already exist
        const existingUrls = new Set(prev.map((fav) => fav.id));
        const newStations = stations.filter(
          (station) => !existingUrls.has(station.id),
        );

        return [...prev, ...newStations];
      });
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
        favourites,
        addFavourite,
        removeFavourite,
        isFavourite,
        toggleFavourite,
        clearFavourites,
        importFavourites,
    }),
    [favourites, addFavourite, removeFavourite, isFavourite, toggleFavourite, clearFavourites, importFavourites],
  );

  return (
    <FavouritesContext.Provider value={contextValue}>
      {children}
    </FavouritesContext.Provider>
  );
};

export const useFavourites = (): FavouritesContextType => {
  const context = useContext(FavouritesContext);
  if (!context) {
    throw new Error("useFavourites must be used within FavouritesProvider");
  }
  return context;
};
