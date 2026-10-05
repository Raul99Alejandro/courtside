import { it, expect } from 'vitest';
import { DEFINITIONS, definitionFor, type Concept } from '../src/core/index.js';

const ALL: Concept[] = ['penalty kick', 'offside', 'yellow card', 'red card', 'assist', 'shot on goal', 'shot', 'goal', 'extra time', 'penalty shoot-out', 'save'];

it('every concept has one canonical definition of at most 25 words', () => {
  expect(Object.keys(DEFINITIONS).sort()).toEqual([...ALL].sort());
  for (const c of ALL) {
    const d = definitionFor(c);
    expect(d.trim().length, c).toBeGreaterThan(10);
    expect(d.split(/\s+/).length, c).toBeLessThanOrEqual(25);
    expect(d, c).not.toMatch(/—/);
  }
});
it('offside is in the opponents half and mentions the ball and the second-last opponent, not just "no defenders"', () => {
  expect(DEFINITIONS.offside).toMatch(/in the opponents' half/);
  expect(DEFINITIONS.offside).toMatch(/second-last opponent/);
  expect(DEFINITIONS.offside).toMatch(/ball/);
});

import { checkCard } from '../src/core/index.js';
it('a basic line may be 10 words longer for each concept after the first', () => {
  const w = (n: number) => Array(n).fill('word').join(' ');
  expect(checkCard(w(29), 'basic', { concepts: ['goal'] })).toContain('too long: 29 > 28');
  expect(checkCard(w(38), 'basic', { concepts: ['goal', 'extra time'] }).filter(p => p.startsWith('too long'))).toEqual([]);
  expect(checkCard(w(39), 'basic', { concepts: ['goal', 'extra time'] })).toContain('too long: 39 > 38');
});
