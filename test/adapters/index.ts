import { r01 } from './r01.js';
export type Adapter = (given: any, when: any) => unknown;
export const adapters: Record<string, Adapter> = { 'R-01': r01 };
