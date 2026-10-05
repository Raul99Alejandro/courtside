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
