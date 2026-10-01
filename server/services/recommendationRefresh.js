/**
 * Background refresh of saved recommendations after a company's data changes.
 *
 * Changes are debounced (a burst of edits triggers one refresh) and each
 * company is refreshed at most once per `minIntervalMs`, to bound Gemini
 * usage. Timers live in memory, so a server restart drops pending refreshes;
 * the Recommendations page still flags outdated results and can update them.
 */
import { isGeminiConfigured } from './geminiClient.js';
import { refreshSavedRecommendations } from './recommendationRunner.js';

const DEBOUNCE_MS = 60 * 1000;
const MIN_INTERVAL_MS = 10 * 60 * 1000;

export function createRefreshScheduler({ run, debounceMs = DEBOUNCE_MS, minIntervalMs = MIN_INTERVAL_MS, now = Date.now, enabled = () => true }) {
  const timers = new Map();
  const running = new Set();
  const lastRun = new Map();

  const execute = async (userId) => {
    timers.delete(userId);
    running.add(userId);
    // Counted from the start, so a change made while this run is in flight
    // waits out the interval instead of starting a second, concurrent run
    lastRun.set(userId, now());
    try {
      const outcome = await run(userId);
      console.log(`Background recommendation refresh for user ${userId}: ${outcome}`);
    } catch (error) {
      console.error(`Background recommendation refresh failed for user ${userId}:`, error.message);
    } finally {
      running.delete(userId);
    }
  };

  return {
    /** Queue a refresh for a user, replacing any pending one. */
    schedule(userId) {
      if (!enabled()) return;
      clearTimeout(timers.get(userId));
      const earliest = (lastRun.get(userId) ?? -Infinity) + minIntervalMs;
      const delay = Math.max(debounceMs, earliest - now());
      const timer = setTimeout(() => execute(userId), delay);
      timer.unref?.(); // never keep the process alive just for a refresh
      timers.set(userId, timer);
    },

    cancel(userId) {
      clearTimeout(timers.get(userId));
      timers.delete(userId);
    },

    /** True while a refresh is queued or running for the user. */
    isPending(userId) {
      return timers.has(userId) || running.has(userId);
    },
  };
}

export const recommendationRefresh = createRefreshScheduler({
  run: refreshSavedRecommendations,
  enabled: () => isGeminiConfigured(),
});
