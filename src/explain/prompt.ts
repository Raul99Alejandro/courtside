import type { Layer, Moment } from '../core/index.js';

export const SYSTEM = `You write explanation cards for a soccer replay app on a TV, watched by a household with mixed experience.
Use only the facts given. Never mention coordinates. Never write World Cup or FIFA; say 'the 2022 final'. Each layer is one sentence.
basic: for someone watching their first match; define every concept_to_teach in plain words, then say what happened in this moment; add no other detail (no durations, rules or consequences that are not in the facts). Aim for 20 words, hard maximum 28 words.
intermediate: for a casual fan; why this moment matters in the match (max 30 words).
tactical: for an expert; the tactical or game-state angle, no clichés (max 35 words).
State the outcome exactly: Saved = the goalkeeper stopped it, Blocked = a defender blocked it, Off T = it went off target, Wayward = it went well off target, Goal = it scored; never invent a different result. Define each concept_to_teach as a general rule; the notes list extra true facts you may use.
When an effect with a score is given, the intermediate and tactical layers must state that score (for example 3-2) and must not say the score is level.
Output exactly three lines: "basic: ...", "intermediate: ...", "tactical: ...".`;

const MISSED = ['Blocked', 'Off T', 'Wayward'];
/** Concepts as taught: a missed or blocked shot is not a 'shot on goal', so it teaches plain 'shot'. */
export const taughtConcepts = (m: Moment): string[] =>
  m.concepts.map(c => (c === 'shot on goal' && m.outcome && MISSED.includes(m.outcome) ? 'shot' : c));

function notes(m: Moment): string[] {
  const n: string[] = [];
  if (m.concepts.includes('assist')) n.push('this pass was the assist: a goal was scored right after it');
  if (m.concepts.includes('penalty kick')) n.push('this shot was a penalty kick taken from the penalty spot');
  if (m.concepts.includes('extra time')) n.push('this moment is in extra time, the 30 extra minutes played because the match was level after 90');
  if (taughtConcepts(m).includes('shot')) n.push('a shot is an attempt to score');
  return n;
}

/** Computed facts only; ball and player coordinates never leave the app. */
export function momentFacts(m: Moment, matchTitle = 'Argentina vs France') {
  return {
    match: `the 2022 final, ${matchTitle}`,
    minute: m.minute,
    phase: m.phase,
    scoreBefore: m.scoreBefore,
    scoreAfter: m.scoreAfter,
    effect: m.effect ?? null,
    team: m.team,
    player: m.player ?? null,
    what: m.what,
    outcome: m.outcome ?? null,
    zone: m.zone ?? null,
    concepts_to_teach: taughtConcepts(m),
    notes: notes(m),
  };
}

export function cardPrompt(m: Moment, matchTitle?: string, problems: string[] = []): { system: string; user: string } {
  let user = JSON.stringify(momentFacts(m, matchTitle));
  if (problems.length) user += `\n\nYour previous attempt had these problems; fix them and output all three lines again:\n- ${problems.join('\n- ')}`;
  return { system: SYSTEM, user };
}

export function parseCard(text: string): Partial<Record<Layer, string>> {
  const out: Partial<Record<Layer, string>> = {};
  for (const line of text.split(/\r?\n/)) {
    const mt = line.match(/^\s*\W*(basic|intermediate|tactical)\W*\s*:\s*(.+?)\s*$/i);
    if (mt) out[mt[1]!.toLowerCase() as Layer] = mt[2]!.replace(/^\*+|\*+$/g, '').trim();
  }
  return out;
}

/** R-05 LLM check: does the basic line explain the concepts using only the facts? */
export function judgePrompt(text: string, m: Moment, matchTitle?: string): { system: string; user: string } {
  return {
    system: 'You are a strict reviewer. Answer with exactly one word: yes or no. Default to yes. Say no only if (a) a named concept is not defined at all or is defined wrongly or in jargon, or (b) the sentence states a fact about this moment that is absent from or contradicts the facts. Do not judge whether the moment itself counts as the concept: the concepts are teaching topics for this moment, so a missed shot or a pass without a goal may still be used to explain them; do not penalise a general definition of the concept (a general definition need not match the score), and the notes are true facts.',
    user: `Does this sentence explain ${taughtConcepts(m).join(' and ')} in plain words for a first-time viewer, using only these facts: ${JSON.stringify(momentFacts(m, matchTitle))}? Answer yes or no.\n\nSentence: ${text}`,
  };
}

export const parseJudge = (text: string): boolean => /^\W*yes\b/i.test(text.trim());
