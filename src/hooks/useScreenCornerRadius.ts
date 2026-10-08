import { useEffect, useState } from 'react';
import { AppState, Dimensions } from 'react-native';
import { getScreenCornerRadius } from '../utils/screenCornerRadius';

/** Returns the largest screen corner radius in dp, initially 0. */
export function useScreenCornerRadius(): number {
  const [radius, setRadius] = useState(0);

  useEffect(() => {
    let active = true;
    let requestId = 0;

    const refresh = async () => {
      const currentRequest = ++requestId;
      try {
        const nextRadius = await getScreenCornerRadius();
        if (active && currentRequest === requestId) {
          setRadius(nextRadius);
        }
      } catch {
        // Keep the last value if the Activity is temporarily unavailable.
        // A subsequent display change or app resume will retry the read.
      }
    };

    const dimensionsSubscription = Dimensions.addEventListener(
      'change',
      refresh,
    );
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    refresh();

    return () => {
      active = false;
      dimensionsSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  return radius;
}
