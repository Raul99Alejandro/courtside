import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { checkCard, LAYER_ORDER, type Layer, type Moment } from '../core/index.js';
import { converse as realConverse, PRE_MODELS, type Converse } from './bedrock.js';
import { cardPrompt, parseCard } from './prompt.js';
import { judgeBasic } from './judge.js';

export type Card = Record<Layer, string>;
export interface Stats { calls: number; retries: number; inputTokens: number; outputTokens: number }

/** Generates one checked card; undefined after 3 failed attempts. */
export async function generateCard(m: Moment, converse: Converse, matchTitle: string | undefined, stats: Stats, onFail?: (why: string[]) => void): Promise<Card | undefined> {
  let problems: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) stats.retries++;
    const p = cardPrompt(m, matchTitle, problems);
    let text: string;
    try {
      const r = await converse(PRE_MODELS, p.system, p.user, 500);
      stats.calls++; stats.inputTokens += r.inputTokens ?? 0; stats.outputTokens += r.outputTokens ?? 0;
      text = r.text;
    } catch (err) { problems = [`call failed: ${(err as Error).message.slice(0, 80)}`]; continue; }
    const parsed = parseCard(text);
    problems = [];
    for (const layer of LAYER_ORDER) {
      const t = parsed[layer];
      if (!t) { problems.push(`${layer}: missing line`); continue; }
      for (const pr of checkCard(t, layer, m)) problems.push(`${layer}: ${pr}`);
    }
    if (!problems.length && !(await judgeBasic(parsed.basic!, m, converse, matchTitle))) {
      problems.push('basic: does not define every concept in plain words using only the facts; define each concept in a short clause, then say what happened, and add nothing else');
    }
    if (!problems.length) return parsed as Card;
  }
  onFail?.(problems);
  return undefined;
}

async function main() {
  const id = process.argv[2] ?? '3869685';
  const data = JSON.parse(readFileSync(`build/moments-${id}.json`, 'utf8')) as { match: { title: string }; moments: Moment[] };
  const stats: Stats = { calls: 0, retries: 0, inputTokens: 0, outputTokens: 0 };
  const cards: Record<string, Card> = {};
  const failed: string[] = [];
  const t0 = Date.now();
  let next = 0;
  const worker = async () => {
    while (next < data.moments.length) {
      const m = data.moments[next++]!;
      const card = await generateCard(m, realConverse, data.match.title, stats, why => failed.push(`${m.id} (${m.minute}' ${m.what}): ${why.join('; ')}`));
      if (card) cards[m.id] = card;
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const ordered = Object.fromEntries(data.moments.filter(m => cards[m.id]).map(m => [m.id, cards[m.id]]));
  mkdirSync('cards', { recursive: true });
  writeFileSync(`cards/cards-${id}.json`, JSON.stringify(ordered, null, 2) + '\n');
  console.log(`ok/failed: ${Object.keys(ordered).length}/${failed.length} of ${data.moments.length}`);
  console.log(`calls=${stats.calls} retries=${stats.retries} tokens in/out=${stats.inputTokens}/${stats.outputTokens} time=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const f of failed) console.log('FAILED', f);
}

if (process.argv[1]?.endsWith('generate.ts')) main().catch(e => { console.error(e); process.exit(1); });
