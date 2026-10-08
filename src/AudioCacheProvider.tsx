import { ReactNode } from 'react';

interface AudioCacheProviderProps {
  children: ReactNode;
  autoStartPrefetch?: boolean;
  enableOfflineMode?: boolean;
}

// Caching disconnected — passthrough provider. Kept for tree compatibility.
// Will be removed once rn-audio-stream owns caching.
export function AudioCacheProvider({ children }: AudioCacheProviderProps) {
  return <>{children}</>;
}


