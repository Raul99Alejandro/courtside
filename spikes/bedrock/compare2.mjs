// Same 10 moments, but with computed context (score, zone, phase, concept) instead of raw coordinates.
// Prints latency and token usage per model; writes texts to out/v2-<model>.json.
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';

const dataDir = new URL('../statsbomb/data/', import.meta.url);
const events = JSON.parse(readFileSync(new URL(readdirSync(dataDir).find(f => f.startsWith('events-')), dataDir)));
const teams = [...new Set(events.map(e => e.team.name))];

// Running score before each event (shoot-out excluded).
const score = Object.fromEntries(teams.map(t => [t, 0]));
const scoreBefore = new Map();
for (const e of events) {
  scoreBefore.set(e.id, { ...score });
  if (e.period <= 4 && e.shot?.outcome?.name === 'Goal') score[e.team.name]++;
  if (e.period <= 4 && e.type.name === 'Own Goal Against') score[teams.find(t => t !== e.team.name)]++;
}
// StatsBomb pitch is 120x80 and every team attacks left to right in its own events.
function zone([x, y]) {
  const third = x >= 102 && y >= 18 && y <= 62 ? "inside the opponent's penalty area" : x >= 80 ? 'in the attacking third' : x >= 40 ? 'in midfield' : 'in its own half';
  const lane = y < 26.7 ? 'left side' : y > 53.3 ? 'right side' : 'centre';
  return `${third}, ${lane} (from the attacking team's view)`;
}
const phase = e => ({ 1: 'first half', 2: 'second half', 3: 'extra time, first period', 4: 'extra time, second period' })[e.period];
function concept(e) {
  if (e.shot?.type?.name === 'Penalty') return 'penalty kick';
  if (e.type.name === 'Offside' || e.pass?.outcome?.name === 'Pass Offside') return 'offside';
  if (e.foul_committed?.card) return `${e.foul_committed.card.name.toLowerCase()} (caution)`;
  if (e.shot) return 'shot on goal';
  return 'assist';
}
const isKey = e => e.period <= 4 && (e.type.name === 'Shot' || e.type.name === 'Offside' ||
  (e.type.name === 'Pass' && (e.pass?.outcome?.name === 'Pass Offside' || e.pass?.goal_assist)) ||
  (e.type.name === 'Foul Committed' && e.foul_committed?.card));
const key = events.filter(isKey);
const pick = [...key.filter(e => e.shot?.outcome?.name === 'Goal').slice(0, 5), ...key.filter(e => e.shot?.outcome?.name !== 'Goal').filter((_, i) => i % 4 === 0).slice(0, 5)];
const moments = pick.map(e => ({
  match: '2022 final, Argentina vs France', minute: e.minute, phase: phase(e),
  score_before: scoreBefore.get(e.id), team: e.team.name, player: e.player?.name,
  what: e.type.name, outcome: e.shot?.outcome?.name ?? e.pass?.outcome?.name ?? e.foul_committed?.card?.name ?? null,
  shot_type: e.shot?.type?.name, where: zone(e.location), concept_to_teach: concept(e),
}));

const MODELS = (process.env.MODELS ?? [
  'us.openai.gpt-6.1-sol', 'us.openai.gpt-6-luna', 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  'us.anthropic.claude-sonnet-5-5', 'us.anthropic.claude-opus-5-5', 'us.amazon.nova-2-lite-v1:0', 'us.amazon.nova-pro-v1:0',
].join(',')).split(',');
const client = new BedrockRuntimeClient({});
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
const system = [{ text: `You write explanation cards for a soccer replay app on a TV, watched by a household with mixed experience.
Use only the facts given. Never mention coordinates. Each layer is one sentence.
basic: for someone watching their first match; explain the concept_to_teach in plain words; define any term (max 28 words).
intermediate: for a casual fan; why this moment matters in the match (max 30 words).
tactical: for an expert; the tactical or game-state angle, no clichés (max 35 words).
Output exactly three lines: "basic: ...", "intermediate: ...", "tactical: ...".` }];

for (const modelId of MODELS) {
  const lat = []; const results = []; let failed = null; let inTok = 0; let outTok = 0;
  for (const m of moments) {
    const t0 = Date.now();
    try {
      const r = await client.send(new ConverseCommand({ modelId, system, messages: [{ role: 'user', content: [{ text: JSON.stringify(m) }] }], inferenceConfig: { maxTokens: process.env.REASONING ? 4000 : 400 }, ...(process.env.REASONING && { additionalModelRequestFields: { reasoningConfig: { type: 'enabled', maxReasoningEffort: process.env.REASONING } } }) }));
      lat.push(Date.now() - t0); inTok += r.usage.inputTokens; outTok += r.usage.outputTokens;
      results.push({ moment: m, text: r.output.message.content.map(c => c.text ?? '').join('').trim() });
    } catch (err) { failed = `${err.name}: ${err.message.slice(0, 120)}`; break; }
  }
  writeFileSync(new URL(`./out/v2${process.env.REASONING ? '-r-' + process.env.REASONING : ''}-${modelId.replace(/[^a-z0-9.-]/gi, '_')}.json`, import.meta.url), JSON.stringify(results, null, 2));
  lat.sort((a, b) => a - b);
  console.log(modelId.padEnd(46), failed ? `FAILED ${failed}` : `p50=${lat[Math.floor(lat.length / 2)]}ms max=${lat.at(-1)}ms tokens in/out=${inTok}/${outTok}`);
}
