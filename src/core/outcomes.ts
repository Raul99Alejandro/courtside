/** Plain words for the raw outcome names in the data; one table used by the TV screens and the card prompt. */
export const OUTCOME_LABELS: Record<string, string> = {
  'Pass Offside': 'Ruled offside',
  'Off T': 'Off target',
  Blocked: 'Blocked',
  Saved: 'Saved by the keeper',
  Wayward: 'Wide',
  Post: 'Hit the post',
  Goal: 'Goal',
};

/** The plain label for an outcome; unknown outcomes pass through unchanged. */
export const outcomeLabel = (outcome: string): string => OUTCOME_LABELS[outcome] ?? outcome;
