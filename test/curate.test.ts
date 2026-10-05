import { it, expect } from 'vitest';
import { curate } from '../src/data/curate.js';
const ev = (o: any) => ({ id: o.id, minute: o.minute, period: o.period ?? 1, type: { name: o.type }, team: { name: o.team }, player: { name: 'P' }, location: [100, 40], ...o.extra });
const goal = (id: string, minute: number, team: string, period = 1) => ev({ id, minute, team, period, type: 'Shot', extra: { shot: { outcome: { name: 'Goal' }, type: { name: 'Open Play' } } } });
const shot = (id: string, minute: number, team: string) => ev({ id, minute, team, type: 'Shot', extra: { shot: { outcome: { name: 'Off T' }, type: { name: 'Open Play' } } } });
it('computes score and effect', () => {
  const m = curate([goal('a', 10, 'A'), goal('b', 20, 'B'), goal('c', 100, 'A', 3)], []);
  expect(m.map(x => x.effect)).toEqual(['opens the scoring 1-0', 'levels it 1-1', 'puts A ahead 2-1']);
  expect(m[2]!.concepts).toEqual(['goal', 'extra time']);
  expect(m[2]!.scoreBefore).toEqual({ A: 1, B: 1 });
  expect(m[2]!.scoreAfter).toEqual({ A: 2, B: 1 });
  expect(m[2]!.phase).toBe('extra time, first period');
});
it('pulls one back and extends', () => {
  const m = curate([goal('a', 1, 'A'), goal('b', 2, 'A'), goal('c', 3, 'B'), goal('d', 4, 'A')], []);
  expect(m.map(x => x.effect)).toEqual(['opens the scoring 1-0', 'makes it 2-0', 'pulls one back 2-1', 'makes it 3-1']);
});
it('credits an own goal to the other team', () => {
  const og = ev({ id: 'og', minute: 5, team: 'B', type: 'Own Goal Against' });
  const m = curate([goal('x', 1, 'A'), og, goal('z', 30, 'B')], []);
  expect(m.find(x => x.id === 'z')!.scoreBefore).toEqual({ A: 2, B: 0 });
});
it('attaches 360 players to the moment', () => {
  const m = curate([goal('a', 10, 'A')], [{ event_uuid: 'a', freeze_frame: [{ location: [110, 40], teammate: false, actor: false, keeper: true }] }]);
  expect(m[0]!.players).toEqual([{ x: 110, y: 40, teammate: false, actor: false, keeper: true }]);
  expect(m[0]!.ball).toEqual([100, 40]);
});
it('skips the shoot-out', () => expect(curate([goal('s', 121, 'A', 5)], [])).toEqual([]));
it('thins non-goal shots to one per 5 minutes but keeps goals, offsides and cards', () => {
  const off = ev({ id: 'o', minute: 11, team: 'A', type: 'Offside' });
  const card = ev({ id: 'c', minute: 12, team: 'A', type: 'Foul Committed', extra: { foul_committed: { card: { name: 'Yellow Card' } } } });
  const m = curate([shot('s1', 10, 'A'), shot('s2', 11, 'A'), shot('s3', 12, 'A'), off, card, goal('g', 13, 'A'), shot('s4', 16, 'A')], []);
  expect(m.map(x => x.id)).toEqual(['s1', 'o', 'c', 'g', 's4']);
});
it('drops a moment with no concept', () => {
  expect(curate([ev({ id: 'p', minute: 3, team: 'A', type: 'Pass', extra: { pass: {} } })], [])).toEqual([]);
});
import { conceptsFor } from '../src/core/index.js';
const me = (type: string, outcome?: string) => ({ id: 'x', minute: 1, period: 1, team: 'A', type, ...(outcome && { outcome }) });
it('tags shot on goal only for saved shots', () => {
  expect(conceptsFor(me('Shot', 'Saved'))).toEqual(['shot on goal', 'save']);
  for (const o of ['Blocked', 'Off T', 'Wayward', 'Post']) expect(conceptsFor(me('Shot', o))).toEqual(['shot']);
  expect(conceptsFor(me('Shot', 'Goal'))).toEqual(['goal']);
});
it('an assist knows the goal it set up', () => {
  const pass = ev({ id: 'p', minute: 9, team: 'A', type: 'Pass', extra: { pass: { goal_assist: true } } });
  const g = ev({ id: 'g', minute: 10, team: 'A', type: 'Shot', extra: { shot: { outcome: { name: 'Goal' }, type: { name: 'Open Play' }, key_pass_id: 'p' } } });
  const m = curate([pass, g], []);
  expect(m[0]!.setsUp).toEqual({ player: 'P', minute: 10, effect: 'opens the scoring 1-0' });
});
