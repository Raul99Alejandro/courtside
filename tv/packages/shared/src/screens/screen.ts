export type ScreenName = 'watching' | 'replay' | 'answer' | 'levelup';

/** Native builds start on Who's watching; the web build can open any screen with ?screen= (see screen.web.ts). */
export function currentScreen(): ScreenName {
  return 'watching';
}
