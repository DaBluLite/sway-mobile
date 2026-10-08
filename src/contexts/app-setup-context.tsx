import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { STORES, getItem, setItem } from '../utils/storage';
import BootSplash from 'react-native-bootsplash';

interface AppSetupContextType {
  setupCompleted: boolean | "unloaded";
  completeSetup: () => void;
  isInitialized: boolean;
  selectedCountry: string | null;
  setSelectedCountry: (country: string) => void;
}

const AppSetupContext = createContext<AppSetupContextType | undefined>(
  undefined,
);

const SETUP_COMPLETED_KEY = 'app-setup-completed';
const SELECTED_COUNTRY_KEY = 'selected-country';

export const AppSetupProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [setupCompleted, setSetupCompletedState] = useState<boolean | "unloaded">("unloaded");
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedCountry, setSelectedCountryState] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const loadSetupStatus = async () => {
      const stored = getItem<boolean>(
        STORES.SETTINGS,
        SETUP_COMPLETED_KEY,
      );

      if (stored !== null) {
        setSetupCompletedState(stored);
      } else {
        setSetupCompletedState(false);
        setItem(STORES.SETTINGS, SETUP_COMPLETED_KEY, false);
      }

      const storedCountry = getItem<string>(
        STORES.SETTINGS,
        SELECTED_COUNTRY_KEY,
      );
      setSelectedCountryState(storedCountry);

      setIsInitialized(true);
      BootSplash.hide();
    };
    loadSetupStatus();
  }, []);

  const completeSetup = useCallback(() => {
    setSetupCompletedState(true);
    try {
      setItem(STORES.SETTINGS, SETUP_COMPLETED_KEY, true);
    } catch (error) {
      console.error('Failed to save setup status:', error);
    }
  }, []);

  const setSelectedCountry = useCallback((country: string) => {
    setSelectedCountryState(country);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      setItem(STORES.SETTINGS, SELECTED_COUNTRY_KEY, selectedCountry);
    } catch (error) {
      console.error('Failed to save selected country:', error);
    }
  }, [isInitialized, selectedCountry]);

  const contextValue = useMemo(
    () => ({
        setupCompleted,
        completeSetup,
        isInitialized,
        selectedCountry,
        setSelectedCountry,
    }),
    [setupCompleted, completeSetup, isInitialized, selectedCountry, setSelectedCountry],
  );

  return (
    <AppSetupContext.Provider value={contextValue}>
      {children}
    </AppSetupContext.Provider>
  );
};

export const useAppSetup = () => {
  const context = useContext(AppSetupContext);
  if (context === undefined) {
    throw new Error('useAppSetup must be used within an AppSetupProvider');
  }
  return context;
};
