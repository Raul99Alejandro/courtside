import { it, expect } from 'vitest';
import { cardPrompt, parseCard, judgePrompt, parseJudge } from '../src/explain/prompt.js';
import { judgeBasic } from '../src/explain/judge.js';
import { generateCard, type Stats } from '../src/explain/generate.js';
import type { Moment } from '../src/core/index.js';

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
it('cardPrompt appends problems on retry', () => expect(cardPrompt(m, undefined, ['basic: too long']).user).toContain('basic: too long'));
it('parseCard reads three lines', () => {
  expect(parseCard('basic: a\nintermediate: b\ntactical: c')).toEqual({ basic: 'a', intermediate: 'b', tactical: 'c' });
  expect(parseCard('**basic:** a')).toEqual({ basic: 'a' });
});
it('judge parsing', async () => {
  expect(parseJudge('Yes.')).toBe(true);
  expect(parseJudge('no')).toBe(false);
  expect(parseJudge('No, it does not')).toBe(false);
  expect(judgePrompt('s', m).user).toContain('goal and offside');
  expect(await judgeBasic('s', m, async () => ({ text: 'yes', modelId: 'f' }))).toBe(true);
  expect(await judgeBasic('s', m, async () => ({ text: 'No', modelId: 'f' }))).toBe(false);
});
const good = 'basic: Offside means an attacker is nearer the goal than the ball and the last two defenders when passed to.\nintermediate: Messi scores in extra time and puts Argentina ahead 3-2.\ntactical: Argentina lead 3-2 after pressing high and winning the second ball.';
const stats = (): Stats => ({ calls: 0, retries: 0, inputTokens: 0, outputTokens: 0 });
it('generateCard retries on a failed check, then a no judge, then succeeds', async () => {
  const replies = ['basic: x\nintermediate: Messi equalises 3-2.\ntactical: Lead 3-2.', good, good, good];
  const judge = ['no', 'yes'];
  const s = stats();
  const card = await generateCard(m, async (_ids, sys) => ({ text: sys.includes('strict reviewer') ? judge.shift()! : replies.shift()!, modelId: 'f' }), undefined, s);
  expect(card?.intermediate).toContain('3-2');
  expect(s.retries).toBe(2);
});
it('generateCard gives up after 3 attempts', async () => {
  let why: string[] = [];
  const card = await generateCard(m, async () => ({ text: 'nonsense', modelId: 'f' }), undefined, stats(), w => (why = w));
  expect(card).toBeUndefined();
  expect(why.length).toBeGreaterThan(0);
});
