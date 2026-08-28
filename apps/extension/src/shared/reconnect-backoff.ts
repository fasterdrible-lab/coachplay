import { RECONNECT_BACKOFF_MS } from './capture-config';

export const RECONNECT_MAX_ATTEMPTS = RECONNECT_BACKOFF_MS.length;

export function getBackoffDelayMs(attemptIndex: number): number | null {
  return attemptIndex < RECONNECT_BACKOFF_MS.length ? RECONNECT_BACKOFF_MS[attemptIndex] : null;
}
