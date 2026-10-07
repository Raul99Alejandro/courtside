import { it, expect, vi } from 'vitest';
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
it('replaces an em dash instead of discarding the answer, and asks the model not to use one', async () => {
  let system = '';
  const out = await answerQuestion(input, { converse: async (_m, s) => { system = s; return { text: 'Offside — the attacker was ahead of the last defender.', modelId: 'f' }; } });
  expect(out).toBe('Offside, the attacker was ahead of the last defender.');
  expect(system).toContain('Never use the em dash');
});
it('says match for a basic viewer instead of discarding an answer that says game', async () => {
  let system = '';
  const out = await answerQuestion(input, { converse: async (_m, s) => { system = s; return { text: 'A goal kick restarts the game. Games stop for it.', modelId: 'f' }; } });
  expect(out).toBe('A goal kick restarts the match. Matches stop for it.');
  expect(system).toContain("say 'match'");
});
it('leaves the word game alone for other layers', async () => {
  const out = await answerQuestion({ ...input, layer: 'intermediate' }, { converse: async () => ({ text: 'Game state matters here.', modelId: 'f' }) });
  expect(out).toBe('Game state matters here.');
});

const ok = 'Offside means the attacker was ahead of the last defender.';
it('retries once with the problems appended when the first answer is rejected', async () => {
  const prompts: string[] = [];
  const out = await answerQuestion(input, { converse: async (_m, _s, u) => { prompts.push(u); return { text: prompts.length === 1 ? 'The 2022 FIFA final [1,2]' : ok, modelId: 'f' }; } });
  expect(out).toBe(ok);
  expect(prompts).toHaveLength(2);
  expect(prompts[1]).toContain('rejected');
  expect(prompts[1]).toContain('Question: What is offside?');
});
it('falls back when both attempts fail, logging reason codes only', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  let calls = 0;
  const out = await answerQuestion(input, { converse: async () => { calls++; return { text: 'The 2022 FIFA final [1,2]', modelId: 'f' }; } });
  expect(out).toBe(FALLBACK_ANSWER);
  expect(calls).toBe(2);
  const lines = log.mock.calls.map(c => String(c[0]));
  log.mockRestore();
  expect(lines).toHaveLength(2);
  const first = JSON.parse(lines[0]!);
  expect(first.event).toBe('answer_rejected');
  expect(first.attempt).toBe(1);
  expect(first.reasons).toContain('banned_term');
  expect(lines.join('')).not.toContain('2022');
});
it('does not retry when less than 2.5 s remain', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  let calls = 0;
  const out = await answerQuestion({ ...input, deadlineAt: Date.now() + 1000 }, { converse: async () => { calls++; return { text: 'The 2022 FIFA final [1,2]', modelId: 'f' }; } });
  vi.restoreAllMocks();
  expect(out).toBe(FALLBACK_ANSWER);
  expect(calls).toBe(1);
});
it('puts only the moment concepts definitions in the live system prompt, or all of them with no moment', async () => {
  const { DEFINITIONS } = await import('../src/core/index.js');
  let system = '';
  const converse = async (_m: string[], s: string) => { system = s; return { text: 'Offside is being ahead.', modelId: 'f' }; };
  await answerQuestion(input, { converse });
  for (const d of Object.values(DEFINITIONS)) expect(system).toContain(d);
  expect(system).toContain('Answer the question directly first, then explain the idea');
  await answerQuestion({ ...input, moment: { concepts: ['goal'] } as never }, { converse });
  expect(system).toContain(DEFINITIONS.goal);
  expect(system).not.toContain(DEFINITIONS.offside);
});

it('reads the live model chain from LIVE_MODELS, defaulting to Haiku then Nova 2 Lite', async () => {
  const { liveModels, parseModels, DEFAULT_LIVE_MODELS } = await import('../src/explain/models.js');
  expect(liveModels({})).toEqual(DEFAULT_LIVE_MODELS);
  expect(liveModels({ LIVE_MODELS: ' ' })).toEqual(DEFAULT_LIVE_MODELS);
  expect(parseModels(' a , b,,c ')).toEqual(['a', 'b', 'c']);
  const prev = process.env.LIVE_MODELS;
  process.env.LIVE_MODELS = 'us.amazon.nova-pro-v1:0';
  let ids: string[] = [];
  await answerQuestion(input, { converse: async (m: string[]) => { ids = m; return { text: 'Offside is being ahead.', modelId: 'f' }; } });
  if (prev === undefined) delete process.env.LIVE_MODELS; else process.env.LIVE_MODELS = prev;
  expect(ids).toEqual(['us.amazon.nova-pro-v1:0']);
});

// No-context guard: nothing on screen means nothing to say about "that" play.
import { NO_MOMENT_REPLY } from '../src/explain/answer.js';
import { momentById } from '../src/explain/moments.js';
it('asks for the replay when a situational question has no moment and names no concept', async () => {
  let called = false;
  const out = await answerQuestion({ ...input, question: "How did the score shape France's approach?" }, { converse: async () => { called = true; return { text: 'x', modelId: 'f' }; } });
  expect(out).toBe(NO_MOMENT_REPLY);
  expect(called).toBe(false);
  expect(NO_MOMENT_REPLY).toBe('Start the replay on the TV and ask again, so I can see which moment you mean.');
});
it('answers only the general rule when a situational question names a concept but no moment is on screen', async () => {
  let system = '';
  const out = await answerQuestion({ ...input, question: 'Why was that a penalty?' }, { converse: async (_m, s) => { system = s; return { text: 'A penalty kick is a free shot from the spot, given for a foul in the box.', modelId: 'f' }; } });
  expect(out).toContain('penalty kick');
  expect(system).toContain('No match moment is on screen');
  expect(system).toContain('A penalty kick is a free shot');
  expect(system).not.toContain('Offside is');
});
it('a plain rule question with no moment is unchanged', async () => {
  let system = '';
  await answerQuestion(input, { converse: async (_m, s) => { system = s; return { text: ok, modelId: 'f' }; } });
  expect(system).not.toContain('No match moment');
  expect(system).toContain('Offside is');
});
it('with a moment, the prompt states the score, leader and trailer and forbids other moments', async () => {
  const moment = momentById('6cc0d5e2-6999-4006-8a7a-34de4cbe3ffd')!;
  let system = '', user = '';
  await answerQuestion({ ...input, question: 'Why was that a penalty?', moment }, { converse: async (_m, s, u) => { system = s; user = u; return { text: 'It was a foul in the box, so France got a free shot.', modelId: 'f' }; } });
  expect(system).toContain('Argentina 2, France 1');
  expect(system).toContain('Argentina is leading and France is trailing');
  expect(system).toContain('Make no claim about any other moment');
  expect(user).toContain('Argentina is leading and France is trailing');
});
it('knows the moments by id', () => {
  expect(momentById('nope')).toBeUndefined();
  expect(momentById(undefined)).toBeUndefined();
});
