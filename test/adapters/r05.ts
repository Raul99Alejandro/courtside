import { checkCard } from '../../src/core/index.js';
import type { Adapter } from './index.js';
// Sample outputs the checks must accept (approved) or reject (rejected example R-05-c).
const GOOD: Record<string, string> = {
  intermediate: 'Messi scores again in extra time and puts Argentina ahead 3-2 with thirteen minutes left.',
  basic: 'Offside: an attacker cannot receive a pass while nearer the goal than the ball and the second-to-last defender.',
};
export const r05: Adapter = (g, w) => {
  if (w.generate === 'basic' && g.moment.concepts?.[0] === 'penalty kick') {
    const text = 'Messi scored a penalty kick from the spot, located at [108,40].';
    return checkCard(text, 'basic', {}).length === 0 ? { text } : { rejected: true };
  }
  const text = GOOD[w.generate]!;
  const problems = checkCard(text, w.generate, { effect: g.moment.effect });
  if (problems.length) return { problems };
  return w.generate === 'basic'
    ? { defines: 'offside', max_words: 28, must_not_mention: ['World Cup', 'FIFA', '['] }
    : { must_mention: '3-2', must_not_mention: ['ties', 'levels'] };
};
