import { composeCard, layerFor, lowestLayer, DEFINITIONS as CONCEPT_DEFINITIONS, type Layer, type Moment, type Viewer } from '@courtside/core';

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

/**
 * R-08-b: "Why?" has no known asker, so it answers at the lowest layer among the rows on screen.
 * Basic gets the canonical definitions; a higher layer gets that layer's card line.
 */
export function whyAnswer(moment: Moment, rows: CardRow[], cards: Cards): { layer: Layer; text: string } {
  const layer = lowestLayer(rows.map(r => r.layer));
  return { layer, text: layer === 'basic' ? fallbackText(moment) : (cards[moment.id]?.[layer] ?? fallbackText(moment)) };
}
