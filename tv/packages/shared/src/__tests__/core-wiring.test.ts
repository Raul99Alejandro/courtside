import { describe, expect, it } from 'vitest';
import { layerFor, newViewer } from '@courtside/core';

describe('core wiring', () => {
  it('a beginner with no understood concepts gets the basic layer', () => {
    expect(layerFor(newViewer('Guest', 'beginner'), [])).toBe('basic');
  });
});
