import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHOWN_DWELL_MS, scheduleDwell, singleFlight } from './dwell';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('scheduleDwell', () => {
  it('fires after 3 s on screen', () => {
    const fn = vi.fn();
    scheduleDwell(SHOWN_DWELL_MS, fn);
    vi.advanceTimersByTime(2999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a moment left before 3 s is never reported (the timer is cleared on change)', () => {
    const fn = vi.fn();
    const cancel = scheduleDwell(SHOWN_DWELL_MS, fn);
    vi.advanceTimersByTime(2000);
    cancel();
    vi.advanceTimersByTime(10_000);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('singleFlight', () => {
  it('ignores a second call while the first is in flight, then allows another', async () => {
    let release!: () => void;
    const work = vi.fn(() => new Promise<string>(res => (release = () => res('done'))));
    const busy = vi.fn();
    const run = singleFlight(work, busy);
    const first = run();
    expect(await run()).toBeUndefined();
    expect(work).toHaveBeenCalledTimes(1);
    release();
    expect(await first).toBe('done');
    expect(busy.mock.calls.map(c => c[0])).toEqual([true, false]);
    void run();
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('releases the lock when the action throws', async () => {
    const run = singleFlight(vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(1));
    await expect(run()).rejects.toThrow('x');
    expect(await run()).toBe(1);
  });
});
