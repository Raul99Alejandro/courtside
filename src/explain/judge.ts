import type { Moment } from '../core/index.js';
import { converse as realConverse, LIVE_MODELS, type Converse } from './bedrock.js';
import { judgeBasicPrompt, judgeFactsPrompt, parseJudge } from './prompt.js';

export interface Verdict { ok: boolean; /** The judge call itself failed; counted as ok because the deterministic checks passed. */ error?: true }

/** A single "no" from a short yes/no verdict is noisy, so a "no" is confirmed by a second ask before it counts. */
async function ask(p: { system: string; user: string }, converse: Converse): Promise<Verdict> {
  try {
    for (let i = 0; i < 2; i++) {
      if (parseJudge((await converse(LIVE_MODELS, p.system, p.user, 150)).text)) return { ok: true };
    }
    return { ok: false };
  } catch { return { ok: true, error: true }; }
}

/** Haiku yes/no: does the basic line explain the concepts in plain words? */
export async function judgeBasic(text: string, m: Moment, converse: Converse = realConverse, matchTitle?: string): Promise<Verdict> {
  if (m.concepts.length === 0) return { ok: true };
  return ask(judgeBasicPrompt(text, m, matchTitle), converse);
}

/** Haiku yes/no: does the line use only the facts and invent nothing? Asked for every layer. */
export const judgeFacts = (text: string, m: Moment, converse: Converse = realConverse, matchTitle?: string): Promise<Verdict> =>
  ask(judgeFactsPrompt(text, m, matchTitle), converse);
