import type { Direction } from '../theme/direction';

/** Native builds always use direction A; the web build reads ?direction= (see direction.web.ts). */
export function currentDirection(): Direction {
  return 'a';
}

export type ScreenName = 'watching' | 'replay' | 'answer' | 'levelup';

/** Native builds start on Who's watching; the web build can open any screen with ?screen=. */
export function currentScreen(): ScreenName {
  return 'watching';
}
