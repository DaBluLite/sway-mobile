import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAudioPlayer } from './audio-player-context';
import { SLEEP_TIMER_MINUTE_OPTIONS } from './sleep-timer-options';
import type {
  SleepTimerMinuteOption,
  SleepTimerMode,
  SleepTimerOption,
} from './sleep-timer-options';

type SleepTimerState = {
  enabled: boolean;
  mode: SleepTimerMode | null;
  minutes: SleepTimerMinuteOption | null;
  startedAt: number | null;
  endsAt: number | null;
};

interface SleepTimerContextType extends SleepTimerState {
  options: readonly SleepTimerOption[];
  remainingMs: number | null;
  startSleepTimer: (option: SleepTimerOption) => void;
  startMinutesTimer: (minutes: SleepTimerMinuteOption) => void;
  startEndOfSongTimer: () => void;
  cancelSleepTimer: () => void;
}

const SleepTimerContext = createContext<SleepTimerContextType | undefined>(
  undefined,
);

const createInactiveState = (): SleepTimerState => ({
  enabled: false,
  mode: null,
  minutes: null,
  startedAt: null,
  endsAt: null,
});

const sleepTimerOptions: readonly SleepTimerOption[] = [
  ...SLEEP_TIMER_MINUTE_OPTIONS.map(minutes => ({
    mode: 'minutes' as const,
    minutes,
  })),
  { mode: 'end-of-song' },
];

export function SleepTimerProvider({ children }: { children: ReactNode }) {
  const {
    pause,
    onSongEnded,
    currentSongId,
    duration,
    currentTime,
    isSeekable,
  } = useAudioPlayer();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endOfSongTrackIdRef = useRef<string | null>(null);
  const [state, setState] = useState<SleepTimerState>(createInactiveState);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const clearTimerTimeout = useCallback(() => {
    if (!timeoutRef.current) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const getRemainingTrackMs = useCallback(() => {
    if (!isSeekable || duration <= 0) {
      return null;
    }

    return Math.max(0, Math.ceil((duration - currentTime) * 1000));
  }, [currentTime, duration, isSeekable]);

  const cancelSleepTimer = useCallback(() => {
    clearTimerTimeout();
    endOfSongTrackIdRef.current = null;
    setState(createInactiveState());
    setRemainingMs(null);
  }, [clearTimerTimeout]);

  const triggerSleepTimer = useCallback(() => {
    clearTimerTimeout();
    endOfSongTrackIdRef.current = null;
    pause();
    setState(createInactiveState());
    setRemainingMs(null);
  }, [clearTimerTimeout, pause]);

  const startSleepTimer = useCallback(
    (option: SleepTimerOption) => {
      clearTimerTimeout();

      const now = Date.now();

      if (option.mode === 'end-of-song') {
        const remainingTrackMs = getRemainingTrackMs();
        const endsAt = remainingTrackMs === null ? null : now + remainingTrackMs;

        endOfSongTrackIdRef.current = currentSongId;
        setState({
          enabled: true,
          mode: 'end-of-song',
          minutes: null,
          startedAt: now,
          endsAt,
        });
        setRemainingMs(remainingTrackMs);

        if (remainingTrackMs !== null) {
          timeoutRef.current = setTimeout(triggerSleepTimer, remainingTrackMs);
        }
        return;
      }

      endOfSongTrackIdRef.current = null;
      const durationMs = option.minutes * 60 * 1000;
      const endsAt = now + durationMs;

      setState({
        enabled: true,
        mode: 'minutes',
        minutes: option.minutes,
        startedAt: now,
        endsAt,
      });
      setRemainingMs(durationMs);

      timeoutRef.current = setTimeout(triggerSleepTimer, durationMs);
    },
    [
      clearTimerTimeout,
      currentSongId,
      getRemainingTrackMs,
      triggerSleepTimer,
    ],
  );

  const startMinutesTimer = useCallback(
    (minutes: SleepTimerMinuteOption) => {
      startSleepTimer({ mode: 'minutes', minutes });
    },
    [startSleepTimer],
  );

  const startEndOfSongTimer = useCallback(() => {
    startSleepTimer({ mode: 'end-of-song' });
  }, [startSleepTimer]);

  useEffect(() => {
    if (!state.enabled || !state.endsAt) {
      return;
    }

    const endsAt = state.endsAt;
    const updateRemaining = () => {
      setRemainingMs(Math.max(0, endsAt - Date.now()));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [state.enabled, state.endsAt]);

  useEffect(() => {
    if (
      !state.enabled ||
      state.mode !== 'end-of-song' ||
      !endOfSongTrackIdRef.current ||
      currentSongId === endOfSongTrackIdRef.current
    ) {
      return;
    }

    triggerSleepTimer();
  }, [currentSongId, state.enabled, state.mode, triggerSleepTimer]);

  useEffect(() => {
    return onSongEnded(() => {
      if (endOfSongTrackIdRef.current) {
        triggerSleepTimer();
      }
    });
  }, [onSongEnded, triggerSleepTimer]);

  useEffect(() => clearTimerTimeout, [clearTimerTimeout]);

  const value = useMemo<SleepTimerContextType>(
    () => ({
      ...state,
      options: sleepTimerOptions,
      remainingMs,
      startSleepTimer,
      startMinutesTimer,
      startEndOfSongTimer,
      cancelSleepTimer,
    }),
    [
      cancelSleepTimer,
      remainingMs,
      startEndOfSongTimer,
      startMinutesTimer,
      startSleepTimer,
      state,
    ],
  );

  return (
    <SleepTimerContext.Provider value={value}>
      {children}
    </SleepTimerContext.Provider>
  );
}

export function useSleepTimer() {
  const context = useContext(SleepTimerContext);

  if (!context) {
    throw new Error('useSleepTimer must be used within SleepTimerProvider');
  }

  return context;
}
