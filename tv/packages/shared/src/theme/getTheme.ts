import type { Direction, Theme } from './direction';
import { floodlight } from './floodlight';
import { tactics } from './tactics';
import { terrace } from './terrace';

export const THEMES: Record<Direction, Theme> = { a: floodlight, b: tactics, c: terrace };
export const getTheme = (d: Direction): Theme => THEMES[d] ?? floodlight;
