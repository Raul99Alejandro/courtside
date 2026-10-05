import { conceptsFor } from '../../src/core/index.js';
import type { Adapter } from './index.js';
// given.event uses the YAML's StatsBomb-like names; map them to MatchEvent.
export const r01: Adapter = (given) => {
  const e = given.event;
  return { concepts: conceptsFor({ id: 'x', minute: 10, period: 1, team: 'A', type: e.type, shotType: e.shot_type, outcome: e.outcome, card: e.card }) };
};
