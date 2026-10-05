import { it, expect } from 'vitest';
import { checkCard } from '../src/core/index.js';
it('flags empty', () => expect(checkCard('  ', 'basic', {})).toEqual(['empty']));
it('flags World Cup in any case', () => expect(checkCard('A world cup moment.', 'basic', {})).toContainEqual(expect.stringContaining('banned')));
it('accepts en dash scores', () => expect(checkCard('Argentina lead 3–2 now.', 'intermediate', { effect: 'puts Argentina ahead 3-2' })).toEqual([]));
it('flags a contradicting effect', () => expect(checkCard('Messi ties it 3-2.', 'intermediate', { effect: 'puts Argentina ahead 3-2' })).toContain('contradicts effect: says level'));
