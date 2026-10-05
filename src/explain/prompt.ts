import type { Layer, Moment } from '../core/index.js';

export const SYSTEM = `You write explanation cards for a soccer replay app on a TV, watched by a household with mixed experience.
Use only the facts given. Never mention coordinates. Never write World Cup or FIFA; say 'the 2022 final'. Each layer is one sentence.
basic: for someone watching their first match; define every concept_to_teach in plain words, then say what happened in this moment; add no other detail (no durations, rules or consequences that are not in the facts). Aim for 18 words, hard maximum 28 words (count them).
intermediate: for a casual fan; state what happened with the player, the minute and the score situation, in plain words (max 30 words).
tactical: for an expert; the same facts in an expert register (booking, block, final third, game state, level on 2-2), adding the exact score and minute, and one or two of the computed_tactical_facts that add real insight (game state of the team, minutes left, defenders between ball and goal, attackers in the box, distance in yards, defenders within five yards of the ball, keeper off his line); say 'yards', never coordinates; do not just repeat the intermediate line (max 35 words).
basic and intermediate are strictly factual, and tactical is too, using only the given facts and computed_tactical_facts: no interpretation, no judgement words (critical, costly, dramatic, crucial, pressure, lifeline), no intent (needed, sought, tried to), no consequences (what it means, what it prevented, what happens next), no tactics, runs, shapes or history beyond the facts given, and time remaining only from computed_tactical_facts. Say who did what, where (the zone given), when and what the score was. Never use the em dash character; use commas or full stops. Never append a word count such as "(25 words)".
State the outcome exactly: Saved = the goalkeeper stopped it, Blocked = a defender blocked it, Off T = it went off target, Wayward = it went well off target, Goal = it scored; never invent a different result. Define each concept_to_teach as a general rule; the notes list extra true facts you may use.
When an effect with a score is given, the intermediate and tactical layers must state that score (for example 3-2) and must not say the score is level.
Output exactly three lines: "basic: ...", "intermediate: ...", "tactical: ...".`;

function notes(m: Moment): string[] {
  const n: string[] = [];
  if (m.concepts.includes('assist')) n.push(m.setsUp ? `this pass was the assist for ${m.setsUp.player ?? 'a teammate'}'s goal in minute ${m.setsUp.minute}, which ${m.setsUp.effect}` : 'this pass was the assist: a goal was scored right after it');
  if (m.concepts.includes('penalty kick')) n.push('this shot was a penalty kick taken from the penalty spot');
  if (m.concepts.includes('extra time')) n.push('this moment is in extra time, the 30 extra minutes played because the match was level after 90');
  if (m.concepts.includes('shot')) n.push('a shot is an attempt to score');
  return n;
}

/** Computed facts only; ball and player coordinates never leave the app. */
function tacticalFacts(m: Moment) {
  const t = m.tactics;
  if (!t) return null;
  return {
    minutesLeftInPeriod: t.minutesLeft,
    gameStateForTeam: t.gameState,
    ...(t.defendersBetween !== undefined && { defendersBetweenBallAndGoal: t.defendersBetween }),
    ...(t.attackersInBox !== undefined && { attackersInPenaltyArea: t.attackersInBox }),
    ...(t.distanceToGoal !== undefined && { distanceToGoalYards: t.distanceToGoal }),
    ...(t.pressure !== undefined && { opponentsWithinFiveYardsOfBall: t.pressure }),
    ...(t.keeperOffLine && { goalkeeperFarOffGoalLine: true }),
  };
}

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
    concepts_to_teach: m.concepts,
    notes: notes(m),
    computed_tactical_facts: tacticalFacts(m),
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

/** R-05 LLM check: does the basic line explain the concepts in plain words using only the facts? */
export function judgeBasicPrompt(text: string, m: Moment, matchTitle?: string): { system: string; user: string } {
  return {
    system: JUDGE_SYSTEM + ' Say no only if a named concept is not defined at all, is defined wrongly, or is explained in jargon. A general definition need not match this moment or its score; the notes are true facts.',
    user: `Does this sentence explain ${m.concepts.join(' and ')} in plain words for a first-time viewer, using only these facts: ${JSON.stringify(momentFacts(m, matchTitle))}? Answer yes or no.

Sentence: ${text}`,
  };
}

/** Fact check for every layer: nothing invented beyond the facts. */
export function judgeFactsPrompt(text: string, m: Moment, matchTitle?: string): { system: string; user: string } {
  return {
    system: JUDGE_SYSTEM + ' Say no only if the sentence states something about this moment that is absent from or contradicts the facts. The notes and computed_tactical_facts are true facts (minutes left, the game state of the team, defenders between ball and goal, attackers in the penalty area, distance in yards, opponents near the ball, keeper off his line), and general definitions of soccer concepts are allowed. Claims derived from computed_tactical_facts are fine, such as the team protecting a lead, chasing the game, or a goalkeeper out of position. Statements derived from the facts are fine: who is leading, trailing or level from scoreBefore and scoreAfter (the team named first in a score is not necessarily the leader, compare the numbers), the minute, the phase, the zone, the player and team names, and the outcome (Pass Offside means the pass was ruled offside).',
    user: `Does this sentence use only these facts and invent nothing (no claims about tactics, runs, shapes, history or time not in the facts or computed_tactical_facts): ${JSON.stringify(momentFacts(m, matchTitle))}? Answer yes or no.

Sentence: ${text}`,
  };
}
const JUDGE_SYSTEM = 'You are a strict reviewer. Check the sentence against the facts in at most two short sentences, then end with exactly "Verdict: yes" or "Verdict: no".';

export const parseJudge = (text: string): boolean => {
  const v = text.match(/verdict:\s*(yes|no)/i);
  return v ? v[1]!.toLowerCase() === 'yes' : /^\W*yes\b/i.test(text.trim());
};
