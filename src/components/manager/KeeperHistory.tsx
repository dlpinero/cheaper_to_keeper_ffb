import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { CollapsibleSection } from '../CollapsibleSection';
import type { Manager, Season } from '../../types/database';

interface Props {
  manager: Manager;
}

interface KeeperRow {
  teamName: string;
  isOwnTeam: boolean;
  playerName: string;
  round: number;
}

export function KeeperHistory({ manager }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [rows, setRows] = useState<KeeperRow[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [ownFranchiseId, setOwnFranchiseId] = useState<string | null>(null);

  useEffect(() => {
    loadSeasons();
    loadOwnFranchise();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager.league_id]);

  async function loadSeasons() {
    setSeasonsLoading(true);
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('league_id', manager.league_id)
      .neq('status', 'setup')
      .order('year', { ascending: false });
    const list = data ?? [];
    setSeasons(list);
    setSelectedSeasonId(list.length > 0 ? list[0].id : null);
    setSeasonsLoading(false);
  }

  // "Own team" is tracked by franchise, not by manager_id, so a manager sees their team's full
  // history even for years before they personally took over the seat — see
  // supabase/migrations/0009_franchises.sql. Any one of the viewer's own manager_seasons rows
  // carries the current franchise_id (they all point at the same one).
  async function loadOwnFranchise() {
    const { data } = await supabase
      .from('manager_seasons')
      .select('franchise_id')
      .eq('manager_id', manager.id)
      .not('franchise_id', 'is', null)
      .limit(1);
    setOwnFranchiseId(data?.[0]?.franchise_id ?? null);
  }

  useEffect(() => {
    if (selectedSeasonId) loadYear(selectedSeasonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeasonId, ownFranchiseId]);

  async function loadYear(seasonId: string) {
    setRowsLoading(true);
    const [{ data: picks }, { data: managerSeasons }, { data: players }] = await Promise.all([
      supabase.from('draft_picks').select('*').eq('season_id', seasonId).eq('is_keeper_pick', true),
      supabase.from('manager_seasons').select('*').eq('season_id', seasonId),
      supabase.from('players').select('*'),
    ]);

    const teamNameById = new Map((managerSeasons ?? []).map((ms) => [ms.id, ms.team_name]));
    const ownManagerSeasonIds = new Set(
      (managerSeasons ?? [])
        .filter((ms) => ownFranchiseId !== null && ms.franchise_id === ownFranchiseId)
        .map((ms) => ms.id),
    );
    const playerNameById = new Map((players ?? []).map((p) => [p.id, p.full_name]));

    const built: KeeperRow[] = (picks ?? []).map((p) => ({
      teamName: teamNameById.get(p.manager_season_id) ?? '?',
      isOwnTeam: ownManagerSeasonIds.has(p.manager_season_id),
      playerName: playerNameById.get(p.player_id) ?? '?',
      round: p.round,
    }));

    // The viewer's own team always leads the list; everyone else follows alphabetically by
    // team, then by round within a team (lowest round first).
    built.sort((a, b) => {
      if (a.isOwnTeam !== b.isOwnTeam) return a.isOwnTeam ? -1 : 1;
      return a.teamName.localeCompare(b.teamName) || a.round - b.round;
    });

    setRows(built);
    setRowsLoading(false);
  }

  if (!seasonsLoading && seasons.length === 0) return null;

  return (
    <CollapsibleSection
      title="Keeper history"
      description="Which players each team kept, and at what round, in past seasons."
    >
      {seasonsLoading ? (
        <p>Loading...</p>
      ) : (
        <>
          <nav className="tabs">
            {seasons.map((s) => (
              <button
                key={s.id}
                className={s.id === selectedSeasonId ? 'active' : ''}
                onClick={() => setSelectedSeasonId(s.id)}
              >
                {s.year}
              </button>
            ))}
          </nav>
          {rowsLoading ? (
            <p>Loading...</p>
          ) : rows.length === 0 ? (
            <p>No keeper picks recorded for this season.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Player</th>
                  <th>Round</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.isOwnTeam ? 'active-row' : ''}>
                    <td>{r.teamName}</td>
                    <td>{r.playerName}</td>
                    <td>{r.round}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}
