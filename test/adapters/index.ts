import { r01 } from './r01.js';
import { r02 } from './r02.js';
import { r03 } from './r03.js';
import { r04 } from './r04.js';
import { r07 } from './r07.js';
export type Adapter = (given: any, when: any) => unknown;
export const adapters: Record<string, Adapter> = { 'R-01': r01, 'R-02': r02, 'R-03': r03, 'R-04': r04, 'R-07': r07 };
