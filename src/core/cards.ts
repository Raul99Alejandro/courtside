import type { Layer, Moment } from './types.js';

export const MAX_WORDS: Record<Layer, number> = { basic: 28, intermediate: 30, tactical: 35 };
export const BANNED_TERMS = ['World Cup', 'FIFA'];
/** Any square bracket means a coordinate pair leaked into the text. */
export const FORBIDDEN_MARKERS = ['['];
/** Words that say the score is level; wrong when the effect puts a team ahead. */
export const LEVEL_WORDS = ['ties', 'levels', 'equalises', 'equalizes'];

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BANNED = BANNED_TERMS.map(t => new RegExp(`\\b${escapeRe(t).replace(/ /g, '\\s*')}\\b`, 'i'));
const LEVEL = new RegExp(`\\b(${LEVEL_WORDS.join('|')})\\b`, 'i');
/** Words that are wrong for soccer: goals are not points, and no American-football terms. */
export const SOCCER_BANNED: { re: RegExp; why: string }[] = [
  { re: /\b(points?)\b/i, why: 'says "point"; goals are goals, not points' },
  { re: /\b(touchdowns?|quarterbacks?|field goals?|end zone|first down)\b/i, why: 'uses an American-football term' },
];
const GAME_WORD = /\bgames?\b/i;
const COORDS = /\(\s*\d+(\.\d+)?\s*,\s*\d/;

/** The score named in an effect such as "puts Argentina ahead 3-2", or undefined. */
export const scoreInEffect = (effect?: string): string | undefined => effect?.match(/\d+-\d+/)?.[0];

/** True when the text defines the concept: the concept word followed by ':' or ' means ' or ' is '. */
export function definesConcept(text: string, concept: string): boolean {
  return new RegExp(`\\b${escapeRe(concept)}\\s*(:|means\\b|is\\b)`, 'i').test(text);
}

/** R-05 deterministic checks. Returns a list of problems; empty means the card passes. */
export function checkCard(text: string, layer: Layer, m: Partial<Pick<Moment, 'effect' | 'scoreAfter'>>): string[] {
  const problems: string[] = [];
  const t = text.trim();
  if (!t) return ['empty'];
  const words = t.split(/\s+/).length;
  if (words > MAX_WORDS[layer]) problems.push(`too long: ${words} > ${MAX_WORDS[layer]}`);
  if (COORDS.test(t) || FORBIDDEN_MARKERS.some(x => t.includes(x))) problems.push('mentions coordinates');
  if (t.includes('—')) problems.push('contains an em dash; use a comma or a full stop');
  if (/\(\d+\s*words?\)/i.test(t)) problems.push('contains a word count; do not append word counts');
  for (const b of BANNED) if (b.test(t)) problems.push(`banned term ${b}`);
  for (const b of SOCCER_BANNED) if (b.re.test(t)) problems.push(b.why);
  if (layer === 'basic' && GAME_WORD.test(t)) problems.push('says "game"; say "match" in basic lines');
  if (layer === 'tactical') {
    // a score such as 3-2 counts as one number, and a year such as 2022 is not a stat
    const nums = t.replace(/\d+\s*[-\u2013]\s*\d+/g, '1').replace(/\b(19|20)\d\d\b/g, '').match(/\d+(\.\d+)?/g)?.length ?? 0;
    if (nums > 2) problems.push(`tactical line has ${nums} numbers including the minute; use at most two in total and put the rest in words`);
  }
  const score = scoreInEffect(m.effect);
  if (score && layer !== 'basic') {
    const [a, b] = score.split('-');
    if (!new RegExp(`${a}\\s*[-–]\\s*${b}`).test(t)) problems.push(`missing score ${score}`);
  }
  if (m.effect?.startsWith('puts') && LEVEL.test(t)) problems.push('contradicts effect: says level');
  return problems;
}
