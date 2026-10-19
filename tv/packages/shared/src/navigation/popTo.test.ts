import { describe, expect, it, vi } from 'vitest';
import { popTo } from './popTo';

describe('popTo', () => {
  it('uses popTo when the navigator has it (React Navigation 7)', () => {
    const nav = { navigate: vi.fn(), popTo: vi.fn() };
    popTo(nav, 'Replay');
    expect(nav.popTo).toHaveBeenCalledWith('Replay');
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('falls back to navigate on the Vega ports (React Navigation 6, no popTo)', () => {
    const nav = { navigate: vi.fn() };
    popTo(nav, 'Watching');
    expect(nav.navigate).toHaveBeenCalledWith('Watching');
  });
});
