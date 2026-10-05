/** Scarf colours in profile order (design/direction.md): yellow, sky, coral, chalk-white. */
export const SCARF_COLORS = ['#F2C230', '#7FB8E6', '#FF6B57', '#F4F6FA'] as const;

export interface Scarf {
  color: string;
  /** Profiles beyond the fourth reuse the colours with a stripe pattern. */
  striped: boolean;
}

/** A viewer's scarf from their position in the household profile list; stable for life. */
export function scarfFor(index: number): Scarf {
  const i = Number.isInteger(index) && index > 0 ? index : 0;
  return { color: SCARF_COLORS[i % SCARF_COLORS.length]!, striped: i >= SCARF_COLORS.length };
}
