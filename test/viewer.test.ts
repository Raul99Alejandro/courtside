import { describe, it, expect } from 'vitest';
import { newViewer, recordBasicShown, markGotIt, layerFor } from '../src/core/index.js';
describe('viewer edges', () => {
  it('trims names', () => expect(newViewer('  Leo ', 'beginner').name).toBe('Leo'));
  it('a moment with two concepts counts a view for each', () => {
    const r = recordBasicShown(newViewer('Leo', 'beginner'), ['penalty kick', 'extra time']).viewer;
    expect(r.seenBasic).toEqual({ 'penalty kick': 1, 'extra time': 1 });
  });
  it('marking an already understood concept changes nothing', () => {
    const v = markGotIt(newViewer('Leo', 'beginner'), 'offside').viewer;
    expect(markGotIt(v, 'offside').viewer).toBe(v);
  });
  it('a beginner with only some of the concepts stays basic', () => {
    const v = { ...newViewer('Ana', 'beginner'), understood: ['penalty kick'] as const };
    expect(layerFor({ ...v, understood: [...v.understood] }, ['penalty kick', 'extra time'])).toBe('basic');
  });
});
import { recordAsked, undoPromotion, PROMOTE_AT, basicRowFor } from '../src/core/index.js';
import type { Concept } from '../src/core/index.js';
const many = (n: number) => Array.from({ length: n }, (_, i) => `c${i}` as Concept);
describe('review edges', () => {
  it('a fan with 5+ understood gaining one more stays fan', () => {
    const v = { ...newViewer('Ana', 'fan'), understood: many(PROMOTE_AT + 2) };
    const r = markGotIt(v, 'extra time');
    expect(r.viewer.level).toBe('fan'); expect(r.promotion).toBeUndefined(); expect(r.undoOffered).toBeUndefined();
  });
  it('promotion offers undo; undo then reaching 6 stays beginner', () => {
    const v = { ...newViewer('Leo', 'beginner'), understood: many(PROMOTE_AT - 1) };
    const r = markGotIt(v, 'offside');
    expect(r.viewer.level).toBe('fan'); expect(r.undoOffered).toBe(true);
    const back = undoPromotion(r.viewer);
    expect(back.level).toBe('beginner');
    expect(markGotIt(back, 'goal').viewer.level).toBe('beginner');
  });
  it('after asking, two fresh views are needed', () => {
    let v = recordBasicShown(newViewer('Leo', 'beginner'), ['offside']).viewer;
    v = recordAsked(v, 'offside');
    v = recordBasicShown(v, ['offside']).viewer;
    expect(v.understood).toEqual([]);
    v = recordBasicShown(v, ['offside']).viewer;
    expect(v.understood).toEqual(['offside']);
  });
  it('basicRowFor offers Why? when understood', () => {
    const v = { ...newViewer('Ana', 'beginner'), understood: ['offside'] as Concept[] };
    expect(basicRowFor(v, ['offside'])).toEqual({ showBasic: false, offer: 'Why?' });
    expect(basicRowFor(newViewer('B', 'beginner'), ['offside'])).toEqual({ showBasic: true });
  });
});

describe('promotedAt (final review)', () => {
  const at = new Date('2026-10-05T12:00:00.000Z');
  it('is set on automatic promotion, by Got it and by a second basic view', () => {
    const v = { ...newViewer('Leo', 'beginner'), understood: many(PROMOTE_AT - 1) };
    expect(markGotIt(v, 'offside', at).viewer.promotedAt).toBe('2026-10-05T12:00:00.000Z');
    const seen = { ...v, seenBasic: { offside: 1 } };
    expect(recordBasicShown(seen, ['offside'], at).viewer).toMatchObject({ level: 'fan', promotedAt: '2026-10-05T12:00:00.000Z' });
  });
  it('is not set without a promotion, and is cleared by undo', () => {
    expect(markGotIt(newViewer('Leo', 'beginner'), 'goal', at).viewer.promotedAt).toBeUndefined();
    const up = markGotIt({ ...newViewer('Leo', 'beginner'), understood: many(PROMOTE_AT - 1) }, 'offside', at).viewer;
    expect(undoPromotion(up)).not.toHaveProperty('promotedAt');
  });
});
