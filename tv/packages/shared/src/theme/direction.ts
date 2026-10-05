export type Direction = 'a' | 'b' | 'c';

/** One visual direction: tokens plus the layout variant the Replay screen renders. */
export interface Theme {
  id: Direction;
  name: string;
  layout: 'board' | 'whiteboard' | 'band';
  color: {
    bg: string;
    surface: string;
    text: string;
    textDim: string;
    accent: string;
    onAccent: string;
    focus: string;
  };
  font: { title: string; body: string; bodyBold: string; hand?: string };
  pitch: {
    grass: string;
    stripe: string;
    line: string;
    lineWidth: number;
    ball: string;
    ballStroke: string;
    shot: string;
    actorRing: string;
    /** overrides the other team's colour when it would vanish into the grass */
    opponent?: string;
    playerStroke: string;
    /** magnets get a small highlight so they read as objects on a board */
    magnets: boolean;
  };
  /** Identity colour per viewer slot (first present viewer gets slot 0, ...). */
  viewer: string[];
}

export const TEAM_COLOR: Record<string, string> = {
  Argentina: '#6CACE4',
  France: '#1F2A6B',
};
export const teamColor = (team: string, fallback: string) => TEAM_COLOR[team] ?? fallback;
