import { it, expect } from 'vitest';
import { momentsToGenerate, keepGood, runGeneration, type Card, type Stats } from '../src/explain/generate.js';
import { parseCard } from '../src/explain/prompt.js';
import type { Moment } from '../src/core/index.js';

const base: Moment = {
  id: 'a', minute: 107, phase: 'extra time, second period', team: 'Argentina', player: 'Lionel Messi', what: 'Shot', outcome: 'Goal',
  concepts: ['goal', 'offside'], scoreBefore: { Argentina: 2, France: 2 }, scoreAfter: { Argentina: 3, France: 2 },
  effect: 'puts Argentina ahead 3-2', zone: "inside the opponent's penalty area, centre", ball: [118.4, 40.2], players: [],
};
const moments = (n: number): Moment[] => Array.from({ length: n }, (_, i) => ({ ...base, id: `m${i}` }));
const goodText = 'basic: Offside means an attacker is nearer the goal than the ball and the last two defenders when passed to.\nintermediate: Messi scores in extra time and puts Argentina ahead 3-2.\ntactical: Argentina lead 3-2 after pressing high and winning the second ball.';
const goodCard = parseCard(goodText) as Card;
const badCard: Card = { ...goodCard, intermediate: 'Messi scores [1].' }; // brackets fail the deterministic checks
const stats = (): Stats => ({ calls: 0, retries: 0, judgeErrors: 0, inputTokens: 0, outputTokens: 0 });
const fake = (counter: { n: number }) => async (_ids: string[], sys: string) => {
  if (sys.includes('strict reviewer')) return { text: 'Verdict: yes', modelId: 'f' };
  counter.n++;
  return { text: goodText, modelId: 'f' };
};

it('incremental run picks missing moments and cards that fail the current checks', () => {
  const ms = moments(3);
  const prev = { m0: goodCard, m1: badCard };
  expect(momentsToGenerate(ms, prev, false).map(m => m.id)).toEqual(['m1', 'm2']);
  expect(momentsToGenerate(ms, prev, true).map(m => m.id)).toEqual(['m0', 'm1', 'm2']);
  expect(Object.keys(keepGood(ms, { ...prev, gone: goodCard }))).toEqual(['m0']);
});

it('generates only what is needed and merges with the kept cards', async () => {
  const ms = moments(4);
  const c = { n: 0 };
  const r = await runGeneration(ms, { m0: goodCard, m1: goodCard, m2: badCard }, fake(c), undefined, stats());
  expect(r.todo).toBe(2);
  expect(c.n).toBe(2);
  expect(Object.keys(r.merged)).toEqual(['m0', 'm1', 'm2', 'm3']);
  expect(r.merged.m2).toEqual(goodCard);
  expect(r.write).toBe(true);
  expect(r.failed).toEqual([]);
});

it('--all regenerates every moment', async () => {
  const c = { n: 0 };
  const r = await runGeneration(moments(3), { m0: goodCard, m1: goodCard, m2: goodCard }, fake(c), undefined, stats(), true);
  expect(r.todo).toBe(3);
  expect(c.n).toBe(3);
});

it('the 90 % rule applies to the merged file, not to the new cards alone', async () => {
  const ms = moments(10);
  const prev = Object.fromEntries(ms.slice(0, 9).map(m => [m.id, goodCard]));
  // one missing moment whose generation always fails: 9/10 merged still passes
  const failing = async (_ids: string[], sys: string) => sys.includes('strict reviewer') ? { text: 'Verdict: yes', modelId: 'f' } : { text: 'basic: x', modelId: 'f' };
  const ok = await runGeneration(ms, prev, failing, undefined, stats());
  expect(ok.generated).toBe(0);
  expect(ok.failed).toHaveLength(1);
  expect(ok.write).toBe(true);
  // two missing: 8/10 merged is below 90 %
  const low = await runGeneration(ms, Object.fromEntries(ms.slice(0, 8).map(m => [m.id, goodCard])), failing, undefined, stats());
  expect(low.write).toBe(false);
});
