import { describe, expect, it } from 'vitest';
import { buildKeeperCandidates } from '../keeperCandidates';
import type { KeeperLineage, Player, PlayerAdp, PlayerSeason } from '../../types/database';

const SEASON = 's2025';
const seasonYearById = new Map([[SEASON, 2025]]);

const players = (['p1', 'p2', 'p3']).map(
  (id) => ({ id, full_name: `Player ${id}` }) as Player,
);

function drafted(playerId: string, managerSeasonId: string, round: number): KeeperLineage {
  return {
    id: `l-${playerId}`,
    player_id: playerId,
    season_id: SEASON,
    manager_season_id: managerSeasonId,
    slot_round: round,
    origin: 'drafted',
    locked_forever: false,
    derived_from_lineage_id: null,
    created_at: '',
  };
}

function checkpoint(
  playerId: string,
  managerSeasonId: string,
  continuous: boolean,
  gamesMissed = 0,
): PlayerSeason {
  return {
    id: `ps-${playerId}`,
    season_id: SEASON,
    manager_season_id: managerSeasonId,
    player_id: playerId,
    games_missed_injury: gamesMissed,
    roster_continuity_eligible: continuous,
    notes: null,
    created_at: '',
  };
}

function adp(playerId: string, round: number): PlayerAdp {
  return {
    id: `adp-${playerId}`,
    season_id: SEASON,
    player_id: playerId,
    adp_round: round,
    source: 'manual',
    created_at: '',
  };
}

function build(opts: {
  lineage?: KeeperLineage[];
  playerSeasons?: PlayerSeason[];
  adp?: PlayerAdp[];
}) {
  return buildKeeperCandidates({
    seasonId: SEASON,
    seasonYearById,
    lineage: opts.lineage ?? [],
    playerSeasons: opts.playerSeasons ?? [],
    players,
    adp: opts.adp ?? [],
  });
}

describe('buildKeeperCandidates', () => {
  it('a drafted player still on the roster through week 17 escalates from his draft round', () => {
    const [row] = build({
      lineage: [drafted('p1', 'A', 8)],
      playerSeasons: [checkpoint('p1', 'A', true)],
    });
    expect(row).toMatchObject({ managerSeasonId: 'A', eligible: true, keeperSlotRound: 6, currentRound: 8 });
  });

  it('a drafted player dropped in weeks 15-17 (or before week 14) is not eligible', () => {
    const [row] = build({
      lineage: [drafted('p1', 'A', 8)],
      playerSeasons: [checkpoint('p1', 'A', false)],
    });
    expect(row).toMatchObject({
      managerSeasonId: 'A',
      eligible: false,
      ineligibleReason: 'not_roster_continuous',
    });
  });

  it('a traded player belongs to whoever held him at the checkpoint, keeping his draft round', () => {
    const rows = build({
      lineage: [drafted('p1', 'A', 5)],
      playerSeasons: [checkpoint('p1', 'B', true)],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ managerSeasonId: 'B', eligible: true, keeperSlotRound: 4, currentRound: 5 });
  });

  it('an undrafted pickup held through week 17 uses next draft ADP + 2', () => {
    const [row] = build({
      playerSeasons: [checkpoint('p2', 'A', true)],
      adp: [adp('p2', 5)],
    });
    expect(row).toMatchObject({ managerSeasonId: 'A', eligible: true, keeperSlotRound: 7, currentRound: null });
  });

  it('an undrafted pickup with no ADP yet is held back as adp_pending, not ineligible for roster reasons', () => {
    const [row] = build({ playerSeasons: [checkpoint('p2', 'A', true)] });
    expect(row).toMatchObject({ eligible: false, ineligibleReason: 'adp_pending', keeperSlotRound: null });
  });

  it('an undrafted pickup dropped before week 17 is not eligible', () => {
    const [row] = build({
      playerSeasons: [checkpoint('p2', 'A', false)],
      adp: [adp('p2', 5)],
    });
    expect(row).toMatchObject({ eligible: false, ineligibleReason: 'not_roster_continuous' });
  });

  it('a player with no draft and no checkpoint record never appears', () => {
    expect(build({})).toEqual([]);
  });

  it('games_missed_injury >= 8 on the checkpoint alone grants the exemption — no claim involved', () => {
    const [row] = build({
      lineage: [drafted('p1', 'A', 2)],
      playerSeasons: [checkpoint('p1', 'A', true, 8)],
    });
    expect(row).toMatchObject({ eligible: true, keeperSlotRound: 2, usesInjuryExemptionSlot: true });
  });
});
