import { expect, it } from 'vitest';
import { outcomeLabel } from '../src/core/index.js';

it('maps raw outcomes to plain words', () => {
  expect(outcomeLabel('Pass Offside')).toBe('Ruled offside');
  expect(outcomeLabel('Off T')).toBe('Off target');
  expect(outcomeLabel('Blocked')).toBe('Blocked');
  expect(outcomeLabel('Saved')).toBe('Saved by the keeper');
  expect(outcomeLabel('Wayward')).toBe('Wide');
  expect(outcomeLabel('Post')).toBe('Hit the post');
  expect(outcomeLabel('Goal')).toBe('Goal');
});
it('passes unknown outcomes through', () => expect(outcomeLabel('Something')).toBe('Something'));
