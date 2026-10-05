import type { Layer, Moment } from './types.js';

export const MAX_WORDS: Record<Layer, number> = { basic: 28, intermediate: 30, tactical: 35 };
const BANNED = [/world\s*cup/i, /\bfifa\b/i];
const COORDS = /\[\s*\d|\(\s*\d+(\.\d+)?\s*,\s*\d/;

/** R-05 deterministic checks. Returns a list of problems; empty means the card passes. */
export function checkCard(text: string, layer: Layer, m: Partial<Pick<Moment, 'effect' | 'scoreAfter'>>): string[] {
  const problems: string[] = [];
  const t = text.trim();
  if (!t) return ['empty'];
  const words = t.split(/\s+/).length;
  if (words > MAX_WORDS[layer]) problems.push(`too long: ${words} > ${MAX_WORDS[layer]}`);
  if (COORDS.test(t)) problems.push('mentions coordinates');
  for (const b of BANNED) if (b.test(t)) problems.push(`banned term ${b}`);
  const score = m.effect?.match(/(\d+)-(\d+)/);
  if (score && layer !== 'basic' && !new RegExp(`${score[1]}\s*[-–]\s*${score[2]}`).test(t)) problems.push(`missing score ${score[0]}`);
  if (m.effect?.startsWith('puts') && /\b(ties|levels|equali[sz]es)\b/i.test(t)) problems.push('contradicts effect: says level');
  return problems;
}
