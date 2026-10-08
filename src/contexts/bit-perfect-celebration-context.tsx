import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from 'react';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useBitPerfectAura } from '../hooks/useBitPerfectAura';
import {
  AURA_DURATION_MS,
  AURA_FADE_IN_MS,
  AURA_FADE_OUT_MS,
} from '../utils/bitPerfectAura';

type BitPerfectCelebration = {
  visible: boolean;
  progress: SharedValue<number>;
};

const BitPerfectCelebrationContext =
  createContext<BitPerfectCelebration | null>(null);

export function BitPerfectCelebrationProvider({ children }: PropsWithChildren) {
  const visible = useBitPerfectAura();
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (visible) {
      // Keep the entire fade/hold/fade sequence inside the five-second window.
      // Opacity remains safe with reduced motion; the label disables its slide.
      progress.value = withSequence(
        ReduceMotion.Never,
        withTiming(1, {
          duration: AURA_FADE_IN_MS,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.Never,
        }),
        withDelay(
          AURA_DURATION_MS - AURA_FADE_IN_MS - AURA_FADE_OUT_MS,
          withTiming(0, {
            duration: AURA_FADE_OUT_MS,
            easing: Easing.in(Easing.cubic),
            reduceMotion: ReduceMotion.Never,
          }),
          ReduceMotion.Never,
        ),
      );
    }
    return () => cancelAnimation(progress);
  }, [visible, progress]);

  const value = useMemo(() => ({ visible, progress }), [visible, progress]);

  return (
    <BitPerfectCelebrationContext.Provider value={value}>
      {children}
    </BitPerfectCelebrationContext.Provider>
  );
}

export function useBitPerfectCelebration(): BitPerfectCelebration {
  const context = useContext(BitPerfectCelebrationContext);
  if (!context) {
    throw new Error(
      'useBitPerfectCelebration must be used within BitPerfectCelebrationProvider',
    );
  }
  return context;
}
