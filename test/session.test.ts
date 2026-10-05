import { it, expect } from 'vitest';
import { addViewer, newViewer, normaliseCode, pickViewer } from '../src/core/index.js';
it('rejects duplicate names case-insensitively', () => {
  const r = addViewer([newViewer('Leo', 'beginner')], newViewer('leo', 'fan'));
  expect(r).toEqual({ ok: false, message: 'leo already exists' });
});
it('normalises pairing codes', () => expect(normaliseCode(' ab 12-cd ')).toBe('AB12CD'));
it('picking someone already present is a no-op', () => expect(pickViewer(['Leo'], 'Leo')).toEqual({ ok: true, present: ['Leo'] }));
