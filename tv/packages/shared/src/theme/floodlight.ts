import type { Theme } from './direction';

/** A · Floodlight: a night match seen from the stands. */
export const floodlight: Theme = {
  id: 'a',
  name: 'Floodlight',
  layout: 'board',
  color: {
    bg: '#0E1A14',
    surface: '#13241B',
    text: '#F2F5EE',
    textDim: '#B9C6BA',
    accent: '#FFD36B',
    onAccent: '#0E1A14',
    focus: '#FFD36B',
  },
  font: {
    title: 'BarlowCondensed_700Bold',
    body: 'AtkinsonHyperlegible_400Regular',
    bodyBold: 'AtkinsonHyperlegible_700Bold',
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
    magnets: false,
  },
  viewer: ['#FFD36B', '#F2F5EE', '#9FD6AE', '#7FB8E6'],
};
