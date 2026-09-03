import { getReferenceLineageEntry } from './referenceRound';
import { isRosterContinuityEligible } from './rosterContinuity';
import { requiresInjuryExemption } from './rounds1to3Exemption';
import { escalateRound } from './escalation';
import { qualifiesForInjuryExemption } from './injuryExemption';
import type { EligibilityInput, KeeperCandidateInput, KeeperOption } from './types';

/** The draft only has 16 rounds — rule 7's ADP + 2 can't produce a round beyond that. */
const MAX_DRAFT_ROUND = 16;

function ineligible(
  playerId: string,
  reason: KeeperOption['ineligibleReason'],
): KeeperOption {
  return {
    playerId,
    eligible: false,
    ineligibleReason: reason,
    keeperSlotRound: null,
    usesInjuryExemptionSlot: false,
    lockedForever: false,
  };
}

export function computeKeeperOption(
  input: KeeperCandidateInput,
  eligibility: EligibilityInput,
): KeeperOption {
  if (!isRosterContinuityEligible(eligibility)) {
    return ineligible(input.playerId, 'not_roster_continuous');
  }

  const exemptionQualifies =
    qualifiesForInjuryExemption(eligibility.gamesMissed) && eligibility.injuryExemptionApproved;

  const reference = getReferenceLineageEntry(input.history);

  if (reference) {
    const referenceRound = reference.slotRound;

    // Rule 3: a round <= 3 — whether an original draft pick, a prior exemption keep, or
    // reached via ordinary escalation compounding (rule 4/5) down to round 3 — requires
    // requalifying for the injury exemption every single year. The exemption never carries
    // forward, so this is never a one-time unlock and there is no permanent lock.
    if (requiresInjuryExemption(referenceRound)) {
      if (!exemptionQualifies) {
        return ineligible(input.playerId, 'rounds_1_3_not_exempt');
      }
      return {
        playerId: input.playerId,
        eligible: true,
        keeperSlotRound: referenceRound,
        usesInjuryExemptionSlot: true,
        lockedForever: false,
      };
    }

    // Rule 6: an approved injury exemption freezes the round for this keeper year only —
    // escalation resumes normally next year off this same round as the new reference.
    if (exemptionQualifies) {
      return {
        playerId: input.playerId,
        eligible: true,
        keeperSlotRound: referenceRound,
        usesInjuryExemptionSlot: true,
        lockedForever: false,
      };
    }

    return {
      playerId: input.playerId,
      eligible: true,
      keeperSlotRound: escalateRound(referenceRound),
      usesInjuryExemptionSlot: false,
      lockedForever: false,
    };
  }

  // Undrafted player (rule 7) — no lineage yet, slot off next draft's ADP instead.
  if (input.adpRoundForNextDraft !== undefined) {
    return {
      playerId: input.playerId,
      eligible: true,
      keeperSlotRound: Math.min(input.adpRoundForNextDraft + 2, MAX_DRAFT_ROUND),
      usesInjuryExemptionSlot: exemptionQualifies,
      lockedForever: false,
    };
  }

  return ineligible(input.playerId, 'no_lineage_history');
}

export * from './types';
export { getReferenceLineageEntry } from './referenceRound';
export { isRosterContinuityEligible } from './rosterContinuity';
export { requiresInjuryExemption, EXEMPT_ROUNDS_MAX } from './rounds1to3Exemption';
export { escalateRound } from './escalation';
export { qualifiesForInjuryExemption, INJURY_EXEMPTION_MIN_GAMES_MISSED } from './injuryExemption';
export {
  validateKeeperSelection,
  NORMAL_KEEPER_CAP,
  MAX_KEEPER_CAP,
} from './validateSelection';
export type { SelectionPick, SelectionValidationResult } from './validateSelection';
