import { it, expect } from 'vitest';
import { checkCard, definesConcept } from '../src/core/index.js';
it('flags empty', () => expect(checkCard('  ', 'basic', {})).toEqual(['empty']));
it('flags World Cup in any case', () => expect(checkCard('A world cup moment.', 'basic', {})).toContainEqual(expect.stringContaining('banned')));
it('accepts en dash scores', () => expect(checkCard('Argentina lead 3–2 now.', 'intermediate', { effect: 'puts Argentina ahead 3-2' })).toEqual([]));
it('flags a contradicting effect', () => expect(checkCard('Messi ties it 3-2.', 'intermediate', { effect: 'puts Argentina ahead 3-2' })).toContain('contradicts effect: says level'));
it('accepts spaced score separators', () => expect(checkCard('Argentina lead 3 - 2 now.', 'intermediate', { effect: 'puts Argentina ahead 3-2' })).toEqual([]));
it('flags a missing score', () => expect(checkCard('Argentina lead now.', 'intermediate', { effect: 'puts Argentina ahead 3-2' })).toContain('missing score 3-2'));
it('flags brackets', () => expect(checkCard('Shot at [1,2].', 'basic', {})).toContain('mentions coordinates'));
it('definesConcept needs a definition marker', () => {
  expect(definesConcept('Offside: a rule.', 'offside')).toBe(true);
  expect(definesConcept('Offside means being ahead.', 'offside')).toBe(true);
  expect(definesConcept('Messi was offside twice.', 'offside')).toBe(false);
  expect(definesConcept('Messi scores.', 'offside')).toBe(false);
});
it('flags equalises/equalizes for a puts-ahead effect', () => {
  expect(checkCard('Messi equalises 3-2.', 'intermediate', { effect: 'puts Argentina ahead 3-2' })).toContain('contradicts effect: says level');
  expect(checkCard('Messi equalizes 3-2.', 'intermediate', { effect: 'puts Argentina ahead 3-2' })).toContain('contradicts effect: says level');
});
