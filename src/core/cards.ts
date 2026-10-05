import type { Layer, Moment } from './types.js';

export const MAX_WORDS: Record<Layer, number> = { basic: 28, intermediate: 30, tactical: 35 };
export const BANNED_TERMS = ['World Cup', 'FIFA'];
/** Any square bracket means a coordinate pair leaked into the text. */
export const FORBIDDEN_MARKERS = ['['];
/** Words that say the score is level; wrong when the effect puts a team ahead. */
export const LEVEL_WORDS = ['ties', 'levels'];

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BANNED = BANNED_TERMS.map(t => new RegExp(`\\b${escapeRe(t).replace(/ /g, '\\s*')}\\b`, 'i'));
const LEVEL = new RegExp(`\\b(${LEVEL_WORDS.join('|')})\\b`, 'i');
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
  for (const b of BANNED) if (b.test(t)) problems.push(`banned term ${b}`);
  const score = scoreInEffect(m.effect);
  if (score && layer !== 'basic') {
    const [a, b] = score.split('-');
    if (!new RegExp(`${a}\\s*[-–]\\s*${b}`).test(t)) problems.push(`missing score ${score}`);
  }
  if (m.effect?.startsWith('puts') && LEVEL.test(t)) problems.push('contradicts effect: says level');
  return problems;
}
