import type { Theme } from './direction';

/** C · Terrace scarf: each viewer is a scarf colour. */
export const terrace: Theme = {
  id: 'c',
  name: 'Terrace scarf',
  layout: 'band',
  color: {
    bg: '#121B33',
    surface: '#2B3550',
    text: '#F4F6FA',
    textDim: '#C3CBDD',
    accent: '#F2C230',
    onAccent: '#121B33',
    focus: '#F4F6FA',
  },
  font: {
    title: 'BigShouldersDisplay_800ExtraBold',
    body: 'SourceSans3_400Regular',
    bodyBold: 'SourceSans3_600SemiBold',
  },
  pitch: {
    grass: '#1A2440',
    stripe: '#2B3550',
    line: '#F4F6FA',
    lineWidth: 0.5,
    ball: '#FFFFFF',
    ballStroke: '#121B33',
    shot: '#F2C230',
    actorRing: '#F2C230',
    opponent: '#F4F6FA',
    playerStroke: '#F4F6FA',
    magnets: false,
  },
  viewer: ['#F2C230', '#7FB8E6', '#FF6B57'],
};
