import { LAYER_ORDER, type Concept, type Layer, type Level, type Viewer } from './types.js';

export const UNDERSTOOD_AFTER_VIEWS = 2;   // R-04
export const PROMOTE_AT = 5;               // R-07
export const LEVEL_QUESTION = { text: 'How much soccer do you know?', options: ['beginner', 'fan', 'expert'] as Level[] };

const BASE: Record<Level, Layer> = { beginner: 'basic', fan: 'intermediate', expert: 'tactical' };

export function newViewer(name: string, level: Level): Viewer {
  return { name: name.trim(), level, understood: [], seenBasic: {} };
}

const knowsAll = (v: Viewer, cs: Concept[]) => cs.length > 0 && cs.every(c => v.understood.includes(c));

/** R-02: layer of the level; a beginner who understood the moment's concepts moves up to intermediate. */
export function layerFor(v: Viewer, concepts: Concept[]): Layer {
  const base = BASE[v.level];
  return base === 'basic' && knowsAll(v, concepts) ? 'intermediate' : base;
}

/** R-03: understood concepts get no basic row. */
export function showsBasicRow(v: Viewer, concepts: Concept[]): boolean {
  return layerFor(v, concepts) === 'basic';
}

/** R-03: the basic row, or the "Why?" offer in its place when the viewer already understands the moment. */
export function basicRowFor(v: Viewer, concepts: Concept[]): { showBasic: boolean; offer?: 'Why?' } {
  return showsBasicRow(v, concepts) ? { showBasic: true } : { showBasic: false, offer: 'Why?' };
}

/** R-03-b: asking about a concept always gets a basic answer for beginners; otherwise the viewer's base layer. */
export function answerLayerForQuestion(v: Viewer, aboutConcept?: Concept): Layer {
  if (aboutConcept && v.level === 'beginner') return 'basic';
  return BASE[v.level];
}

function addUnderstood(v: Viewer, c: Concept): { viewer: Viewer; promotion?: string; undoOffered?: true } {
  if (v.understood.includes(c)) return { viewer: v };
  let viewer: Viewer = { ...v, understood: [...v.understood, c] };
  let promotion: string | undefined;
  let undoOffered: true | undefined;
  if (viewer.level === 'beginner' && !viewer.autoPromotionDisabled && viewer.understood.length >= PROMOTE_AT) {
    viewer = { ...viewer, level: 'fan', promotedAutomatically: true };
    promotion = `${viewer.name} moved up to Fan`;
    undoOffered = true;
  }
  return { viewer, promotion, undoOffered };
}

/** R-04: "Got it" marks the concept understood at once. */
export function markGotIt(v: Viewer, c: Concept) { return addUnderstood(v, c); }

/** R-04: a basic explanation shown without a question counts; the second view makes it understood. */
export function recordBasicShown(v: Viewer, concepts: Concept[]): { viewer: Viewer; promotion?: string; undoOffered?: true } {
  let viewer = v; let promotion: string | undefined; let undoOffered: true | undefined;
  for (const c of concepts) {
    if (viewer.understood.includes(c)) continue;
    const n = (viewer.seenBasic[c] ?? 0) + 1;
    viewer = { ...viewer, seenBasic: { ...viewer.seenBasic, [c]: n } };
    if (n >= UNDERSTOOD_AFTER_VIEWS) { const r = addUnderstood(viewer, c); viewer = r.viewer; promotion = r.promotion ?? promotion; undoOffered = r.undoOffered ?? undoOffered; }
  }
  return { viewer, promotion, undoOffered };
}

/** R-04-c: asking about a concept resets its view count. */
export function recordAsked(v: Viewer, c: Concept): Viewer {
  return { ...v, seenBasic: { ...v.seenBasic, [c]: 0 } };
}

/** R-07-c: undo an automatic promotion; never promote automatically again. */
export function undoPromotion(v: Viewer): Viewer {
  if (!v.promotedAutomatically) return v;
  return { ...v, level: 'beginner', promotedAutomatically: false, autoPromotionDisabled: true };
}

export const lowestLayer = (ls: Layer[]): Layer => LAYER_ORDER.find(l => ls.includes(l)) ?? 'basic';
