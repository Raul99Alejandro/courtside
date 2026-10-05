import type { Moment } from '@courtside/core';
import { shortName } from './names';

/** The player's usual short name, using the card text as a hint. */
export function momentName(m: Moment, card?: Record<string, string>): string {
  return shortName(m.player, card ? Object.values(card).join(' ') : undefined) || m.team;
}

/** Short plain-English title for a moment, e.g. "Messi scores". */
export function momentTitle(m: Moment, card?: Record<string, string>): string {
  const who = momentName(m, card);
  if (m.outcome === 'Goal') return `${who} scores`;
  switch (m.what) {
    case 'Shot':
      return `${who} shoots`;
    case 'Pass':
      return m.outcome === 'Pass Offside' ? `${who} is caught offside` : `${who} passes`;
    case 'Offside':
      return `${who} is offside`;
    case 'Foul Committed':
      return `Foul by ${who}`;
    default:
      return `${who}, ${m.what.toLowerCase()}`;
  }
}

/** The line that follows the title: the effect when there is one. */
export function momentDetail(m: Moment): string {
  return m.effect ?? m.outcome ?? m.phase;
}

/** "Leo", "Leo and Ana", "Leo, Ana and Raul". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
