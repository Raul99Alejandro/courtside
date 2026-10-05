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

async function main() {
  const id = process.argv[2] ?? '3869685';
  const data = JSON.parse(readFileSync(`build/moments-${id}.json`, 'utf8')) as { match: { title: string }; moments: Moment[] };
  const stats: Stats = { calls: 0, retries: 0, judgeErrors: 0, inputTokens: 0, outputTokens: 0 };
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
  const file = `cards/cards-${id}.json`;
  const okCount = Object.keys(ordered).length;
  console.log(`ok/failed: ${okCount}/${failed.length} of ${data.moments.length}`);
  if (okCount < 0.9 * data.moments.length) {
    console.log('Fewer than 90% ok: the cards file was NOT written.');
  } else {
    // Never shrink the file: moments that failed this time keep their previous card; cards of moments no longer in the data are dropped.
    const previous = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Record<string, Card> : {};
    const ids = new Set(data.moments.map(m => m.id));
    const moments = new Map(data.moments.map(m => [m.id, m]));
    // Old cards that fail today's checks (for example a trailing word count) are dropped, not kept.
    const stillGood = Object.entries(previous).filter(([k, c]) => ids.has(k) && LAYER_ORDER.every(l => c[l] && checkCard(c[l], l, moments.get(k)!).length === 0));
    const merged = { ...Object.fromEntries(stillGood), ...ordered };
    mkdirSync('cards', { recursive: true });
    writeFileSync(file, JSON.stringify(merged, null, 2) + '\n');
    console.log(`wrote ${Object.keys(merged).length} cards to ${file} (${Object.keys(previous).length - stillGood.length} old cards dropped by the checks)`);
  }
  console.log(`calls=${stats.calls} retries=${stats.retries} judgeErrors=${stats.judgeErrors} tokens in/out=${stats.inputTokens}/${stats.outputTokens} time=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const f of failed) console.log('FAILED', f);
}

if (process.argv[1]?.endsWith('generate.ts')) main().catch(e => { console.error(e); process.exit(1); });
