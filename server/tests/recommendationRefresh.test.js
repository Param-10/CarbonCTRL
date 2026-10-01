import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRefreshScheduler } from '../services/recommendationRefresh.js';

describe('background recommendation refresh scheduler', () => {
  let run;
  const scheduler = (options = {}) =>
    createRefreshScheduler({ run, debounceMs: 1000, minIntervalMs: 60000, now: Date.now, ...options });

  beforeEach(() => {
    vi.useFakeTimers();
    run = vi.fn(async () => 'refreshed');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for changes to settle and refreshes once', async () => {
    const refresh = scheduler();
    refresh.schedule(1);
    await vi.advanceTimersByTimeAsync(500);
    refresh.schedule(1);
    refresh.schedule(1);

    expect(refresh.isPending(1)).toBe(true);
    await vi.advanceTimersByTimeAsync(999);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(1);
    expect(refresh.isPending(1)).toBe(false);
  });

  it('refreshes each company at most once per interval', async () => {
    const refresh = scheduler();
    refresh.schedule(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(1);

    refresh.schedule(1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(run).toHaveBeenCalledTimes(1); // still inside the 60 s interval
    await vi.advanceTimersByTimeAsync(31000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not start a second refresh while one is still running', async () => {
    let finish;
    run = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const refresh = scheduler();
    refresh.schedule(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(1);

    // A change arrives mid-run; the interval counts from when the run started
    refresh.schedule(1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(run).toHaveBeenCalledTimes(1);
    finish('refreshed');
    await vi.advanceTimersByTimeAsync(30000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps companies independent', async () => {
    const refresh = scheduler();
    refresh.schedule(1);
    refresh.schedule(2);
    await vi.advanceTimersByTimeAsync(1000);

    expect(run.mock.calls.map(([id]) => id).sort()).toEqual([1, 2]);
  });

  it('can cancel a pending refresh', async () => {
    const refresh = scheduler();
    refresh.schedule(1);
    refresh.cancel(1);
    await vi.advanceTimersByTimeAsync(5000);

    expect(run).not.toHaveBeenCalled();
    expect(refresh.isPending(1)).toBe(false);
  });

  it('does nothing when disabled (no Gemini key)', async () => {
    const refresh = scheduler({ enabled: () => false });
    refresh.schedule(1);
    await vi.advanceTimersByTimeAsync(5000);

    expect(run).not.toHaveBeenCalled();
  });

  it('survives a failed refresh', async () => {
    run = vi.fn(async () => {
      throw new Error('Gemini unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const refresh = scheduler();
    refresh.schedule(1);
    await vi.advanceTimersByTimeAsync(1000);

    expect(run).toHaveBeenCalledTimes(1);
    expect(refresh.isPending(1)).toBe(false);
  });
});
