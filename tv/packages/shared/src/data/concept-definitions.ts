import type { Concept } from '@courtside/core';

/** Static basic definitions, shown when a moment has no generated card. No AI involved. */
export const CONCEPT_DEFINITIONS: Record<Concept, string> = {
  'penalty kick': 'A penalty kick is a free shot at goal, one-on-one with the goalkeeper.',
  offside: 'Offside means a player is too far ahead when the ball is played to them.',
  'yellow card': 'A yellow card is a warning from the referee for a foul.',
  'red card': 'A red card sends a player off the pitch for the rest of the match.',
  assist: 'An assist is the last pass before a goal.',
  'shot on goal': 'A shot on goal is a shot heading toward the net.',
  shot: 'A shot is an attempt to score.',
  goal: 'A goal means the ball goes into the net.',
  'extra time': 'Extra time is 30 extra minutes played when teams are level.',
  'penalty shoot-out': 'A penalty shoot-out decides the match with kicks from the penalty spot.',
  save: 'A save means the goalkeeper stops the ball.',
};
