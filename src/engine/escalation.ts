import type { FloorRule } from './types';

/** Rules 4/5: escalation bracket, evaluated fresh each year off the reference round
 *  (which is last year's slot for repeat keepers, per rule 8's compounding requirement). */
export function escalateRound(referenceRound: number): number {
  if (referenceRound <= 3) {
    throw new Error('escalateRound should not be called for a reference round <= 3 (see rule 3)');
  }
  if (referenceRound <= 7) return referenceRound - 1;
  return referenceRound - 2;
}

const ESCALATION_FLOOR = 3;

/** Rule 9 (flagged assumption, not directly confirmed by the user): once escalation computes
 *  a round <= 3, it locks there permanently rather than continuing to escalate — the same
 *  mechanic as the rounds 1-3 injury lock, just entered via compounding instead of injury.
 *  Kept swappable so this is a one-line change if the assumption turns out to be wrong. */
export const defaultFloorRule: FloorRule = {
  apply(round: number) {
    if (round <= ESCALATION_FLOOR) return { round: ESCALATION_FLOOR, locked: true };
    return { round, locked: false };
  },
};
