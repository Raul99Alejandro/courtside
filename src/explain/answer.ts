import { checkCard, DEFINITIONS, type Concept, type Layer, type Moment } from '../core/index.js';
import { converse as realConverse, type Converse } from './bedrock.js';
import { liveModels } from './models.js';
import { MATCH_TITLE } from './moments.js';
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

/** Canonical definitions for the moment's concepts, or all of them when the moment has none (a rule question with nothing on screen). */
export function definitionsFor(moment?: Moment): string {
  const concepts = (moment?.concepts?.length ? moment.concepts : Object.keys(DEFINITIONS)) as Concept[];
  return concepts.map(c => DEFINITIONS[c]).join(' ');
}

export const NO_MOMENT_REPLY = 'Start the replay on the TV and ask again, so I can see which moment you mean.';

/** Questions that point at a play or match situation ("that", "the score", a team) and so need a moment on screen. */
const SITUATIONAL = /\b(that|this|those|these|there|here|now|just|the score|score|scored|leading|losing|winning|trailing|behind|ahead|why (was|did|were|is)|was (it|that|he|she)|argentina|france|argentinian|french|messi|mbapp\w*|di maria|giroud|griezmann|dybala|lloris|martinez|minute|half)\b/i;

/** Concepts a question names, most specific first. */
const CONCEPT_WORDS: [Concept, RegExp][] = [
  ['penalty shoot-out', /shoot-?\s?out/i],
  ['penalty kick', /\bpenalt(y|ies)\b/i],
  ['offside', /\boff-?side\b/i],
  ['yellow card', /\byellow\b/i],
  ['red card', /\b(red card|sent off|sending off)\b/i],
  ['assist', /\bassists?\b/i],
  ['shot on goal', /\bon (goal|target)\b/i],
  ['extra time', /\bextra[- ]time\b/i],
  ['save', /\bsaves?\b/i],
  ['shot', /\bshots?\b/i],
  ['goal', /\bgoals?\b/i],
];
export const conceptsNamed = (q: string): Concept[] => CONCEPT_WORDS.filter(([, re]) => re.test(q)).map(([c]) => c);

/** Current score and who leads or trails, from the moment's computed facts only. */
export function scoreFacts(m: Moment): string {
  const [a, b] = Object.keys({ ...m.scoreBefore, ...m.scoreAfter });
  if (!a || !b) return '';
  const sa = m.scoreAfter[a] ?? 0, sb = m.scoreAfter[b] ?? 0;
  const state = sa === sb ? `the match is level` : `${sa > sb ? a : b} is leading and ${sa > sb ? b : a} is trailing`;
  return `Score in minute ${m.minute}, after this moment: ${a} ${sa}, ${b} ${sb}; ${state}. Before this moment it was ${a} ${m.scoreBefore[a] ?? 0}, ${b} ${m.scoreBefore[b] ?? 0}.`;
}

export async function answerQuestion(
  input: { question: string; layer: Layer; moment?: Moment; viewerName: string; /** epoch ms; no retry unless at least RETRY_MIN_MS remain */ deadlineAt?: number },
  deps: { converse: Converse } = { converse: realConverse },
): Promise<string> {
  const situational = SITUATIONAL.test(input.question);
  const named = conceptsNamed(input.question);
  if (!input.moment && situational && named.length === 0) return NO_MOMENT_REPLY;
  const ruleOnly = !input.moment && situational;
  const system = `You answer a soccer question spoken aloud on a TV to ${input.viewerName}. ${STYLE[input.layer]} Answer in at most 2 short sentences (under 45 words). Never mention coordinates. Never write World Cup or FIFA; say 'the 2022 final'. ${ruleOnly ? 'No match moment is on screen: give only the general rule, and say nothing about any specific play, player, team, score or minute. ' : input.moment ? `Use only the current moment's facts for anything about the match. ${scoreFacts(input.moment)} Make no claim about any other moment, earlier or later, and never invent a score, a minute or who was winning. ` : ''} Never use the em dash character; use commas or full stops. Answer the question directly first, then explain the idea. Canonical definitions, never contradict them: ${ruleOnly ? named.map(c => DEFINITIONS[c]).join(' ') : definitionsFor(input.moment)}${input.layer === 'basic' ? " Never write 'game'; say 'match'." : ''}`;
  const user = (input.moment ? `Current moment: ${JSON.stringify(momentFacts(input.moment, MATCH_TITLE))}
${scoreFacts(input.moment)}

` : '') + `Question: ${input.question}`;
  let prompt = user;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let problems: string[];
    try {
      const r = await deps.converse(liveModels(), system, prompt, 200);
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
