/** The Courtside look (design/direction.md): Floodlight base, scarf colour per viewer, marker notes on the pitch. */
export const theme = {
  color: {
    bg: '#0E1A14',
    surface: '#13241B',
    text: '#F2F5EE',
    textDim: '#B9C6BA',
    accent: '#FFD36B',
    onAccent: '#0E1A14',
    focus: '#FFD36B',
    /** the scoreboard strip, a shade darker than the board */
    strip: '#08110C',
    /** the one annotation colour on the pitch (Kalam notes, arrows, offside line) */
    note: '#FF6B6B',
  },
  font: {
    title: 'BarlowCondensed_700Bold',
    body: 'AtkinsonHyperlegible_400Regular',
    bodyBold: 'AtkinsonHyperlegible_700Bold',
    note: 'Kalam_700Bold',
  },
  pitch: {
    grass: '#1E5631',
    stripe: '#24683B',
    line: '#F2F5EE',
    lineWidth: 0.45,
    ball: '#FFFFFF',
    ballStroke: '#0E1A14',
    shot: '#FFD36B',
    actorRing: '#FFD36B',
    playerStroke: '#F2F5EE',
  },
} as const;

export type Theme = typeof theme;

export const TEAM_COLOR: Record<string, string> = {
  Argentina: '#6CACE4',
  France: '#1F2A6B',
};
export const teamColor = (team: string, fallback: string) => TEAM_COLOR[team] ?? fallback;
