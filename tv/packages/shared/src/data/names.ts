const PARTICLES = new Set(['de', 'di', 'da', 'van', 'mac', 'dos', 'del']);

/**
 * "Lionel Andrés Messi Cuccittini" -> "Messi"; "Rodrigo Javier De Paul" -> "De Paul".
 * `hint` is text that already names the player (the card); a name word found there wins.
 */
export function shortName(full?: string, hint?: string): string {
  if (!full) return '';
  const w = full.trim().split(/\s+/);
  if (w.length === 1) return w[0];
  if (hint) {
    const i = w.findIndex((x, k) => k > 0 && x.length > 3 && !PARTICLES.has(x.toLowerCase()) && hint.includes(x));
    if (i > 0) return PARTICLES.has(w[i - 1].toLowerCase()) ? `${w[i - 1]} ${w[i]}` : w[i];
  }
  const last = w[w.length - 1];
  const prev = w[w.length - 2];
  if (PARTICLES.has(prev.toLowerCase())) return `${prev} ${last}`;
  return w.length >= 4 ? prev : last;
}
