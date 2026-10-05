import type { Direction } from '../theme/direction';

export function currentDirection(): Direction {
  if (typeof window === 'undefined') return 'a';
  const d = new URLSearchParams(window.location.search).get('direction');
  return d === 'b' || d === 'c' ? d : 'a';
}

export type ScreenName = 'watching' | 'replay' | 'answer' | 'levelup';

export function currentScreen(): ScreenName {
  if (typeof window === 'undefined') return 'watching';
  const s = new URLSearchParams(window.location.search).get('screen');
  return s === 'replay' || s === 'answer' || s === 'levelup' ? s : 'watching';
}
