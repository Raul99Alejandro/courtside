import { pickViewer } from '../../src/core/index.js';
import type { Adapter } from './index.js';
export const r09: Adapter = (g, w) => {
  let present: string[] = g.picked;
  for (const name of [w.pick].flat()) {
    const r = pickViewer(present, name);
    if (!r.ok) return { accepted: false, tv_shows: r.message };
    present = r.present;
  }
  return { accepted: true, present };
};
