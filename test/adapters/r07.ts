import { newViewer, markGotIt, undoPromotion, LEVEL_QUESTION } from '../../src/core/index.js';
import type { Adapter } from './index.js';
export const r07: Adapter = (g, w) => {
  if (w.create) return { asks: LEVEL_QUESTION.text, options: LEVEL_QUESTION.options };
  // YAML uses snake_case (promoted_automatically); map to the Viewer shape.
  const v = { name: g.viewer.name, level: g.viewer.level, understood: g.viewer.understood ?? [], seenBasic: {}, promotedAutomatically: g.viewer.promoted_automatically };
  if (w.leo_undoes) { const u = undoPromotion(v); return { level: u.level, auto_promotion_again: !u.autoPromotionDisabled }; }
  const r = markGotIt(v, w.becomes_understood); // R-07-d: a fan never auto-promotes, whatever the count
  return { level: r.viewer.level, ...(r.promotion && { tv_announces: r.promotion, undo_offered: true }) };
};
