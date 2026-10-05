export type ScreenName = 'watching' | 'replay' | 'answer' | 'levelup';

export function currentScreen(): ScreenName {
  if (typeof window === 'undefined') return 'watching';
  const s = new URLSearchParams(window.location.search).get('screen');
  return s === 'replay' || s === 'answer' || s === 'levelup' ? s : 'watching';
}

/** ?demo or ?screen= keeps the mock household and match data for screenshots and the visual checks. */
export function isDemo(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  return q.has('demo') || q.has('screen');
}
