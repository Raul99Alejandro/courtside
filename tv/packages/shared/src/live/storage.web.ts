import type { KeyValueStorage } from './controller';

/** Web: localStorage, which can throw (private windows, blocked storage); then the code just lasts until reload. */
const memory = new Map<string, string>();

export const storage: KeyValueStorage = {
  async get(key) {
    try {
      return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  async set(key, value) {
    memory.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* kept in memory */
    }
  },
  async remove(key) {
    memory.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* nothing to remove */
    }
  },
};
