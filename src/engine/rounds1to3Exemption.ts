export const EXEMPT_ROUNDS_MAX = 3;

/** Rule 3: a reference round of 1-3 can only be kept via the injury exemption. */
export function requiresInjuryExemption(referenceRound: number): boolean {
  return referenceRound <= EXEMPT_ROUNDS_MAX;
}
