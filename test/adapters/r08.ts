import { composeCard, dpadWhyLayer } from '../../src/core/index.js';
import type { Adapter } from './index.js';
export const r08: Adapter = (g, w) => w.dpad ? { answer_layer: dpadWhyLayer(g.present) } : { rows: composeCard(g.present) };
