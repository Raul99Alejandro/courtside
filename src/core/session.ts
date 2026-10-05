import { LAYER_ORDER, type Layer, type Viewer } from './types.js';
import { answerLayerForQuestion, lowestLayer } from './viewer.js';

export const MAX_PRESENT = 3; // R-09

export function pickViewer(present: string[], name: string) {
  if (present.includes(name)) return { ok: true as const, present };
  if (present.length >= MAX_PRESENT) return { ok: false as const, message: 'Up to 3 viewers at a time' };
  return { ok: true as const, present: [...present, name] };
}

/** R-08: one row per layer needed, lowest first, labelled with its viewers. */
export function composeCard(present: { name: string; layer: Layer }[]) {
  return LAYER_ORDER.filter(l => present.some(p => p.layer === l))
    .map(layer => ({ layer, viewers: present.filter(p => p.layer === layer).map(p => p.name) }));
}

/** R-08-b: a D-pad "Why?" has no known asker, so it is answered at the lowest layer present. */
export const dpadWhyLayer = (present: { layer: Layer }[]): Layer => lowestLayer(present.map(p => p.layer));

/** R-06: answered at the asking viewer's layer and labelled with their name. */
export function routeQuestion(phone: { viewer?: Viewer }) {
  if (!phone.viewer) return { ok: false as const, phoneMessage: 'Pick who you are first' };
  return { ok: true as const, layer: answerLayerForQuestion(phone.viewer), label: phone.viewer.name };
}

export function addViewer(profiles: Viewer[], v: Viewer) {
  if (!v.name) return { ok: false as const, message: 'Enter a name' };
  if (profiles.some(p => p.name.toLowerCase() === v.name.toLowerCase())) return { ok: false as const, message: `${v.name} already exists` };
  return { ok: true as const, profiles: [...profiles, v] };
}

/** Pairing codes are 6 characters A-Z/2-9; accept lower case and spaces/dashes from phones. */
export const normaliseCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '');
