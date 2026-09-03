export type KeeperOrigin = 'drafted' | 'kept_normal' | 'kept_injury_exempt';

/** One season's keeper/draft record for a player, on a given manager's roster. */
export interface LineageEntry {
  playerId: string;
  seasonYear: number;
  slotRound: number;
  origin: KeeperOrigin;
  /** Always false — kept only for backward-compat with existing rows/UI. Nothing in the
   *  ruleset locks a round permanently: rounds 1-3 (however reached) require requalifying for
   *  the injury exemption every year, and round 4+ escalation never stops on its own. */
  lockedForever: boolean;
}

export interface EligibilityInput {
  rosterContinuityEligible: boolean;
  gamesMissed: number;
  injuryExemptionApproved: boolean;
}

export type IneligibleReason =
  | 'not_roster_continuous'
  | 'rounds_1_3_not_exempt'
  | 'no_lineage_history';

export interface KeeperOption {
  playerId: string;
  eligible: boolean;
  ineligibleReason?: IneligibleReason;
  keeperSlotRound: number | null;
  usesInjuryExemptionSlot: boolean;
  lockedForever: boolean;
}

export interface KeeperCandidateInput {
  playerId: string;
  /** Full lineage history for this player on this manager's roster; the engine always reads
   *  the most recent entry, never the player's original draft round directly (rule 8). */
  history: LineageEntry[];
  /** Only used when history is empty (player was never drafted). */
  adpRoundForNextDraft?: number;
}
