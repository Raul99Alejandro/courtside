import { describe, expect, it } from 'vitest';
import type { Moment } from '@courtside/core';
import { offsideLineX, placeNote } from './annotations';

type P = Moment['players'];
const moment = (concepts: Moment['concepts'], players: P): Moment =>
  ({ id: 'm', minute: 13, phase: 'First half', team: 'Argentina', what: 'Pass', concepts, scoreBefore: {}, scoreAfter: {}, players }) as Moment;
const opp = (x: number, keeper = false) => ({ x, y: 40, teammate: false, actor: false, keeper });
const mate = (x: number) => ({ x, y: 30, teammate: true, actor: false, keeper: false });

describe('offsideLineX', () => {
  it('is the second-last opponent when the keeper is in the frame', () => {
    expect(offsideLineX(moment(['offside'], [opp(100), opp(104), opp(116, true), mate(110)]))).toBe(104);
  });
  it('counts the keeper even when he is not the deepest opponent', () => {
    expect(offsideLineX(moment(['offside'], [opp(100), opp(112, true), opp(118)]))).toBe(112);
  });
  it('gives nothing when the keeper is not in the frame', () => {
    expect(offsideLineX(moment(['offside'], [opp(100), opp(104)]))).toBeUndefined();
  });
  it('gives nothing for a moment that is not about offside, or without a frame', () => {
    expect(offsideLineX(moment(['goal'], [opp(100), opp(116, true)]))).toBeUndefined();
    expect(offsideLineX(moment(['offside'], undefined))).toBeUndefined();
  });
});

describe('placeNote', () => {
  const bounds = { minX: -2, maxX: 122, minY: -2, maxY: 82 };
  it('keeps the note inside the pitch', () => {
    const b = placeNote({ x: 118, y: 2 }, 20, 6, [], bounds);
    expect(b.x).toBeGreaterThanOrEqual(bounds.minX);
    expect(b.x + b.w).toBeLessThanOrEqual(bounds.maxX);
    expect(b.y).toBeGreaterThanOrEqual(bounds.minY);
    expect(b.y + b.h).toBeLessThanOrEqual(bounds.maxY);
  });
  it('stays clear of the players when there is room', () => {
    const crowd = [{ x: 85, y: 38 }, { x: 90, y: 40 }, { x: 95, y: 36 }];
    const b = placeNote({ x: 96, y: 40 }, 20, 6, crowd, bounds);
    for (const p of crowd) expect(p.x > b.x - 1.9 && p.x < b.x + b.w + 1.9 && p.y > b.y - 1.9 && p.y < b.y + b.h + 1.9).toBe(false);
  });
  it('reports when the best spot is still not clear', () => {
    const wall = Array.from({ length: 169 }, (_, i) => ({ x: (i % 13) * 10, y: Math.floor(i / 13) * 6.5 }));
    expect(placeNote({ x: 60, y: 40 }, 20, 6, wall, bounds).clear).toBe(false);
    expect(placeNote({ x: 60, y: 40 }, 20, 6, [], bounds).clear).toBe(true);
  });
  it('does not cover a note already taken', () => {
    const taken = [{ x: 60, y: 10, w: 30, h: 6 }];
    const b = placeNote({ x: 75, y: 24 }, 20, 6, [], bounds, taken);
    const clear = b.x + b.w <= 60 || b.x >= 90 || b.y + b.h <= 10 || b.y >= 16;
    expect(clear).toBe(true);
  });
});
