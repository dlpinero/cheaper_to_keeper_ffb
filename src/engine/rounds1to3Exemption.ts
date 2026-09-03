export const EXEMPT_ROUNDS_MAX = 3;

/** Rule 3: a reference round of 1-3 — however reached (an original draft pick, a prior
 *  exemption keep, or ordinary escalation compounding down to round 3) — can only be kept by
 *  requalifying for the injury exemption *this* year. The exemption never carries forward, so
 *  this is checked fresh every year; it is never a one-time unlock. */
export function requiresInjuryExemption(referenceRound: number): boolean {
  return referenceRound <= EXEMPT_ROUNDS_MAX;
}
