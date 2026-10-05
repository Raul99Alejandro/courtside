// Explains 10 key moments with each candidate model; writes outputs to out/, prints latency only.
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';

const dataDir = new URL('../statsbomb/data/', import.meta.url);
const file = readdirSync(dataDir).find(f => f.startsWith('events-'));
const events = JSON.parse(readFileSync(new URL(file, dataDir)));
const isKey = e => e.period <= 4 && (
  e.type.name === 'Shot' || e.type.name === 'Offside' ||
  (e.type.name === 'Pass' && (e.pass?.outcome?.name === 'Pass Offside' || e.pass?.goal_assist)) ||
  (e.type.name === 'Foul Committed' && e.foul_committed?.card));
const key = events.filter(isKey);
const goals = key.filter(e => e.shot?.outcome?.name === 'Goal');
const others = key.filter(e => e.shot?.outcome?.name !== 'Goal');
const moments = [...goals.slice(0, 5), ...others.filter((_, i) => i % 4 === 0).slice(0, 5)].map(e => ({
  minute: e.minute, type: e.type.name, team: e.team.name, player: e.player?.name,
  outcome: e.shot?.outcome?.name ?? e.pass?.outcome?.name ?? null,
  shot_type: e.shot?.type?.name, card: e.foul_committed?.card?.name, location: e.location,
}));

const MODELS = (process.env.MODELS ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0,us.amazon.nova-2-lite-v1:0,us.anthropic.claude-sonnet-5-5').split(',');
const client = new BedrockRuntimeClient({});
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });

for (const modelId of MODELS) {
  const lat = []; const results = []; let failed = null;
  for (const m of moments) {
    const prompt = `You explain a soccer moment on a TV card. Moment (StatsBomb event; pitch is 120x80, attacking left to right): ${JSON.stringify(m)}.
Write three lines, one per layer: basic (a newcomer; define any term you use; max 25 words),
intermediate (max 30 words), tactical (an expert; max 35 words). Use only facts in the moment data. Format exactly:
basic: ...
intermediate: ...
tactical: ...`;
    const t0 = Date.now();
    try {
      const r = await client.send(new ConverseCommand({ modelId, messages: [{ role: 'user', content: [{ text: prompt }] }], inferenceConfig: { maxTokens: 300 } }));
      lat.push(Date.now() - t0);
      results.push({ moment: m, text: r.output.message.content.map(c => c.text ?? '').join(''), usage: r.usage });
    } catch (err) { failed = `${err.name}: ${err.message}`; break; }
  }
  writeFileSync(new URL(`./out/${modelId.replace(/[^a-z0-9.-]/gi, '_')}.json`, import.meta.url), JSON.stringify(results, null, 2));
  lat.sort((a, b) => a - b);
  console.log(modelId, failed ? `FAILED ${failed}` : `n=${lat.length} p50=${lat[Math.floor(lat.length / 2)]}ms max=${lat.at(-1)}ms`);
}
