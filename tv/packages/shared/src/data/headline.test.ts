import { describe, expect, it } from 'vitest';
import type { Moment } from '@courtside/core';
import { momentDetail } from './headline';

const base = { id: 'x', minute: 10, phase: 'first half', team: 'Argentina', what: 'Pass' } as Moment;

describe('momentDetail', () => {
  it('uses the effect when there is one', () => expect(momentDetail({ ...base, effect: 'opens the scoring 1-0', outcome: 'Goal' })).toBe('opens the scoring 1-0'));
  it('shows plain outcome words', () => {
    expect(momentDetail({ ...base, outcome: 'Pass Offside' })).toBe('Ruled offside');
    expect(momentDetail({ ...base, outcome: 'Off T' })).toBe('Off target');
    expect(momentDetail({ ...base, outcome: 'Saved' })).toBe('Saved by the keeper');
  });
  it('falls back to the phase', () => expect(momentDetail(base)).toBe('first half'));
});
