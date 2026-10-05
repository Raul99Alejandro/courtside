import { describe, expect, it } from 'vitest';
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
it('flags the em dash', () => expect(checkCard('Messi scores — again.', 'basic', {})).toContainEqual(expect.stringContaining('em dash')));
it('flags a trailing word count', () => {
  expect(checkCard('Messi scores the goal. (12 words)', 'basic', {})).toContainEqual(expect.stringContaining('word count'));
  expect(checkCard('Messi scores the goal. (1 word)', 'basic', {})).toContainEqual(expect.stringContaining('word count'));
  expect(checkCard('Messi scores the goal.', 'basic', {})).toEqual([]);
});

describe('soccer vocabulary', () => {
  it('rejects point(s) for goals', () => {
    expect(checkCard('Messi scores to put Argentina one point ahead.', 'basic', {})).toContainEqual(expect.stringContaining('point'));
    expect(checkCard('A team gets two points.', 'intermediate', {})).toContainEqual(expect.stringContaining('point'));
  });
  it('rejects American-football terms', () => {
    for (const w of ['touchdown', 'quarterback', 'field goal']) expect(checkCard(`That was a ${w}.`, 'intermediate', {})).toContain('uses an American-football term');
  });
  it('prefers match to game in basic lines only', () => {
    expect(checkCard('This is a big game.', 'basic', {})).toContainEqual(expect.stringContaining('match'));
    expect(checkCard('Argentina protect the lead, game state favours them.', 'tactical', {})).toEqual([]);
  });
  it('accepts tied and normal lines', () => expect(checkCard('The match is tied at 2-2.', 'basic', {})).toEqual([]));
});

describe('tactical numbers', () => {
  it('rejects more than two numbers', () => expect(checkCard('Minute 107, 3 defenders, 12 yards, 4 attackers.', 'tactical', {})).toContainEqual(expect.stringContaining('numbers')));
  it('allows two, and counts a score as one', () => {
    expect(checkCard('Argentina lead 3-2 with 12 yards to goal.', 'tactical', {})).toEqual([]);
    expect(checkCard('Two defenders and 12 yards.', 'tactical', {})).toEqual([]);
  });
  it('is not applied to other layers', () => expect(checkCard('Minute 107, 3 defenders, 12 yards, 4 attackers.', 'intermediate', {})).toEqual([]));
});
