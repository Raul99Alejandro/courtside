import type { Concept, MatchEvent } from './types.js';

/** R-01: every curated moment teaches at least one concept. */
export function conceptsFor(e: MatchEvent): Concept[] {
  const out: Concept[] = [];
  if (e.shotType === 'Penalty') out.push('penalty kick');
  if (e.type === 'Offside' || e.outcome === 'Pass Offside') out.push('offside');
  if (e.card === 'Yellow Card') out.push('yellow card');
  if (e.card === 'Red Card' || e.card === 'Second Yellow') out.push('red card');
  if (e.type === 'Pass' && e.goalAssist) out.push('assist');
  if (e.type === 'Shot' && e.shotType !== 'Penalty') out.push(e.outcome === 'Goal' ? 'goal' : 'shot on goal');
  if (e.type === 'Shot' && e.outcome === 'Saved') out.push('save');
  if (e.period === 3 || e.period === 4) out.push('extra time');
  if (e.period === 5) out.push('penalty shoot-out');
  return out;
}
