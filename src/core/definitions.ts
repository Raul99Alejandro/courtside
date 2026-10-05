import type { Concept } from './types.js';

/**
 * One canonical plain-English definition per concept (max 25 words each).
 * Simplified for a newcomer, but never contradicting the IFAB Laws of the Game.
 * The explain prompt, the basic-line judge and the TV fallback all read from here.
 */
export const DEFINITIONS: Record<Concept, string> = {
  // Law 14: a penalty kick is awarded for a direct free kick offence by the defending team inside its own penalty area.
  'penalty kick': "A penalty kick is a free shot from the penalty spot, given for a foul inside the defenders' own penalty area.",
  // Law 11: offside position = in the opponents' half and nearer their goal line than both the ball and the second-last opponent; penalised only when involved in active play when the ball is played by a teammate.
  offside: "Offside is being in the opponents' half, nearer their goal than the ball and second-last opponent, when a teammate passes.",
  // Law 12: a caution (yellow card) is for misconduct; a second caution in the same match means a sending off.
  'yellow card': "A yellow card is the referee's official warning to a player for misconduct.",
  // Law 12: a sending off (red card) for serious misconduct; the player may not be replaced.
  'red card': 'A red card means the referee sends a player off, and the team plays with one fewer player.',
  // Not defined in the Laws (a statistic); Law 10 defines the goal it leads to.
  assist: 'An assist is the final pass or touch that sets up a teammate to score a goal.',
  // Law 10 / match statistics: a shot on target is heading into the goal, or is stopped by the goalkeeper.
  'shot on goal': 'A shot on goal is a shot heading into the net, so it either scores or the goalkeeper has to stop it.',
  // Match statistics: an attempt to score, with the foot or head.
  shot: "A shot is an attempt to score by kicking or heading the ball toward the opponents' goal.",
  // Law 10: a goal is scored when the whole of the ball passes over the goal line, between the posts and under the crossbar.
  goal: 'A goal is scored when the whole ball crosses the goal line between the posts.',
  // Law 1/10 context: the goalkeeper stops a shot that was heading into the goal.
  save: 'A save is when the goalkeeper stops a shot that was heading into the goal.',
  // Law 7: extra time is two periods of 15 minutes, played when a knockout match is level after 90 minutes.
  'extra time': 'Extra time is two extra 15-minute periods, played when a knockout match is level after 90 minutes.',
  // IFAB Laws, "Penalties to determine the winner": kicks from the penalty mark, taken in turns; the team that scores more wins.
  'penalty shoot-out': 'A penalty shoot-out decides a level knockout match: teams take turns at penalty kicks, and the team scoring more wins.',
};

export const definitionFor = (c: Concept): string => DEFINITIONS[c];
