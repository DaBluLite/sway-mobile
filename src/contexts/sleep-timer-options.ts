export const SLEEP_TIMER_MINUTE_OPTIONS = [5, 10, 15, 30, 45, 60] as const;
export type SleepTimerMinuteOption = (typeof SLEEP_TIMER_MINUTE_OPTIONS)[number];
export type SleepTimerMode = 'minutes' | 'end-of-song';
export type SleepTimerOption =
  | { mode: 'minutes'; minutes: SleepTimerMinuteOption }
  | { mode: 'end-of-song' };
