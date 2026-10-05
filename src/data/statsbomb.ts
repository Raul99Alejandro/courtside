import type { RawEvent, RawFrame } from './curate.js';

const BASE = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data';

export interface MatchInfo { id: string; title: string; teams: string[] }

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`StatsBomb fetch ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchMatch(matchId: string): Promise<{ match: MatchInfo; events: RawEvent[]; frames: RawFrame[] }> {
  const matches = await getJson<any[]>('matches/43/106.json');
  const m = matches.find(x => String(x.match_id) === matchId);
  if (!m) throw new Error(`match ${matchId} not found in competition 43/106`);
  const home = m.home_team.home_team_name as string;
  const away = m.away_team.away_team_name as string;
  const [events, frames] = await Promise.all([
    getJson<RawEvent[]>(`events/${matchId}.json`),
    getJson<RawFrame[]>(`three-sixty/${matchId}.json`),
  ]);
  return { match: { id: matchId, title: `${home} vs ${away}`, teams: [home, away] }, events, frames };
}
