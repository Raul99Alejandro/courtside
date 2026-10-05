import { checkCard, type Layer, type Moment } from '../core/index.js';
import { converse as realConverse, LIVE_MODELS, type Converse } from './bedrock.js';
import { momentFacts } from './prompt.js';

export const FALLBACK_ANSWER = "I couldn't answer that right now - try again in a moment.";

const STYLE: Record<Layer, string> = {
  basic: 'The viewer is watching their first match: plain words, define any term, no jargon.',
  intermediate: 'The viewer is a casual fan: clear and brief, light football vocabulary is fine.',
  tactical: 'The viewer is an expert: precise and tactical, no basics.',
};

export async function answerQuestion(
  input: { question: string; layer: Layer; moment?: Moment; viewerName: string },
  deps: { converse: Converse } = { converse: realConverse },
): Promise<string> {
  const system = `You answer a soccer question spoken aloud on a TV to ${input.viewerName}. ${STYLE[input.layer]} Answer in at most 2 short sentences (under 45 words). Never mention coordinates. Never write World Cup or FIFA; say 'the 2022 final'. If the current moment is given, use only its facts for anything about it. Never use the em dash character; use commas or full stops.`;
  const user = (input.moment ? `Current moment: ${JSON.stringify(momentFacts(input.moment))}\n\n` : '') + `Question: ${input.question}`;
  try {
    const r = await deps.converse(LIVE_MODELS, system, user, 200);
    const text = r.text.replace(/\s*—\s*/g, ', ').trim();
    return text && checkCard(text, input.layer, {}).filter(p => !p.startsWith('too long')).length === 0 ? text : FALLBACK_ANSWER;
  } catch {
    return FALLBACK_ANSWER;
  }
}
