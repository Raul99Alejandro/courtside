import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { checkCard, LAYER_ORDER, type Layer, type Moment } from '../core/index.js';
import { makeConverse, PRE_MODELS, type Converse } from './bedrock.js';

const realConverse = makeConverse(30_000); // offline: long calls are fine
import { cardPrompt, parseCard } from './prompt.js';
import { judgeBasic, judgeFacts, type Verdict } from './judge.js';

export type Card = Record<Layer, string>;
export interface Stats { calls: number; retries: number; judgeErrors: number; inputTokens: number; outputTokens: number }

/** Generates one checked card; undefined after 3 failed attempts. */
export async function generateCard(m: Moment, converse: Converse, matchTitle: string | undefined, stats: Stats, onFail?: (why: string[]) => void): Promise<Card | undefined> {
  let problems: string[] = [];
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) stats.retries++;
    const p = cardPrompt(m, matchTitle, problems);
    let text: string;
    try {
      const r = await converse(PRE_MODELS, p.system, p.user, 500);
      stats.calls++; stats.inputTokens += r.inputTokens ?? 0; stats.outputTokens += r.outputTokens ?? 0;
      text = r.text;
    } catch (err) { lastError = String(err).slice(0, 120); continue; } // a failed call is not a content problem; retry the same prompt
    const parsed = parseCard(text);
    problems = [];
    for (const layer of LAYER_ORDER) {
      const t = parsed[layer];
      if (!t) { problems.push(`${layer}: missing line`); continue; }
      for (const pr of checkCard(t, layer, m)) problems.push(`${layer}: ${pr}`);
    }
    if (!problems.length) {
      const verdicts: [string, Promise<Verdict>, string][] = [
        ['basic', judgeBasic(parsed.basic!, m, converse, matchTitle), 'does not define every concept in plain words; define each concept in a short clause, then say what happened'],
        ...LAYER_ORDER.map((l): [string, Promise<Verdict>, string] => [l, judgeFacts(parsed[l]!, m, converse, matchTitle), l === 'tactical' ? 'states a number or fact that is not given, or a conclusion that does not follow directly from the computed facts; use only given numbers and draw only an obvious conclusion' : 'states something not in the facts; remove every claim about tactics, runs, shapes, history or time that is not given']),
      ];
      for (const [layer, pending, reason] of verdicts) {
        const v = await pending;
        if (v.error) stats.judgeErrors++;
        if (!v.ok) problems.push(`${layer}: ${reason}`);
      }
    }
    if (!problems.length) return parsed as Card;
  }
  onFail?.(problems.length ? problems : [`calls failed: ${lastError}`]);
  return undefined;
}

type Cards = Record<string, Card>;
const cardPasses = (c: Card | undefined, m: Moment): boolean => !!c && LAYER_ORDER.every(l => !!c[l] && checkCard(c[l], l, m).length === 0);

/** Existing cards that still pass today's deterministic checks (cards of moments no longer in the data are dropped). */
export function keepGood(moments: Moment[], previous: Cards): Cards {
  return Object.fromEntries(moments.filter(m => cardPasses(previous[m.id], m)).map(m => [m.id, previous[m.id]!]));
}

/** Moments to (re)generate: all of them with `all`, otherwise those without a card or whose card fails the current checks. */
export function momentsToGenerate(moments: Moment[], previous: Cards, all: boolean): Moment[] {
  if (all) return moments;
  return moments.filter(m => !cardPasses(previous[m.id], m));
}

export interface RunResult { todo: number; generated: number; failed: string[]; merged: Cards; write: boolean; dropped: number }

/** Generates the missing/failing cards, merges them over the still-good previous ones; the 90 % rule applies to the merged result. */
export async function runGeneration(moments: Moment[], previous: Cards, converse: Converse, matchTitle: string | undefined, stats: Stats, all = false, workers = 4): Promise<RunResult> {
  const todo = momentsToGenerate(moments, previous, all);
  const fresh: Cards = {};
  const failed: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const m = todo[next++]!;
      const card = await generateCard(m, converse, matchTitle, stats, why => failed.push(`${m.id} (${m.minute}' ${m.what}): ${why.join('; ')}`));
      if (card) fresh[m.id] = card;
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
  const good = keepGood(moments, previous);
  const merged = Object.fromEntries(moments.flatMap(m => { const c = fresh[m.id] ?? good[m.id]; return c ? [[m.id, c]] : []; }));
  return { todo: todo.length, generated: Object.keys(fresh).length, failed, merged, write: Object.keys(merged).length >= 0.9 * moments.length, dropped: Object.keys(previous).length - Object.keys(good).length };
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const id = args.find(a => !a.startsWith('--')) ?? '3869685';
  const data = JSON.parse(readFileSync(`build/moments-${id}.json`, 'utf8')) as { match: { title: string }; moments: Moment[] };
  const file = `cards/cards-${id}.json`;
  const previous = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Cards : {};
  const stats: Stats = { calls: 0, retries: 0, judgeErrors: 0, inputTokens: 0, outputTokens: 0 };
  const t0 = Date.now();
  const r = await runGeneration(data.moments, previous, realConverse, data.match.title, stats, all);
  console.log(`mode=${all ? 'all' : 'incremental'} moments=${data.moments.length} to-generate=${r.todo} generated=${r.generated} failed=${r.failed.length}`);
  if (!r.write) {
    console.log(`Fewer than 90% of moments have a card (${Object.keys(r.merged).length}/${data.moments.length}): the cards file was NOT written.`);
  } else {
    mkdirSync('cards', { recursive: true });
    writeFileSync(file, JSON.stringify(r.merged, null, 2) + '\n');
    console.log(`wrote ${Object.keys(r.merged).length} cards to ${file} (${r.dropped} old cards dropped by the checks or no longer in the data)`);
  }
  console.log(`calls=${stats.calls} retries=${stats.retries} judgeErrors=${stats.judgeErrors} tokens in/out=${stats.inputTokens}/${stats.outputTokens} time=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const f of r.failed) console.log('FAILED', f);
}

if (process.argv[1]?.endsWith('generate.ts')) main().catch(e => { console.error(e); process.exit(1); });
