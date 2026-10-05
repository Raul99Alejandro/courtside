import { it, expect } from 'vitest';
import { answerQuestion, FALLBACK_ANSWER } from '../src/explain/answer.js';

const input = { question: 'What is offside?', layer: 'basic' as const, viewerName: 'Ana' };
it('returns the model text', async () => {
  expect(await answerQuestion(input, { converse: async () => ({ text: 'Offside means...', modelId: 'f' }) })).toBe('Offside means...');
});
it('falls back when every model fails', async () => {
  expect(await answerQuestion(input, { converse: async () => { throw new Error('boom'); } })).toBe("I couldn't answer that right now - try again in a moment.");
  expect(FALLBACK_ANSWER).toContain('try again');
});
it('falls back when the answer breaks the card checks', async () => {
  expect(await answerQuestion(input, { converse: async () => ({ text: 'The 2022 FIFA final [1,2]', modelId: 'f' }) })).toBe(FALLBACK_ANSWER);
});
