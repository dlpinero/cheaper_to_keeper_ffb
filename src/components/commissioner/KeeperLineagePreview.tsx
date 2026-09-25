import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { buildKeeperCandidates } from '../../lib/keeperCandidates';
import type { KeeperLineage, PlayerSeason, Season } from '../../types/database';

interface Props {
  season: Season;
}

interface PreviewRow {
  playerId: string;
  playerName: string;
  teamName: string;
  currentRound: number | null;
  eligible: boolean;
  ineligibleReason?: string;
  nextRound: number | null;
  usesInjuryExemptionSlot: boolean;
}

type SortKey = 'team' | 'round';

export function KeeperLineagePreview({ season }: Props) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('team');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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

    const [
      { data: lineage },
      { data: playerSeasons },
      { data: players },
      { data: managerSeasons },
      { data: adp },
    ] = await Promise.all([
      supabase.from('keeper_lineage').select('*').in('season_id', seasonIds),
      supabase.from('player_seasons').select('*').eq('season_id', season.id),
      supabase.from('players').select('*'),
      supabase.from('manager_seasons').select('*').eq('season_id', season.id),
      supabase.from('player_adp').select('*').eq('season_id', season.id),
    ]);

    const teamNameFor = (managerSeasonId: string) =>
      managerSeasons?.find((ms) => ms.id === managerSeasonId)?.team_name ?? '?';

    const previewRows: PreviewRow[] = buildKeeperCandidates({
      seasonId: season.id,
      seasonYearById,
      lineage: (lineage ?? []) as KeeperLineage[],
      playerSeasons: (playerSeasons ?? []) as PlayerSeason[],
      players: players ?? [],
      adp: adp ?? [],
    }).map((c) => ({
      playerId: c.playerId,
      playerName: c.playerName,
      teamName: teamNameFor(c.managerSeasonId),
      currentRound: c.currentRound,
      eligible: c.eligible,
      ineligibleReason: c.ineligibleReason,
      nextRound: c.keeperSlotRound,
      usesInjuryExemptionSlot: c.usesInjuryExemptionSlot,
    }));

    previewRows.sort((a, b) => a.teamName.localeCompare(b.teamName) || a.playerName.localeCompare(b.playerName));
    setRows(previewRows);
    setLoading(false);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  const sortedRows = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'round') {
      cmp =
        (a.nextRound ?? Infinity) - (b.nextRound ?? Infinity) ||
        (a.currentRound ?? 99) - (b.currentRound ?? 99);
    } else {
      cmp = a.teamName.localeCompare(b.teamName) || a.playerName.localeCompare(b.playerName);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <section>
      <h2>Keeper preview for next season (read-only)</h2>
      <p>
        Computed by the calc engine. The draft sets each player's round; the end-of-week-14 roster
        (held through week 17) decides who is actually eligible and which team holds him. Enter
        draft picks and the roster checkpoint first, then check here.
      </p>
      {loading ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p>No players recorded on {season.year} rosters yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort('team')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Team{sortArrow('team')}
              </th>
              <th>Player</th>
              <th onClick={() => toggleSort('round')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                {season.year + 1} round if kept{sortArrow('round')}
              </th>
              <th>Keeper-eligible next year?</th>
              <th>{season.year} round</th>
              <th>Uses injury exemption</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.playerId}>
                <td>{r.teamName}</td>
                <td>{r.playerName}</td>
                <td>{r.eligible ? r.nextRound : '—'}</td>
                <td>{r.eligible ? 'Yes' : `No (${r.ineligibleReason})`}</td>
                <td>{r.currentRound ?? 'Undrafted'}</td>
                <td>{r.eligible && r.usesInjuryExemptionSlot ? 'Yes' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
