import { newViewer, scarfFor, type Viewer } from '@courtside/core';

/** Mock household for the design screens. Order fixes each person's identity colour. */
export const HOUSEHOLD: Viewer[] = [
  newViewer('Leo', 'beginner'),
  { ...newViewer('Ana', 'beginner'), understood: ['goal'] },
  newViewer('Raul', 'expert'),
  newViewer('Sofia', 'fan'),
];

export const householdIndex = (name: string) => Math.max(0, HOUSEHOLD.findIndex(v => v.name === name));

export const DEMO_CODE = 'XQFSWD';
export const PHONE_URL = `https://d3igz6igrmkgis.cloudfront.net/phone.html?code=${DEMO_CODE}`;

export const LEVEL_LABEL = { beginner: 'Beginner', fan: 'Fan', expert: 'Expert' } as const;

/** A question asked from Leo's phone about a real offside moment (Tagliafico, 13th minute). */
export const DEMO_QUESTION = {
  viewer: 'Leo',
  momentId: '2a0ff535-d44f-4838-a372-140631fb6184',
  text: 'Why was that offside?',
  answer:
    'A player is offside when they are closer to the goal than the ball and the second-last defender at the moment the pass is played. The referee gave France a free kick.',
};

/** A viewer's scarf, from their place in the household list (same helper as the phone page). */
export const scarfOf = (name: string) => scarfFor(householdIndex(name));
