import { conceptsFor } from '../core/index.js';
import type { MatchEvent, Moment } from '../core/index.js';

/** Loose shape of a StatsBomb event (only the fields we read). */
export interface RawEvent {
  id: string; minute: number; period: number;
  type: { name: string }; team: { name: string }; player?: { name: string };
  location?: [number, number];
  shot?: { outcome?: { name: string }; type?: { name: string } };
  pass?: { outcome?: { name: string }; goal_assist?: boolean };
  foul_committed?: { card?: { name: string } };
}
export interface RawFrame {
  event_uuid: string;
  freeze_frame?: { location: [number, number]; teammate: boolean; actor: boolean; keeper: boolean }[];
}

// StatsBomb pitch is 120x80 and every team attacks left to right in its own events.
export function zone([x, y]: [number, number]): string {
  const third = x >= 102 && y >= 18 && y <= 62 ? "inside the opponent's penalty area" : x >= 80 ? 'in the attacking third' : x >= 40 ? 'in midfield' : 'in its own half';
  const lane = y < 26.7 ? 'left side' : y > 53.3 ? 'right side' : 'centre';
  return `${third}, ${lane} (from the attacking team's view)`;
}

const PHASES: Record<number, string> = { 1: 'first half', 2: 'second half', 3: 'extra time, first period', 4: 'extra time, second period' };

export function toMatchEvent(e: RawEvent): MatchEvent {
  const outcome = e.shot?.outcome?.name ?? e.pass?.outcome?.name;
  return {
    id: e.id, type: e.type.name, minute: e.minute, period: e.period, team: e.team.name,
    ...(e.player && { player: e.player.name }),
    ...(e.shot?.type && { shotType: e.shot.type.name }),
    ...(outcome && { outcome }),
    ...(e.foul_committed?.card && { card: e.foul_committed.card.name }),
    ...(e.pass?.goal_assist && { goalAssist: true }),
    ...(e.location && { location: e.location }),
  };
}

const isKey = (e: RawEvent) => e.type.name === 'Shot' || e.type.name === 'Offside' ||
  (e.type.name === 'Pass' && (e.pass?.outcome?.name === 'Pass Offside' || e.pass?.goal_assist === true)) ||
  (e.type.name === 'Foul Committed' && !!e.foul_committed?.card);

/** Scores are written leader-first ("a-a" when level). */
function effectOf(team: string, before: Record<string, number>, after: Record<string, number>): string {
  const mine = after[team] ?? 0;
  const other = Object.entries(after).filter(([t]) => t !== team).reduce((n, [, v]) => n + v, 0);
  const prevMine = before[team] ?? 0;
  const score = `${Math.max(mine, other)}-${Math.min(mine, other)}`;
  if (prevMine === 0 && other === 0) return `opens the scoring ${score}`;
  if (mine === other) return `levels it ${score}`;
  if (prevMine === other) return `puts ${team} ahead ${score}`;
  if (mine < other) return `pulls one back ${score}`;
  return `makes it ${score}`;
}

/** Pure curation: raw StatsBomb events + 360 frames to teachable moments (R-01). */
export function curate(events: RawEvent[], frames: RawFrame[]): Moment[] {
  const teams = [...new Set(events.map(e => e.team.name))];
  const frameById = new Map(frames.map(f => [f.event_uuid, f]));
  const score: Record<string, number> = Object.fromEntries(teams.map(t => [t, 0]));
  const out: Moment[] = [];
  const shotBuckets = new Set<number>();
  for (const e of events) {
    if (e.period > 4) continue;
    const before = { ...score };
    const isGoal = e.type.name === 'Shot' && e.shot?.outcome?.name === 'Goal';
    if (isGoal) score[e.team.name] = (score[e.team.name] ?? 0) + 1;
    if (e.type.name === 'Own Goal Against') {
      const other = teams.find(t => t !== e.team.name);
      if (other) score[other] = (score[other] ?? 0) + 1;
    }
    if (!isKey(e)) continue;
    const me = toMatchEvent(e);
    const concepts = conceptsFor(me);
    if (concepts.length === 0) continue;
    if (e.type.name === 'Shot' && !isGoal && e.shot?.type?.name !== 'Penalty') {
      const bucket = Math.floor(e.minute / 5);
      if (shotBuckets.has(bucket)) continue;
      shotBuckets.add(bucket);
    }
    const after = { ...score };
    const outcome = me.outcome ?? me.card;
    const players = frameById.get(e.id)?.freeze_frame?.map(p => ({ x: p.location[0], y: p.location[1], teammate: p.teammate, actor: p.actor, keeper: p.keeper }));
    out.push({
      id: e.id, minute: e.minute, phase: PHASES[e.period] ?? 'extra time', team: e.team.name,
      ...(e.player && { player: e.player.name }),
      what: e.type.name,
      ...(outcome && { outcome }),
      concepts, scoreBefore: before, scoreAfter: after,
      ...(isGoal && { effect: effectOf(e.team.name, before, after) }),
      ...(e.location && { zone: zone(e.location), ball: e.location }),
      ...(players && { players }),
    });
  }
  return out;
}
