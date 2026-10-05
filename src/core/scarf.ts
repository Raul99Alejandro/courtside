import { byCreation } from './viewer.js';

/** Scarf colours in profile order (design/direction.md): yellow, sky, coral, chalk-white. */
export const SCARF_COLORS = ['#F2C230', '#7FB8E6', '#FF6B57', '#F4F6FA'] as const;

export interface Scarf {
  color: string;
  /** Profiles beyond the fourth reuse the colours with a stripe pattern. */
  striped: boolean;
}

/** The viewer's place in creation order (what `scarfFor` takes); an unknown name gets the first. */
export function scarfIndex(viewers: { name: string; order?: number }[], name: string): number {
  return Math.max(0, byCreation(viewers).findIndex(v => v.name === name));
}

/** A viewer's scarf from their position in creation order (see scarfIndex); stable for life. */
export function scarfFor(index: number): Scarf {
  const i = Number.isInteger(index) && index > 0 ? index : 0;
  return { color: SCARF_COLORS[i % SCARF_COLORS.length]!, striped: i >= SCARF_COLORS.length };
}
