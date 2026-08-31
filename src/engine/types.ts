export type KeeperOrigin = 'drafted' | 'kept_normal' | 'kept_injury_exempt';

/** One season's keeper/draft record for a player, on a given manager's roster. */
export interface LineageEntry {
  playerId: string;
  seasonYear: number;
  slotRound: number;
  origin: KeeperOrigin;
  /** True once a round is frozen forever (rounds 1-3 injury lock, or the rule-9 escalation floor). */
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

/** Isolates the rule-9 floor assumption so it's a one-line swap if the assumption is wrong. */
export interface FloorRule {
  apply(round: number): { round: number; locked: boolean };
}

export interface KeeperCandidateInput {
  playerId: string;
  /** Full lineage history for this player on this manager's roster; the engine always reads
   *  the most recent entry, never the player's original draft round directly (rule 8). */
  history: LineageEntry[];
  /** Only used when history is empty (player was never drafted). */
  adpRoundForNextDraft?: number;
}
