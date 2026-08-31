import { getReferenceLineageEntry } from './referenceRound';
import { isRosterContinuityEligible } from './rosterContinuity';
import { requiresInjuryExemption } from './rounds1to3Exemption';
import { escalateRound, defaultFloorRule } from './escalation';
import { qualifiesForInjuryExemption } from './injuryExemption';
import type { EligibilityInput, FloorRule, KeeperCandidateInput, KeeperOption } from './types';

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
  floorRule: FloorRule = defaultFloorRule,
): KeeperOption {
  if (!isRosterContinuityEligible(eligibility)) {
    return ineligible(input.playerId, 'not_roster_continuous');
  }

  const exemptionQualifies =
    qualifiesForInjuryExemption(eligibility.gamesMissed) && eligibility.injuryExemptionApproved;

  const reference = getReferenceLineageEntry(input.history);

  // Already locked (rounds 1-3 injury lock, or a prior escalation-floor lock) — the round is
  // frozen forever and does not require re-qualifying for the exemption each year.
  if (reference?.lockedForever) {
    return {
      playerId: input.playerId,
      eligible: true,
      keeperSlotRound: reference.slotRound,
      usesInjuryExemptionSlot: reference.origin === 'kept_injury_exempt',
      lockedForever: true,
    };
  }

  if (reference) {
    const referenceRound = reference.slotRound;

    if (requiresInjuryExemption(referenceRound)) {
      if (!exemptionQualifies) {
        return ineligible(input.playerId, 'rounds_1_3_not_exempt');
      }
      return {
        playerId: input.playerId,
        eligible: true,
        keeperSlotRound: referenceRound,
        usesInjuryExemptionSlot: true,
        lockedForever: true,
      };
    }

    const floored = floorRule.apply(escalateRound(referenceRound));
    return {
      playerId: input.playerId,
      eligible: true,
      keeperSlotRound: floored.round,
      usesInjuryExemptionSlot: exemptionQualifies,
      lockedForever: floored.locked,
    };
  }

  // Undrafted player (rule 7) — no lineage yet, slot off next draft's ADP instead.
  if (input.adpRoundForNextDraft !== undefined) {
    const floored = floorRule.apply(input.adpRoundForNextDraft + 2);
    return {
      playerId: input.playerId,
      eligible: true,
      keeperSlotRound: floored.round,
      usesInjuryExemptionSlot: exemptionQualifies,
      lockedForever: floored.locked,
    };
  }

  return ineligible(input.playerId, 'no_lineage_history');
}

export * from './types';
export { getReferenceLineageEntry } from './referenceRound';
export { isRosterContinuityEligible } from './rosterContinuity';
export { requiresInjuryExemption, EXEMPT_ROUNDS_MAX } from './rounds1to3Exemption';
export { escalateRound, defaultFloorRule } from './escalation';
export { qualifiesForInjuryExemption, INJURY_EXEMPTION_MIN_GAMES_MISSED } from './injuryExemption';
export {
  validateKeeperSelection,
  NORMAL_KEEPER_CAP,
  MAX_KEEPER_CAP,
} from './validateSelection';
export type { SelectionPick, SelectionValidationResult } from './validateSelection';
