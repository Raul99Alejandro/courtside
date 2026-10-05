import { describe, expect, it } from 'vitest';
import { togglePick } from './picking';

describe('togglePick', () => {
  it('adds a viewer', () => {
    expect(togglePick(['Leo'], 'Ana')).toEqual({ present: ['Leo', 'Ana'] });
  });
  it('removes a viewer who is already picked', () => {
    expect(togglePick(['Leo', 'Ana'], 'Leo')).toEqual({ present: ['Ana'] });
  });
  it('refuses a 4th viewer with the R-09 message and keeps the list', () => {
    expect(togglePick(['Leo', 'Ana', 'Raul'], 'Sofia')).toEqual({
      present: ['Leo', 'Ana', 'Raul'],
      message: 'Up to 3 viewers at a time',
    });
  });
});
