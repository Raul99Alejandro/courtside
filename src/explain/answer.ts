import { checkCard, type Layer, type Moment } from '../core/index.js';
import { converse as realConverse, LIVE_MODELS, type Converse } from './bedrock.js';
import { momentFacts } from './prompt.js';

export const FALLBACK_ANSWER = "I couldn't answer that right now - try again in a moment.";

const STYLE: Record<Layer, string> = {
  basic: 'The viewer is watching their first match: plain words, define any term, no jargon.',
  intermediate: 'The viewer is a casual fan: clear and brief, light football vocabulary is fine.',
  tactical: 'The viewer is an expert: precise and tactical, no basics.',
};

export const RETRY_MIN_MS = 2500;

/** Reason codes only, never text: safe to log. */
export function reasonCode(problem: string): string {
  if (problem === 'empty') return 'empty';
  if (problem.startsWith('too long')) return 'too_long';
  if (problem.startsWith('mentions coordinates')) return 'coordinates';
  if (problem.startsWith('contains an em dash')) return 'em_dash';
  if (problem.startsWith('contains a word count')) return 'word_count';
  if (problem.startsWith('banned term')) return 'banned_term';
  if (problem.startsWith('says "game"')) return 'says_game';
  return 'other';
}

export async function answerQuestion(
  input: { question: string; layer: Layer; moment?: Moment; viewerName: string; /** epoch ms; no retry unless at least RETRY_MIN_MS remain */ deadlineAt?: number },
  deps: { converse: Converse } = { converse: realConverse },
): Promise<string> {
  const system = `You answer a soccer question spoken aloud on a TV to ${input.viewerName}. ${STYLE[input.layer]} Answer in at most 2 short sentences (under 45 words). Never mention coordinates. Never write World Cup or FIFA; say 'the 2022 final'. If the current moment is given, use only its facts for anything about it. Never use the em dash character; use commas or full stops.${input.layer === 'basic' ? " Never write 'game'; say 'match'." : ''}`;
  const user = (input.moment ? `Current moment: ${JSON.stringify(momentFacts(input.moment))}

` : '') + `Question: ${input.question}`;
  let prompt = user;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let problems: string[];
    try {
      const r = await deps.converse(LIVE_MODELS, system, prompt, 200);
      let text = r.text.replace(/\s*—\s*/g, ', ').trim();
      // The card check rejects "game" in basic lines and the model says it often: fix the word instead of discarding the answer.
      if (input.layer === 'basic') text = text.replace(/\bgame(s?)\b/gi, (w, s: string) => (w[0] === 'G' ? 'M' : 'm') + (s ? 'atches' : 'atch'));
      problems = text ? checkCard(text, input.layer, {}).filter(p => !p.startsWith('too long')) : ['empty'];
      if (problems.length === 0) return text;
    } catch {
      return FALLBACK_ANSWER;
    }
    console.log(JSON.stringify({ event: 'answer_rejected', reasons: [...new Set(problems.map(reasonCode))], attempt }));
    if (attempt === 2 || (input.deadlineAt !== undefined && input.deadlineAt - Date.now() < RETRY_MIN_MS)) break;
    prompt = `${user}

Your previous answer was rejected for these problems, fix them: ${problems.join('; ')}`;
  }
  return FALLBACK_ANSWER;
}
