import { computeKeeperOption } from '../engine';
import { buildLineageHistory } from './lineageHistory';
import type { KeeperLineage, Player, PlayerAdp, PlayerSeason } from '../types/database';

export interface KeeperCandidateRow {
  playerId: string;
  playerName: string;
  /** The manager_season that holds the player at the end-of-week-14 checkpoint. */
  managerSeasonId: string;
  /** This season's slot round; null for a player who was never drafted. */
  currentRound: number | null;
  eligible: boolean;
  ineligibleReason?: string;
  keeperSlotRound: number | null;
  usesInjuryExemptionSlot: boolean;
}

interface BuildInput {
  seasonId: string;
  seasonYearById: Map<string, number>;
  lineage: KeeperLineage[];
  /** Every manager's checkpoint records for this season. */
  playerSeasons: PlayerSeason[];
  players: Player[];
  /** player_adp rows for this season (they predict the next draft). */
  adp: PlayerAdp[];
}

/**
 * The draft only sets a player's round and initial eligibility. Final eligibility comes
 * from the roster checkpoint: a `player_seasons` row says who held the player at the end
 * of week 14 (`manager_season_id`) and whether he stayed on that roster through week 17
 * (`roster_continuity_eligible`). A checkpoint row therefore overrides the drafting
 * manager, so traded players follow their holder and undrafted pickups become candidates.
 * A player with neither a checkpoint row nor a lineage entry never appears.
 */
export function buildKeeperCandidates(input: BuildInput): KeeperCandidateRow[] {
  const historyByPlayer = buildLineageHistory(input.lineage, input.seasonYearById);
  const checkpointByPlayer = new Map(input.playerSeasons.map((ps) => [ps.player_id, ps]));
  const adpByPlayer = new Map(input.adp.map((a) => [a.player_id, a.adp_round]));
  const nameById = new Map(input.players.map((p) => [p.id, p.full_name]));

  const draftedThisSeason = new Map<string, KeeperLineage>();
  for (const entry of input.lineage) {
    if (entry.season_id === input.seasonId) draftedThisSeason.set(entry.player_id, entry);
  }

  const playerIds = new Set([...draftedThisSeason.keys(), ...checkpointByPlayer.keys()]);
  const rows: KeeperCandidateRow[] = [];

  for (const playerId of playerIds) {
    const checkpoint = checkpointByPlayer.get(playerId);
    const drafted = draftedThisSeason.get(playerId);
    const managerSeasonId = checkpoint?.manager_season_id ?? drafted?.manager_season_id;
    if (!managerSeasonId) continue;

    const history = historyByPlayer.get(playerId) ?? [];
    const result = computeKeeperOption(
      {
        playerId,
        history,
        adpRoundForNextDraft: history.length === 0 ? adpByPlayer.get(playerId) : undefined,
      },
      {
        rosterContinuityEligible: checkpoint?.roster_continuity_eligible ?? true,
        gamesMissed: checkpoint?.games_missed_injury ?? 0,
      },
    );

    // An undrafted player who stayed on the roster is eligible, but his slot can't be
    // computed until next draft's ADP exists — say so instead of calling him ineligible.
    const ineligibleReason =
      result.ineligibleReason === 'no_lineage_history' ? 'adp_pending' : result.ineligibleReason;

    rows.push({
      playerId,
      playerName: nameById.get(playerId) ?? '?',
      managerSeasonId,
      currentRound: drafted ? drafted.slot_round : null,
      eligible: result.eligible,
      ineligibleReason,
      keeperSlotRound: result.keeperSlotRound,
      usesInjuryExemptionSlot: result.usesInjuryExemptionSlot,
    });
  }

  return rows;
}
