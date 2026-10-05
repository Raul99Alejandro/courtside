import { markGotIt, recordBasicShown, recordAsked } from '../../src/core/index.js';
import type { Adapter } from './index.js';
export const r04: Adapter = (g, w) => {
  // YAML uses snake_case (seen_basic); map to the Viewer shape.
  const v = { name: g.viewer.name, level: 'beginner' as const, understood: g.viewer.understood ?? [], seenBasic: g.viewer.seen_basic ?? {} };
  if (w.leo_taps === 'Got it') return { understood_by_Leo: markGotIt(v, w.concept).viewer.understood };
  if (w.leo_asks) { const r = recordAsked(v, 'offside'); return { understood_by_Leo: r.understood, seen_basic: r.seenBasic }; }
  const r = recordBasicShown(v, w.moment.concepts).viewer;
  return { understood_by_Leo: r.understood, seen_basic: r.seenBasic };
};
