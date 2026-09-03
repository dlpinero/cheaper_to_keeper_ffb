/** Rules 4/5: escalation bracket, evaluated fresh each year off the reference round
 *  (which is last year's slot for repeat keepers, per rule 8's compounding requirement).
 *  Never called for a reference round <= 3 — those go through rule 3's exemption gate
 *  instead, including a round reached by escalation compounding down to exactly 3 (confirmed:
 *  once escalation lands on round 3, it falls under the rounds 1-3 rules the following year). */
export function escalateRound(referenceRound: number): number {
  if (referenceRound <= 3) {
    throw new Error('escalateRound should not be called for a reference round <= 3 (see rule 3)');
  }
  if (referenceRound <= 7) return referenceRound - 1;
  return referenceRound - 2;
}
