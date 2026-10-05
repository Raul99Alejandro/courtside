import type { Theme } from './direction';

/** B · Tactics board: the coach's whiteboard at half-time. */
export const tactics: Theme = {
  id: 'b',
  name: 'Tactics board',
  layout: 'whiteboard',
  color: {
    bg: '#EEF1F4',
    surface: '#C9D1D9',
    text: '#1B1F24',
    textDim: '#3C444D',
    accent: '#D7263D',
    onAccent: '#FFFFFF',
    focus: '#D7263D',
  },
  font: {
    title: 'Archivo_800ExtraBold',
    body: 'Archivo_400Regular',
    bodyBold: 'Archivo_700Bold',
    hand: 'Kalam_700Bold',
  },
  pitch: {
    grass: 'transparent',
    stripe: 'transparent',
    line: '#1B1F24',
    lineWidth: 0.7,
    ball: '#FFFFFF',
    ballStroke: '#1B1F24',
    shot: '#D7263D',
    actorRing: '#D7263D',
    playerStroke: '#1B1F24',
    magnets: true,
  },
  // sticky notes: yellow, pink, mint
  viewer: ['#FFE58A', '#FFB3C7', '#B8F0D2', '#BFD9F5'],
};
