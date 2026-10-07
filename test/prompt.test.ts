import { it, expect } from 'vitest';
import { cardPrompt, parseCard, judgeBasicPrompt, judgeFactsPrompt, parseJudge } from '../src/explain/prompt.js';
import { judgeBasic, judgeFacts } from '../src/explain/judge.js';
import { generateCard, type Stats } from '../src/explain/generate.js';
import { DEFINITIONS, type Moment } from '../src/core/index.js';

const m: Moment = {
  id: 'x', minute: 107, phase: 'extra time, second period', team: 'Argentina', player: 'Lionel Messi', what: 'Shot', outcome: 'Goal',
  concepts: ['goal', 'offside'], scoreBefore: { Argentina: 2, France: 2 }, scoreAfter: { Argentina: 3, France: 2 },
  effect: 'puts Argentina ahead 3-2', zone: "inside the opponent's penalty area, centre", ball: [118.4, 40.2],
  players: [{ x: 91.2345, y: 33.3333, teammate: true, actor: false, keeper: false }],
};

it('cardPrompt carries facts and rules but no coordinates', () => {
  const { system, user } = cardPrompt(m);
  expect(user).toContain('puts Argentina ahead 3-2');
  expect(user).toContain("inside the opponent's penalty area");
  expect(user).toContain('offside');
  expect(system).toContain('Never mention coordinates');
  expect(system).toContain('Never write World Cup or FIFA');
  expect(user + system).not.toMatch(/118\.4|40\.2|91\.2345|33\.3333|"ball"|"players"/);
  expect(user).not.toMatch(/World Cup|FIFA/i);
});
it('assist notes name the goal it set up', () => {
  const a: Moment = { ...m, concepts: ['assist'], setsUp: { player: 'Lionel Messi', minute: 23, effect: 'opens the scoring 1-0' } };
  expect(cardPrompt(a).user).toContain('assist for Lionel Messi');
  expect(cardPrompt(a).user).toContain('opens the scoring 1-0');
});
it('cardPrompt appends problems on retry', () => expect(cardPrompt(m, undefined, ['basic: too long']).user).toContain('basic: too long'));
it('parseCard reads three lines', () => {
  expect(parseCard('basic: a\nintermediate: b\ntactical: c')).toEqual({ basic: 'a', intermediate: 'b', tactical: 'c' });
  expect(parseCard('**basic:** a')).toEqual({ basic: 'a' });
});
it('judge parsing', async () => {
  expect(parseJudge('Yes.')).toBe(true);
  expect(parseJudge('no')).toBe(false);
  expect(parseJudge('No, because x. Actually it fits. Verdict: yes')).toBe(true);
  expect(parseJudge('It says yes to everything. Verdict: no')).toBe(false);
  expect(parseJudge('No, it does not')).toBe(false);
  expect(judgeBasicPrompt('s', m).user).toContain('goal and offside');
  expect(judgeFactsPrompt('s', m).user).toContain('invent nothing');
  expect(await judgeBasic('s', m, async () => ({ text: 'yes', modelId: 'f' }))).toEqual({ ok: true });
  expect(await judgeBasic('s', m, async () => ({ text: 'No', modelId: 'f' }))).toEqual({ ok: false });
  expect(await judgeFacts('s', m, async () => ({ text: 'No', modelId: 'f' }))).toEqual({ ok: false });
  expect(await judgeFacts('s', m, async () => { throw new Error('x'); })).toEqual({ ok: true, error: true });
});
const good = 'basic: Offside means an attacker is nearer the goal than the ball and the last two defenders when passed to.\nintermediate: Messi scores in extra time and puts Argentina ahead 3-2.\ntactical: Argentina lead 3-2 after pressing high and winning the second ball.';
const stats = (): Stats => ({ calls: 0, retries: 0, judgeErrors: 0, inputTokens: 0, outputTokens: 0 });
it('generateCard retries on a failed check, then a no judge, then succeeds', async () => {
  const replies = ['basic: x\nintermediate: Messi equalises 3-2.\ntactical: Lead 3-2.', good, good, good];
  const judge = ['no', 'no'];
  const s = stats();
  const card = await generateCard(m, async (_ids, sys, user) => ({ text: sys.includes('strict reviewer') ? (user.includes('plain words') && judge.shift() ? 'Verdict: no' : 'Verdict: yes') : replies.shift()!, modelId: 'f' }), undefined, s);
  expect(card?.intermediate).toContain('3-2');
  expect(s.retries).toBe(2);
});
it('generateCard gives up after 3 attempts', async () => {
  let why: string[] = [];
  const card = await generateCard(m, async () => ({ text: 'nonsense', modelId: 'f' }), undefined, stats(), w => (why = w));
  expect(card).toBeUndefined();
  expect(why.length).toBeGreaterThan(0);
});
it('cardPrompt carries the canonical definitions and asks for a faithful paraphrase', () => {
  const { system, user } = cardPrompt(m);
  expect(user).toContain('concept_definitions');
  expect(user).toContain(DEFINITIONS.offside);
  expect(user).toContain(DEFINITIONS.goal);
  expect(system).toContain('paraphrase faithfully');
});
it('judge basic question requires consistency with the definition, via a fake converse', async () => {
  expect(judgeBasicPrompt('s', m).user).toContain(`is consistent with this definition: ${DEFINITIONS.goal} ${DEFINITIONS.offside}`);
  const seen: string[] = [];
  await judgeBasic('s', m, async (_ids, _sys, user) => { seen.push(user); return { text: 'Verdict: yes', modelId: 'f' }; });
  expect(seen[0]).toContain('is consistent with this definition');
  expect(seen[0]).toContain('second-last opponent');
});
it('the judge asks Nova Pro first, then Nova 2 Lite', async () => {
  const ids: string[][] = [];
  await judgeFacts('s', m, async (i) => { ids.push(i); return { text: 'Verdict: yes', modelId: 'f' }; });
  expect(ids[0]).toEqual(['us.amazon.nova-pro-v1:0', 'us.amazon.nova-2-lite-v1:0']);
});
