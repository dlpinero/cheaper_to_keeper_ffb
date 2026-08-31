import type { EligibilityInput } from './types';

/** Rule 1: must be rostered continuously from the last day of the regular season through the
 *  end of the playoffs. The actual date-range check happens upstream (commissioner/manager
 *  attestation in v1); the engine just enforces it as an absolute gate ahead of every other rule. */
export function isRosterContinuityEligible(input: Pick<EligibilityInput, 'rosterContinuityEligible'>): boolean {
  return input.rosterContinuityEligible;
}
