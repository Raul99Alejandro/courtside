import { composeCard, layerFor, type Layer, type Moment, type Viewer } from '@courtside/core';
import { CONCEPT_DEFINITIONS } from './concept-definitions';

export type Cards = Record<string, Record<Layer, string>>;

export interface CardRow {
  layer: Layer;
  viewers: string[];
  text: string;
}

/** The basic definitions of the moment's concepts, joined; used when no card was generated. */
export function fallbackText(moment: Moment): string {
  const defs = moment.concepts.map(c => CONCEPT_DEFINITIONS[c]).filter(Boolean);
  return defs.length ? defs.join(' ') : `${moment.what} at minute ${moment.minute}.`;
}

/** R-08: one row per layer needed by the viewers present, lowest first, labelled with their names. */
export function cardRowsFor(moment: Moment, present: Viewer[], cards: Cards): CardRow[] {
  const card = cards[moment.id];
  return composeCard(present.map(v => ({ name: v.name, layer: layerFor(v, moment.concepts) }))).map(
    ({ layer, viewers }) => ({ layer, viewers, text: card?.[layer] ?? fallbackText(moment) }),
  );
}
