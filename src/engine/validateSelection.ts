export interface SelectionPick {
  playerId: string;
  eligible: boolean;
  usesInjuryExemptionSlot: boolean;
}

export interface SelectionValidationResult {
  valid: boolean;
  errors: string[];
}

export const NORMAL_KEEPER_CAP = 2;
export const MAX_KEEPER_CAP = 3;

/** Rule 2/6: max 3 keepers total, but the 3rd slot is only unlocked if at least one of the
 *  kept players is individually using the injury exemption that year. */
export function validateKeeperSelection(picks: SelectionPick[]): SelectionValidationResult {
  const errors: string[] = [];

  const seen = new Set<string>();
  for (const pick of picks) {
    if (seen.has(pick.playerId)) {
      errors.push(`Duplicate player in selection: ${pick.playerId}`);
    }
    seen.add(pick.playerId);
  }

  for (const pick of picks) {
    if (!pick.eligible) {
      errors.push(`Player ${pick.playerId} is not keeper-eligible`);
    }
  }

  if (picks.length > MAX_KEEPER_CAP) {
    errors.push(`Cannot keep more than ${MAX_KEEPER_CAP} players`);
  } else if (picks.length > NORMAL_KEEPER_CAP) {
    const hasExemptionSlot = picks.some((p) => p.usesInjuryExemptionSlot);
    if (!hasExemptionSlot) {
      errors.push(
        `Keeping more than ${NORMAL_KEEPER_CAP} players requires at least one to use the injury exemption slot`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
