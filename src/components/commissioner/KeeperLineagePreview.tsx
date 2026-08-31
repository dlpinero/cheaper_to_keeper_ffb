import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { computeKeeperOption } from '../../engine';
import { buildLineageHistory } from '../../lib/lineageHistory';
import type {
  InjuryExemptionClaim,
  KeeperLineage,
  PlayerSeason,
  Season,
} from '../../types/database';

interface Props {
  season: Season;
}

interface PreviewRow {
  playerId: string;
  playerName: string;
  teamName: string;
  currentRound: number;
  eligible: boolean;
  ineligibleReason?: string;
  nextRound: number | null;
  usesInjuryExemptionSlot: boolean;
}

export function KeeperLineagePreview({ season }: Props) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id]);

  async function load() {
    setLoading(true);

    const { data: seasons } = await supabase
      .from('seasons')
      .select('*')
      .eq('league_id', season.league_id)
      .lte('year', season.year)
      .order('year');
    const seasonYearById = new Map((seasons ?? []).map((s) => [s.id, s.year]));
    const seasonIds = (seasons ?? []).map((s) => s.id);

    const [{ data: lineage }, { data: playerSeasons }, { data: claims }, { data: players }, { data: managerSeasons }] =
      await Promise.all([
        supabase.from('keeper_lineage').select('*').in('season_id', seasonIds),
        supabase.from('player_seasons').select('*').eq('season_id', season.id),
        supabase.from('injury_exemption_claims').select('*').eq('season_id', season.id).eq('status', 'approved'),
        supabase.from('players').select('*'),
        supabase.from('manager_seasons').select('*').eq('season_id', season.id),
      ]);

    const playerName = (id: string) => players?.find((p) => p.id === id)?.full_name ?? '?';
    const teamNameFor = (managerSeasonId: string) =>
      managerSeasons?.find((ms) => ms.id === managerSeasonId)?.team_name ?? '?';

    const historyByPlayer = buildLineageHistory((lineage ?? []) as KeeperLineage[], seasonYearById);

    const approvedClaimByPlayer = new Map(
      ((claims ?? []) as InjuryExemptionClaim[]).map((c) => [c.player_id, c]),
    );

    const eligibilityByPlayer = new Map(
      ((playerSeasons ?? []) as PlayerSeason[]).map((ps) => [ps.player_id, ps]),
    );

    const previewRows: PreviewRow[] = [];
    for (const [playerId, history] of historyByPlayer.entries()) {
      const latest = history[history.length - 1];
      if (latest.seasonYear !== season.year) continue; // not on a roster this season

      const ps = eligibilityByPlayer.get(playerId);
      const claim = approvedClaimByPlayer.get(playerId);
      const eligibility = {
        rosterContinuityEligible: ps?.roster_continuity_eligible ?? true,
        gamesMissed: ps?.games_missed_injury ?? 0,
        injuryExemptionApproved: Boolean(claim),
      };

      const result = computeKeeperOption({ playerId, history }, eligibility);
      const managerSeasonId = (lineage ?? []).find(
        (l) => l.player_id === playerId && seasonYearById.get(l.season_id) === season.year,
      )?.manager_season_id;

      previewRows.push({
        playerId,
        playerName: playerName(playerId),
        teamName: managerSeasonId ? teamNameFor(managerSeasonId) : '?',
        currentRound: latest.slotRound,
        eligible: result.eligible,
        ineligibleReason: result.ineligibleReason,
        nextRound: result.keeperSlotRound,
        usesInjuryExemptionSlot: result.usesInjuryExemptionSlot,
      });
    }

    previewRows.sort((a, b) => a.teamName.localeCompare(b.teamName) || a.playerName.localeCompare(b.playerName));
    setRows(previewRows);
    setLoading(false);
  }

  return (
    <section>
      <h2>Keeper preview for next season (read-only)</h2>
      <p>
        Computed by the calc engine from real lineage + roster-continuity/injury data. Enter draft
        picks and roster-continuity data first, then check here.
      </p>
      {loading ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p>No rostered players with lineage history for {season.year} yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Player</th>
              <th>Current round</th>
              <th>Keeper-eligible next year?</th>
              <th>Next round</th>
              <th>Uses injury exemption</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.playerId}>
                <td>{r.teamName}</td>
                <td>{r.playerName}</td>
                <td>{r.currentRound}</td>
                <td>{r.eligible ? 'Yes' : `No (${r.ineligibleReason})`}</td>
                <td>{r.eligible ? r.nextRound : '—'}</td>
                <td>{r.eligible && r.usesInjuryExemptionSlot ? 'Yes' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
