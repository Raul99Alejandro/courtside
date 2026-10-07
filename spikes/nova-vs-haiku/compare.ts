// Nova vs Haiku spike. Run: AWS_PROFILE=counterpart AWS_REGION=us-east-1 npx tsx spikes/nova-vs-haiku/compare.ts [--tweak] [--skip-judge-cards]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Layer, Moment } from '../../src/core/index.js';
import { answerQuestion, FALLBACK_ANSWER } from '../../src/explain/answer.js';
import { LIVE_TIMEOUT_MS, type Converse } from '../../src/explain/bedrock.js';
import { judgeBasic, judgeFacts } from '../../src/explain/judge.js';
import { DEFINITIONS } from '../../src/core/definitions.js';
import { momentFacts } from '../../src/explain/prompt.js';

const TWEAK = process.argv.includes('--tweak');
const TWEAK_TEXT = ' Canonical soccer definitions, to use for any rule question instead of your memory: ' + JSON.stringify(DEFINITIONS) + ' Answer the question directly first, in full sentences, and explain the idea rather than only restating the definition. Say nothing about the moment that is not in its facts.';
const HAIKU = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
const SONNET = 'us.anthropic.claude-sonnet-4-6';
const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-1', maxAttempts: 1 });

interface Opt { reasoning?: 'low'; timeoutMs: number; extraTokens?: number; tweak?: boolean }
/** Single-model Converse with the same shape as production, plus optional reasoning and call counting. */
function forced(modelId: string, o: Opt, log?: { calls: number; errors: string[] }): Converse {
  return async (_ids, system, user, maxTokens) => {
    if (log) log.calls++;
    try {
      const r = await client.send(new ConverseCommand({
        modelId,
        system: [{ text: system + (o.tweak ? TWEAK_TEXT : '') }],
        messages: [{ role: 'user', content: [{ text: user }] }],
        inferenceConfig: { maxTokens: maxTokens + (o.extraTokens ?? 0) },
        ...(o.reasoning && { additionalModelRequestFields: { reasoningConfig: { type: 'enabled', maxReasoningEffort: o.reasoning } } }),
      }), { abortSignal: AbortSignal.timeout(o.timeoutMs) });
      const text = (r.output?.message?.content ?? []).map(c => c.text ?? '').join('').trim();
      if (!text) throw new Error('empty response');
      return { text, modelId };
    } catch (e) { log?.errors.push(String((e as Error).message).slice(0, 80)); throw e; }
  };
}

const moments: Moment[] = (() => { const j = JSON.parse(readFileSync('build/moments-3869685.json', 'utf8')); return Array.isArray(j) ? j : j.moments; })();
const byId = (id: string) => { const m = moments.find(x => x.id.startsWith(id)); if (!m) throw new Error('no moment ' + id); return m; };

const Q: { q: string; layer: Layer; moment?: string; kind: 'rule' | 'moment' | 'tactics' }[] = [
  // basic (7)
  { q: 'What is offside?', layer: 'basic', kind: 'rule' },
  { q: 'Why was that offside?', layer: 'basic', moment: '25548b02', kind: 'moment' },
  { q: 'What is a penalty kick?', layer: 'basic', kind: 'rule' },
  { q: 'Why did he get a yellow card?', layer: 'basic', moment: 'af8c7775', kind: 'moment' },
  { q: 'What does extra time mean?', layer: 'basic', kind: 'rule' },
  { q: 'What is an assist?', layer: 'basic', moment: 'ed70825d', kind: 'rule' },
  { q: 'Was that a goal or did the keeper stop it?', layer: 'basic', moment: '545c2c84', kind: 'moment' },
  // intermediate (6)
  { q: 'Why was that a penalty?', layer: 'intermediate', moment: '6d527ebc', kind: 'moment' },
  { q: 'What just happened there?', layer: 'intermediate', moment: '03fb2918', kind: 'moment' },
  { q: 'What is the difference between a shot and a shot on goal?', layer: 'intermediate', kind: 'rule' },
  { q: 'Who scored and what is the score now?', layer: 'intermediate', moment: '54b889ec', kind: 'moment' },
  { q: 'How does offside work when the pass comes from a teammate?', layer: 'intermediate', moment: 'bae39b9d', kind: 'rule' },
  { q: 'Why is there a penalty here, where was the foul?', layer: 'intermediate', moment: '6cc0d5e2', kind: 'moment' },
  // tactical (7)
  { q: 'How much did the scoreline shape how France played right here?', layer: 'tactical', moment: '03fb2918', kind: 'tactics' },
  { q: 'Why was this shot so hard to score from?', layer: 'tactical', moment: '4ad26294', kind: 'tactics' },
  { q: 'Is Argentina trying to protect the lead now?', layer: 'tactical', moment: 'ef86f4d9', kind: 'tactics' },
  { q: 'Walk me through the offside trap on this pass.', layer: 'tactical', moment: '22fea401', kind: 'tactics' },
  { q: 'What changed tactically after Messi scored in extra time?', layer: 'tactical', moment: '54b889ec', kind: 'tactics' },
  { q: 'Was the keeper out of position on this one?', layer: 'tactical', moment: '867b8791', kind: 'tactics' },
  { q: 'Define offside precisely, including the active play condition.', layer: 'tactical', kind: 'rule' },
];

const VARIANTS: { name: string; modelId: string; opt: Opt }[] = [
  { name: 'haiku-4.5', modelId: HAIKU, opt: { timeoutMs: LIVE_TIMEOUT_MS } },
  { name: 'nova-2-lite', modelId: 'us.amazon.nova-2-lite-v1:0', opt: { timeoutMs: LIVE_TIMEOUT_MS } },
  { name: 'nova-pro', modelId: 'us.amazon.nova-pro-v1:0', opt: { timeoutMs: LIVE_TIMEOUT_MS } },
  { name: 'nova-2-lite-low', modelId: 'us.amazon.nova-2-lite-v1:0', opt: { timeoutMs: LIVE_TIMEOUT_MS, reasoning: 'low', extraTokens: 1500 } },
];
if (TWEAK) for (const v of VARIANTS) v.opt.tweak = true;

const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? NaN; };
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

interface Row { variant: string; i: number; ms: number; answer: string; calls: number; fallback: boolean; errors: string[] }

async function runAnswers(): Promise<Row[]> {
  const rows: Row[] = [];
  for (const v of VARIANTS) {
    for (let i = 0; i < Q.length; i++) {
      const q = Q[i]!;
      const log = { calls: 0, errors: [] as string[] };
      const t0 = Date.now();
      const answer = await answerQuestion({ question: q.q, layer: q.layer, moment: q.moment ? byId(q.moment) : undefined, viewerName: 'Sam' }, { converse: forced(v.modelId, v.opt, log) });
      rows.push({ variant: v.name, i, ms: Date.now() - t0, answer, calls: log.calls, fallback: answer === FALLBACK_ANSWER, errors: log.errors });
    }
    console.error('answered', v.name);
  }
  return rows;
}

function reliability(rows: Row[]) {
  return VARIANTS.map(v => {
    const r = rows.filter(x => x.variant === v.name);
    const ms = r.map(x => x.ms);
    const ok1 = r.filter(x => !x.fallback && x.calls === 1).length;
    const okRetry = r.filter(x => !x.fallback && x.calls === 2).length;
    const fb = r.filter(x => x.fallback).length;
    const callErr = r.filter(x => x.errors.length).length;
    const words = r.filter(x => !x.fallback).map(x => x.answer.split(/\s+/).length);
    return { variant: v.name, p50: pct(ms, .5), p95: pct(ms, .95), firstTry: `${ok1}/${r.length}`, afterRetry: `${ok1 + okRetry}/${r.length}`, fallback: `${fb}/${r.length}`, callErrors: callErr, meanWords: +mean(words).toFixed(1) };
  });
}

async function sonnet(system: string, user: string, maxTokens = 600): Promise<string> {
  const r = await client.send(new ConverseCommand({ modelId: SONNET, system: [{ text: system }], messages: [{ role: 'user', content: [{ text: user }] }], inferenceConfig: { maxTokens, temperature: 0 } }), { abortSignal: AbortSignal.timeout(60000) });
  return (r.output?.message?.content ?? []).map(c => c.text ?? '').join('');
}

const JUDGE_SYS = 'You are a strict soccer-rules reviewer comparing two anonymized answers spoken on a TV to a viewer. Score each 1-5 on: correct against the canonical definitions and facts given (no contradictions), plain language suited to the viewer layer, and no invented facts (anything about the moment not in the facts). A generic apology or "try again" answer scores 1. Reply with only JSON: {"a":n,"b":n,"winner":"A"|"B"|"tie","why":"short"}';

interface Pair { variant: string; i: number; scoreHaiku: number; scoreNova: number; winner: 'haiku' | 'nova' | 'tie' }
async function scorePairs(rows: Row[]): Promise<Pair[]> {
  const out: Pair[] = [];
  for (const v of VARIANTS.slice(1)) {
    for (let i = 0; i < Q.length; i++) {
      const q = Q[i]!;
      const h = rows.find(r => r.variant === 'haiku-4.5' && r.i === i)!;
      const n = rows.find(r => r.variant === v.name && r.i === i)!;
      const flip = (i * 7 + v.name.length) % 2 === 1; // deterministic blind order
      const A = flip ? n : h, B = flip ? h : n;
      const m = q.moment ? byId(q.moment) : undefined;
      const user = `Viewer layer: ${q.layer}. Question: ${q.q}\nCanonical definitions: ${JSON.stringify(DEFINITIONS)}\n${m ? 'Moment facts: ' + JSON.stringify(momentFacts(m)) : 'No moment is on screen.'}\n\nAnswer A: ${A.answer}\nAnswer B: ${B.answer}`;
      let j: { a: number; b: number; winner: string } | undefined;
      for (let t = 0; t < 2 && !j; t++) { try { const txt = await sonnet(JUDGE_SYS, user); j = JSON.parse(txt.match(/\{[\s\S]*\}/)![0]); } catch { /* retry */ } }
      if (!j) continue;
      const sh = flip ? j.b : j.a, sn = flip ? j.a : j.b;
      const w = j.winner === 'tie' ? 'tie' : ((j.winner === 'A') === !flip ? 'haiku' : 'nova');
      out.push({ variant: v.name, i, scoreHaiku: sh, scoreNova: sn, winner: w });
    }
    console.error('scored', v.name);
  }
  return out;
}

function pairSummary(pairs: Pair[]) {
  return VARIANTS.slice(1).map(v => {
    const p = pairs.filter(x => x.variant === v.name);
    return { variant: v.name, n: p.length, meanNova: +mean(p.map(x => x.scoreNova)).toFixed(2), meanHaikuInPair: +mean(p.map(x => x.scoreHaiku)).toFixed(2), novaWins: p.filter(x => x.winner === 'nova').length, ties: p.filter(x => x.winner === 'tie').length, novaLosses: p.filter(x => x.winner === 'haiku').length };
  });
}

// ---- generation judge on stored cards ----
async function judgeCards() {
  const cards = JSON.parse(readFileSync('cards/cards-3869685.json', 'utf8')) as Record<string, Record<Layer, string>>;
  const ids = Object.keys(cards).filter(id => moments.find(m => m.id === id)?.concepts.length).slice(0, 10);
  const items: { id: string; layer: Layer; kind: 'basicjudge' | 'facts'; text: string; corrupted: boolean }[] = [];
  for (const id of ids) {
    const c = cards[id]!;
    items.push({ id, layer: 'basic', kind: 'basicjudge', text: c.basic, corrupted: false });
    for (const l of ['basic', 'intermediate', 'tactical'] as const) items.push({ id, layer: l, kind: 'facts', text: c[l], corrupted: false });
    // negative controls
    items.push({ id, layer: 'intermediate', kind: 'facts', text: c.intermediate.replace(/\.$/, '') + ', after a long VAR review that lasted four minutes.', corrupted: true });
    items.push({ id, layer: 'basic', kind: 'basicjudge', text: 'It is when a player is fouled and the referee stops play for a free kick, which is called a penalty or offside or whatever.', corrupted: true });
  }
  const runJ = async (modelId: string) => {
    const conv = forced(modelId, { timeoutMs: 30000 });
    const res: boolean[] = [];
    for (const it of items) {
      const m = byId(it.id);
      const v = it.kind === 'basicjudge' ? await judgeBasic(it.text, m, conv) : await judgeFacts(it.text, m, conv);
      res.push(v.ok && !v.error);
    }
    return res;
  };
  const haiku = await runJ(HAIKU);
  const out: Record<string, unknown> = { items: items.length, clean: items.filter(i => !i.corrupted).length, corrupted: items.filter(i => i.corrupted).length, haikuYesClean: haiku.filter((r, k) => r && !items[k]!.corrupted).length, haikuCaught: haiku.filter((r, k) => !r && items[k]!.corrupted).length };
  for (const [name, id] of [['nova-2-lite', 'us.amazon.nova-2-lite-v1:0'], ['nova-pro', 'us.amazon.nova-pro-v1:0']] as const) {
    const r = await runJ(id);
    const agree = r.filter((x, k) => x === haiku[k]).length;
    const cl = items.map((_, k) => k).filter(k => !items[k]!.corrupted), co = items.map((_, k) => k).filter(k => items[k]!.corrupted);
    out[name] = { agreeAll: `${agree}/${items.length}`, agreeClean: `${cl.filter(k => r[k] === haiku[k]).length}/${cl.length}`, agreeCorrupted: `${co.filter(k => r[k] === haiku[k]).length}/${co.length}`, novaYesClean: r.filter((x, k) => x && !items[k]!.corrupted).length, novaCaught: r.filter((x, k) => !x && items[k]!.corrupted).length };
  }
  return out;
}

const rows = await runAnswers();
const rel = reliability(rows);
console.log('RELIABILITY', JSON.stringify(rel));
const pairs = await scorePairs(rows);
console.log('QUALITY', JSON.stringify(pairSummary(pairs)));
const byLayer = (['basic', 'intermediate', 'tactical'] as Layer[]).map(l => ({ layer: l, ...Object.fromEntries(VARIANTS.slice(1).map(v => { const p = pairs.filter(x => x.variant === v.name && Q[x.i]!.layer === l); return [v.name, `${+mean(p.map(x => x.scoreNova)).toFixed(2)} vs haiku ${+mean(p.map(x => x.scoreHaiku)).toFixed(2)}`]; })) }));
console.log('BYLAYER', JSON.stringify(byLayer));
const tag = TWEAK ? 'tweak' : 'base';
let cardsRes: unknown;
if (!process.argv.includes('--skip-judge-cards')) { cardsRes = await judgeCards(); console.log('JUDGECARDS', JSON.stringify(cardsRes)); }
mkdirSync('spikes/nova-vs-haiku/out', { recursive: true });
writeFileSync(`spikes/nova-vs-haiku/out/results-${tag}.json`, JSON.stringify({ questions: Q, rows, pairs, rel, cardsRes }, null, 1));
