import { describe, expect, it } from 'vitest';
import { byCreation, newViewer, nextOrder, promotionMessage, scarfFor, scarfIndex } from '../src/core/index.js';

describe('creation order', () => {
  it('sorts by order, then profiles without one by name', () => {
    const list = [newViewer('Raul', 'fan'), newViewer('Zoe', 'fan', 1), newViewer('Ana', 'fan'), newViewer('Bo', 'fan', 2)];
    expect(byCreation(list).map(v => v.name)).toEqual(['Zoe', 'Bo', 'Ana', 'Raul']);
  });
  it('nextOrder is one past the highest', () => {
    expect(nextOrder([])).toBe(1);
    expect(nextOrder([newViewer('A', 'fan'), newViewer('B', 'fan', 4)])).toBe(5);
  });
  it('scarfIndex follows creation order, whatever order the list is in', () => {
    const list = [newViewer('Zoe', 'fan', 2), newViewer('Adam', 'fan', 1)];
    expect(scarfIndex(list, 'Adam')).toBe(0);
    expect(scarfIndex(list, 'Zoe')).toBe(1);
    expect(scarfFor(scarfIndex(list, 'Zoe')).color).toBe(scarfFor(1).color);
    expect(scarfIndex(list, 'Nobody')).toBe(0);
  });
  it('promotionMessage names the viewer and the new level', () => {
    expect(promotionMessage({ ...newViewer('Leo', 'fan') })).toBe('Leo moved up to Fan');
  });
});
