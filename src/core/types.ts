export type Level = 'beginner' | 'fan' | 'expert';
export type Layer = 'basic' | 'intermediate' | 'tactical';
export const LAYER_ORDER: readonly Layer[] = ['basic', 'intermediate', 'tactical'];

export type Concept =
  | 'penalty kick' | 'offside' | 'yellow card' | 'red card' | 'assist'
  | 'shot on goal' | 'shot' | 'goal' | 'extra time' | 'penalty shoot-out' | 'save';

export interface Viewer {
  name: string;
  level: Level;
  understood: Concept[];
  /** How many times the basic explanation of a concept was shown without the viewer asking (R-04). */
  seenBasic: Partial<Record<Concept, number>>;
  /** Set when R-07 promoted the viewer automatically. */
  promotedAutomatically?: boolean;
  /** Set when the viewer undid an automatic promotion; no further automatic promotion (R-07-c). */
  autoPromotionDisabled?: boolean;
}

/** The subset of a StatsBomb event the core needs. */
export interface MatchEvent {
  id: string;
  type: string;                 // 'Shot', 'Pass', 'Foul Committed', 'Offside', ...
  minute: number;
  period: number;               // 1-4 play, 5 shoot-out
  team: string;
  player?: string;
  shotType?: string;            // 'Penalty', 'Open Play', ...
  outcome?: string;             // 'Goal', 'Saved', 'Off T', 'Pass Offside', ...
  card?: string;                // 'Yellow Card', 'Red Card', 'Second Yellow'
  goalAssist?: boolean;
  location?: [number, number];
}

export interface Moment {
  id: string;                   // event id
  minute: number;
  phase: string;
  team: string;
  player?: string;
  what: string;
  outcome?: string;
  concepts: Concept[];
  scoreBefore: Record<string, number>;
  scoreAfter: Record<string, number>;
  effect?: string;              // 'puts Argentina ahead 3-2', 'levels it 2-2', 'pulls one back 2-1', 'makes it 2-0'
  /** For an assist: the goal this pass created. */
  setsUp?: { player?: string; minute: number; effect: string };
  zone?: string;
  ball?: [number, number];
  players?: { x: number; y: number; teammate: boolean; actor: boolean; keeper: boolean }[];
}
