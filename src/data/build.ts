import { mkdir, writeFile } from 'node:fs/promises';
import { curate } from './curate.js';
import { fetchMatch } from './statsbomb.js';

const matchId = process.env.MATCH_ID ?? '3869685';
const { match, events, frames } = await fetchMatch(matchId);
const moments = curate(events, frames);
await mkdir('build', { recursive: true });
await writeFile(`build/moments-${matchId}.json`, JSON.stringify({ match, moments }, null, 2));

const byConcept: Record<string, number> = {};
for (const m of moments) for (const c of m.concepts) byConcept[c] = (byConcept[c] ?? 0) + 1;
const goals = moments.filter(m => m.effect);
console.log(`match ${matchId}: ${moments.length} moments (${moments.filter(m => m.players?.length).length} with players)`);
console.log(`goals ${goals.length} (${goals.filter(m => m.players?.length).length} with players), offsides ${byConcept['offside'] ?? 0} (${moments.filter(m => m.concepts.includes('offside') && m.players?.length).length} with players)`);
console.log('by concept', JSON.stringify(byConcept));
