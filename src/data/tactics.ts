import type { Tactics } from '../core/index.js';

export interface TacticsInput {
  period: number; minute: number; team: string;
  scoreBefore: Record<string, number>;
  ball?: [number, number];
  players?: { x: number; y: number; teammate: boolean; actor: boolean; keeper: boolean }[];
}

const PERIOD_END: Record<number, number> = { 1: 45, 2: 90, 3: 105, 4: 120 };
const GOAL_X = 120, POST_LO = 36, POST_HI = 44;
const cross = (ax: number, ay: number, bx: number, by: number, px: number, py: number) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);

/** Is (px,py) inside the triangle ball, near post, far post (the goal-facing cone)? */
function inCone(bx: number, by: number, px: number, py: number): boolean {
  const d1 = cross(bx, by, GOAL_X, POST_LO, px, py), d2 = cross(GOAL_X, POST_LO, GOAL_X, POST_HI, px, py), d3 = cross(GOAL_X, POST_HI, bx, by, px, py);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/** Pure: facts computed from the event and its 360 frame (120x80 pitch, the team attacks left to right). */
export function computeTactics(i: TacticsInput): Tactics {
  const mine = i.scoreBefore[i.team] ?? 0;
  const other = Object.entries(i.scoreBefore).filter(([t]) => t !== i.team).reduce((n, [, v]) => n + v, 0);
  const t: Tactics = {
    minutesLeft: Math.max(0, (PERIOD_END[i.period] ?? 120) - i.minute),
    gameState: mine > other ? 'protecting a lead' : mine < other ? 'chasing the game' : 'level',
  };
  if (!i.ball || !i.players) return t;
  const [bx, by] = i.ball;
  const opp = i.players.filter(p => !p.teammate);
  t.distanceToGoal = Math.round(Math.hypot(GOAL_X - bx, 40 - by));
  t.defendersBetween = opp.filter(p => !p.keeper && p.x > bx && inCone(bx, by, p.x, p.y)).length;
  t.attackersInBox = i.players.filter(p => p.teammate && !p.keeper && p.x >= 102 && p.y >= 18 && p.y <= 62).length;
  t.pressure = opp.filter(p => !p.keeper && Math.hypot(p.x - bx, p.y - by) <= 5).length;
  const keeper = opp.find(p => p.keeper);
  if (keeper && GOAL_X - keeper.x > 6) t.keeperOffLine = true;
  return t;
}
