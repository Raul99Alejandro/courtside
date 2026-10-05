import type { Direction } from '../theme/direction';

export function currentDirection(): Direction {
  if (typeof window === 'undefined') return 'a';
  const d = new URLSearchParams(window.location.search).get('direction');
  return d === 'b' || d === 'c' ? d : 'a';
}
