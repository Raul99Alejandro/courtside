import type { Moment } from '../core/index.js';
import data from './moments-3869685.json' with { type: 'json' };

// Slim copy of build/moments-3869685.json (no ball or player coordinates), bundled so the live answer can know which moment the TV shows.
const BY_ID = new Map((data.moments as unknown as Moment[]).map(m => [m.id, m]));
export const momentById = (id: string | undefined): Moment | undefined => (id ? BY_ID.get(id) : undefined);
export const MATCH_TITLE: string = data.match.title;
