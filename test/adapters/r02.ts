import { layerFor } from '../../src/core/index.js';
import type { Adapter } from './index.js';
export const r02: Adapter = (g, w) => ({ layer: layerFor({ seenBasic: {}, ...g.viewer }, w.moment.concepts) });
