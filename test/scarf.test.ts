import { describe, expect, it } from 'vitest';
import { SCARF_COLORS, scarfFor } from '../src/core/scarf.js';

describe('scarfFor', () => {
  it('gives the first four profiles yellow, sky, coral and chalk-white, plain', () => {
    expect([0, 1, 2, 3].map(scarfFor)).toEqual([
      { color: '#F2C230', striped: false },
      { color: '#7FB8E6', striped: false },
      { color: '#FF6B57', striped: false },
      { color: '#F4F6FA', striped: false },
    ]);
  });
  it('reuses the colours with a stripe pattern from the fifth profile on', () => {
    expect(scarfFor(4)).toEqual({ color: SCARF_COLORS[0], striped: true });
    expect(scarfFor(7)).toEqual({ color: SCARF_COLORS[3], striped: true });
    expect(scarfFor(9)).toEqual({ color: SCARF_COLORS[1], striped: true });
  });
  it('is stable: the same index always gives the same scarf', () => {
    expect(scarfFor(2)).toEqual(scarfFor(2));
  });
  it('treats an unknown profile (-1) as the first scarf', () => {
    expect(scarfFor(-1)).toEqual(scarfFor(0));
  });
});
