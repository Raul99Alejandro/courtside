import type { Moment } from '@courtside/core';

/** A rectangle in pitch units (StatsBomb 120x80), top-left origin. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * x of the offside line for a moment, attacking left to right: the second-last opponent, goalkeeper counted.
 * Only given when the 360 frame shows the goalkeeper and at least one more opponent, so the claim is true to the data.
 */
export function offsideLineX(m: Moment): number | undefined {
  if (!m.concepts.includes('offside') || !m.players) return undefined;
  const opponents = m.players.filter(p => !p.teammate);
  if (!opponents.some(p => p.keeper) || opponents.length < 2) return undefined;
  const xs = opponents.map(p => p.x).sort((a, b) => b - a);
  return xs[1];
}

const overlap = (a: Box, b: Box) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

/** Distance from point p to the segment a-b. */
const distToSegment = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = dx || dy ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/**
 * Where to write a note of size w x h next to `anchor`: the candidate spot nearest the anchor that stays inside
 * `bounds`, keeps clear of the players (`obstacles`) and does not cover another note (`taken`).
 * `gap` is the room left between the note and the anchor (enough for an arrow by default).
 * `clear` is false when even the best spot touches a player, an arrow path or another note.
 */
export function placeNote(anchor: Point, w: number, h: number, obstacles: Point[], bounds: Bounds, taken: Box[] = [], gap = 8): Box & { clear: boolean } {
  const xs = [-w - gap, -w / 2, gap, -w - gap * 2.4, gap * 2.4];
  const ys = [-h - gap, gap, -h - gap * 2.6, gap * 2.6];
  let best: (Box & { clear: boolean }) | undefined;
  let bestScore = Infinity;
  for (const dx of xs) {
    for (const dy of ys) {
      const box: Box = {
        x: Math.min(Math.max(anchor.x + dx, bounds.minX), bounds.maxX - w),
        y: Math.min(Math.max(anchor.y + dy, bounds.minY), bounds.maxY - h),
        w,
        h,
      };
      const pad = 1.9; // a player dot is about 2 units in radius
      const hit = obstacles.filter(p => p.x > box.x - pad && p.x < box.x + w + pad && p.y > box.y - pad && p.y < box.y + h + pad).length;
      const cover = taken.reduce((s, t) => s + overlap(box, t), 0);
      const cx = box.x + w / 2 - anchor.x;
      const cy = box.y + h / 2 - anchor.y;
      // the arrow from the note to the anchor should not run over other players either
      const start = { x: Math.min(Math.max(anchor.x, box.x), box.x + w), y: Math.min(Math.max(anchor.y, box.y), box.y + h) };
      const crossed = obstacles.filter(p => Math.hypot(p.x - anchor.x, p.y - anchor.y) > 4.5 && distToSegment(p, start, anchor) < 2.2).length;
      const score = hit * 40 + crossed * 14 + cover * 20 + Math.hypot(cx, cy);
      if (score < bestScore) {
        bestScore = score;
        best = { ...box, clear: hit === 0 && crossed === 0 && cover === 0 };
      }
    }
  }
  return best as Box & { clear: boolean };
}
