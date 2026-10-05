import { describe, expect, it } from 'vitest';
import { newViewer, type Moment } from '@courtside/core';
import { cardRowsFor, type Cards } from './match';
import { shortName } from './names';

const goal: Moment = {
  id: 'm107', minute: 107, phase: 'extra time, second period', team: 'Argentina', player: 'Lionel Messi',
  what: 'Shot', outcome: 'Goal', concepts: ['goal', 'extra time'],
  scoreBefore: { Argentina: 2, France: 2 }, scoreAfter: { Argentina: 3, France: 2 },
  effect: 'puts Argentina ahead 3-2',
};
const cards: Cards = {
  m107: { basic: 'BASIC text', intermediate: 'MID text', tactical: 'TACTICAL text' },
};
const leo = newViewer('Leo', 'beginner');
const ana = { ...newViewer('Ana', 'beginner'), understood: ['goal' as const] };
const raul = newViewer('Raul', 'expert');

describe('cardRowsFor', () => {
  it('puts Leo and Ana on one basic row and Raul on a tactical row, lowest first', () => {
    const rows = cardRowsFor(goal, [leo, ana, raul], cards);
    expect(rows).toEqual([
      { layer: 'basic', viewers: ['Leo', 'Ana'], text: 'BASIC text' },
      { layer: 'tactical', viewers: ['Raul'], text: 'TACTICAL text' },
    ]);
  });

  it('moves a beginner who understood every concept up to the intermediate row', () => {
    const both = { ...leo, understood: ['goal' as const, 'extra time' as const] };
    const rows = cardRowsFor(goal, [both], cards);
    expect(rows.map(r => r.layer)).toEqual(['intermediate']);
  });

  it('falls back to the concept definitions when the moment has no card', () => {
    const rows = cardRowsFor({ ...goal, id: 'none' }, [leo, raul], cards);
    expect(rows).toHaveLength(2);
    expect(rows[0].text).toContain('A goal means the ball goes into the net.');
    expect(rows[0].text).toContain('Extra time');
    expect(rows[1].layer).toBe('tactical');
  });

  it('returns no rows when nobody is present', () => {
    expect(cardRowsFor(goal, [], cards)).toEqual([]);
  });
});

describe('shortName', () => {
  it('picks the surname people use', () => {
    expect(shortName('Lionel Andrés Messi Cuccittini')).toBe('Messi');
    expect(shortName('Rodrigo Javier De Paul')).toBe('De Paul');
    expect(shortName('Kylian Mbappé Lottin')).toBe('Lottin');
    expect(shortName('Kylian Mbappé Lottin', "Mbappé's shot was blocked")).toBe('Mbappé');
    expect(shortName(undefined)).toBe('');
  });
});
