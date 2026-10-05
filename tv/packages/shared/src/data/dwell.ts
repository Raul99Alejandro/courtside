/** A basic explanation counts as shown (R-04) only after the moment stayed on screen this long. */
export const SHOWN_DWELL_MS = 3000;

/** Runs `fn` after `ms`; the returned function cancels it (use as a React effect cleanup). */
export function scheduleDwell(ms: number, fn: () => void): () => void {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
}

/** Wraps an async action so calls made while one is still running are ignored (no double sessions). */
export function singleFlight<A extends unknown[], T>(fn: (...args: A) => Promise<T>, onChange?: (busy: boolean) => void) {
  let busy = false;
  return async (...args: A): Promise<T | undefined> => {
    if (busy) return undefined;
    busy = true;
    onChange?.(true);
    try {
      return await fn(...args);
    } finally {
      busy = false;
      onChange?.(false);
    }
  };
}
