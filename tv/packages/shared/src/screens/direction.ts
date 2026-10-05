import type { Direction } from '../theme/direction';

/** Native builds always use direction A; the web build reads ?direction= (see direction.web.ts). */
export function currentDirection(): Direction {
  return 'a';
}
