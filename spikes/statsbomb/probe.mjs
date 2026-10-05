// Downloads the 2022 final's events and 360 frames, prints counts only.
import { mkdir, writeFile } from 'node:fs/promises';
const BASE = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data';
const out = new URL('./data/', import.meta.url);
await mkdir(out, { recursive: true });
const matchId = process.env.MATCH_ID;
const matches = await (await fetch(`${BASE}/matches/43/106.json`)).json();
const final = matchId ? matches.find(m => String(m.match_id) === matchId) : matches.find(m => m.competition_stage?.name === 'Final');
console.log('match id:', final?.match_id, final?.competition_stage?.name, final?.home_team?.home_team_name, 'vs', final?.away_team?.away_team_name);
for (const kind of ['events', 'three-sixty']) {
  const res = await fetch(`${BASE}/${kind}/${final.match_id}.json`);
  console.log(kind, 'status', res.status);
  if (!res.ok) continue;
  const text = await res.text();
  await writeFile(new URL(`${kind}-${final.match_id}.json`, out), text);
  const data = JSON.parse(text);
  console.log(kind, 'items', data.length, 'bytes', text.length);
  if (kind === 'events') {
    const byType = {};
    for (const e of data) byType[e.type.name] = (byType[e.type.name] ?? 0) + 1;
    console.log('event types', JSON.stringify(byType));
    console.log('offside-related', data.filter(e => JSON.stringify(e).toLowerCase().includes('offside')).length);
  } else {
    const avg = data.reduce((n, f) => n + (f.freeze_frame?.length ?? 0), 0) / data.length;
    console.log('avg players per freeze frame', avg.toFixed(1));
  }
}
