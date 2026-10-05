import { routeQuestion } from '../../src/core/index.js';
import type { Adapter } from './index.js';
export const r06: Adapter = (g) => {
  if (g.viewer_chosen === false) { const r = routeQuestion({}); return r.ok ? r : { accepted: false, phone_shows: r.phoneMessage }; }
  const asker = g.present.find((p: any) => p.name === g.phone_of);
  const r = routeQuestion({ viewer: { understood: [], seenBasic: {}, ...asker } });
  return r.ok ? { answer_layer: r.layer, label: r.label } : r;
};
