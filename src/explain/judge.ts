import type { Moment } from '../core/index.js';
import { converse as realConverse, LIVE_MODELS, type Converse } from './bedrock.js';
import { judgePrompt, parseJudge } from './prompt.js';

/** True when Haiku says the basic line explains the concepts from the facts. A failed call counts as yes (the deterministic checks already passed). */
export async function judgeBasic(text: string, m: Moment, converse: Converse = realConverse, matchTitle?: string): Promise<boolean> {
  if (m.concepts.length === 0) return true;
  const p = judgePrompt(text, m, matchTitle);
  try {
    return parseJudge((await converse(LIVE_MODELS, p.system, p.user, 10)).text);
  } catch { return true; }
}
