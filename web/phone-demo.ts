// Design-review mock states for ?demo=<state>. Never imported in the normal flow.
import type { ViewerInfo } from './api.js';

interface Ctx {
  show: (s: 'join' | 'pick' | 'ask' | 'preperm' | 'blocked') => void;
  say: (s: string, kind?: 'busy' | 'error' | 'ok' | '') => void;
  renderProfiles: (v: ViewerInfo[]) => void;
  setMe: (name: string, level: string) => void;
  showAnswer: (d: { ok?: boolean; answer?: string }, asked?: string) => void;
  showBlocked: (k: 'safari' | 'chrome' | 'other') => void;
}

const VIEWERS: ViewerInfo[] = [
  { name: 'Leo', level: 'beginner' }, { name: 'Ana', level: 'beginner' },
  { name: 'Raul', level: 'expert' }, { name: 'Sofia', level: 'fan' },
];

export function runDemo(state: string, c: Ctx): void {
  (document.getElementById('code') as HTMLInputElement).value = 'XQFSWD';
  switch (state) {
    case 'join': c.show('join'); break;
    case 'pick': c.renderProfiles(VIEWERS); c.say('You are in. Pick yourself, or add yourself below.', 'ok'); break;
    case 'ask': c.renderProfiles(VIEWERS); c.setMe('Sofia', 'fan'); c.show('ask'); break;
    case 'preperm': c.setMe('Sofia', 'fan'); c.show('preperm'); break;
    case 'blocked-safari': c.setMe('Sofia', 'fan'); c.showBlocked('safari'); break;
    case 'blocked-chrome': c.setMe('Sofia', 'fan'); c.showBlocked('chrome'); break;
    case 'answer':
      c.renderProfiles(VIEWERS); c.setMe('Sofia', 'fan'); c.show('ask');
      (document.getElementById('question') as HTMLInputElement).value = 'Why was that offside?';
      c.showAnswer({ ok: true, answer: "Messi was a step past the last France defender when the pass left Di Maria's foot. You are offside if you are closer to the goal line than the second-last defender at that moment, so the flag went up and the goal was disallowed." }, 'Why was that offside?');
      break;
    default: c.show('join');
  }
}
