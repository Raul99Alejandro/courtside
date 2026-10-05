import { showsBasicRow, answerLayerForQuestion } from '../../src/core/index.js';
import type { Adapter } from './index.js';
export const r03: Adapter = (g, w) => {
  const v = { seenBasic: {}, ...g.viewer };
  if (w.ana_asks) return { answer_layer: answerLayerForQuestion(v, w.moment.concepts[0]) };
  return { basic_row_for_Ana: showsBasicRow(v, w.moment.concepts), offer: showsBasicRow(v, w.moment.concepts) ? undefined : 'Why?' };
};
