import { it, expect } from 'vitest';
import { computeTactics } from '../src/data/tactics.js';
import { curate } from '../src/data/curate.js';
import { momentFacts, cardPrompt, judgeFactsPrompt } from '../src/explain/prompt.js';

const base = { period: 2, minute: 80, team: 'A', scoreBefore: { A: 1, B: 1 } };
const P = (x: number, y: number, o: Partial<{ teammate: boolean; actor: boolean; keeper: boolean }> = {}) => ({ x, y, teammate: false, actor: false, keeper: false, ...o });

it('minutes left per period, stoppage is zero', () => {
  expect(computeTactics({ ...base, period: 1, minute: 30 }).minutesLeft).toBe(15);
  expect(computeTactics({ ...base, period: 2, minute: 80 }).minutesLeft).toBe(10);
  expect(computeTactics({ ...base, period: 2, minute: 94 }).minutesLeft).toBe(0);
  expect(computeTactics({ ...base, period: 3, minute: 100 }).minutesLeft).toBe(5);
  expect(computeTactics({ ...base, period: 4, minute: 118 }).minutesLeft).toBe(2);
});
it('game state for the moment team', () => {
  expect(computeTactics({ ...base, scoreBefore: { A: 2, B: 1 } }).gameState).toBe('protecting a lead');
  expect(computeTactics({ ...base, scoreBefore: { A: 0, B: 1 } }).gameState).toBe('chasing the game');
  expect(computeTactics({ ...base, scoreBefore: { A: 0, B: 0 } }).gameState).toBe('level');
});
it('no frame means no spatial facts', () => {
  const t = computeTactics(base);
  expect(t.defendersBetween).toBeUndefined();
  expect(t.distanceToGoal).toBeUndefined();
});
it('computes spatial facts from a hand-written frame', () => {
  const t = computeTactics({
    ...base, ball: [108, 40],
    players: [
      P(116, 40, { keeper: true }),          // keeper: not counted as a defender
      P(115, 40),                            // between, in the cone
      P(113, 30),                            // behind the ball but outside the cone
      P(100, 40),                            // level with ball side: x < ball, not between
      P(110, 40.3),                         // within 5 of the ball and between
      P(108, 40, { teammate: true, actor: true }),
      P(105, 30, { teammate: true }),        // in box
      P(95, 40, { teammate: true }),         // outside box
    ],
  });
  expect(t.defendersBetween).toBe(2);
  expect(t.attackersInBox).toBe(2);
  expect(t.distanceToGoal).toBe(12);
  expect(t.pressure).toBe(1);
  expect(t.keeperOffLine).toBeUndefined();
});
it('flags a keeper far off the line', () => {
  const t = computeTactics({ ...base, ball: [90, 40], players: [P(112, 40, { keeper: true })] });
  expect(t.keeperOffLine).toBe(true);
  expect(t.defendersBetween).toBe(0);
});
it('curate adds tactics and the prompt passes them', () => {
  const ev = { id: 'a', minute: 80, period: 2, type: { name: 'Shot' }, team: { name: 'A' }, player: { name: 'P' }, location: [108, 40] as [number, number], shot: { outcome: { name: 'Goal' }, type: { name: 'Open Play' } } };
  const m = curate([ev], [{ event_uuid: 'a', freeze_frame: [{ location: [115, 40], teammate: false, actor: false, keeper: false }] }])[0]!;
  expect(m.tactics).toMatchObject({ minutesLeft: 10, gameState: 'level', defendersBetween: 1, distanceToGoal: 12 });
  const f = momentFacts(m) as any;
  expect(f.computed_tactical_facts.distanceToGoalYards).toBe(12);
  expect(JSON.stringify(f)).not.toMatch(/\[\d/);
  expect(cardPrompt(m).system).toContain('computed_tactical_facts');
  expect(judgeFactsPrompt('s', m).system).toContain('computed_tactical_facts');
});
