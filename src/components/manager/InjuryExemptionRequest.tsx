import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { InjuryExemptionClaim, ManagerSeason, Player, PlayerSeason, Season } from '../../types/database';

interface Props {
  season: Season;
  managerSeason: ManagerSeason;
  managerId: string;
}

export function InjuryExemptionRequest({ season, managerSeason, managerId }: Props) {
  const [playerSeasons, setPlayerSeasons] = useState<PlayerSeason[]>([]);
  const [claims, setClaims] = useState<InjuryExemptionClaim[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [filingFor, setFilingFor] = useState<string | null>(null);

  async function load() {
    const [{ data: ps }, { data: c }, { data: pl }] = await Promise.all([
      supabase
        .from('player_seasons')
        .select('*')
        .eq('season_id', season.id)
        .eq('manager_season_id', managerSeason.id),
      supabase
        .from('injury_exemption_claims')
        .select('*')
        .eq('season_id', season.id)
        .eq('manager_season_id', managerSeason.id),
      supabase.from('players').select('*'),
    ]);
    setPlayerSeasons(ps ?? []);
    setClaims((c ?? []) as InjuryExemptionClaim[]);
    setPlayers(pl ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id, managerSeason.id]);

  function playerName(playerId: string) {
    return players.find((p) => p.id === playerId)?.full_name ?? '?';
  }
  function claimFor(playerId: string) {
    return claims.find((c) => c.player_id === playerId);
  }

  async function requestReview(ps: PlayerSeason) {
    setFilingFor(ps.player_id);
    await supabase.from('injury_exemption_claims').insert({
      season_id: season.id,
      manager_season_id: managerSeason.id,
      player_id: ps.player_id,
      games_missed: ps.games_missed_injury,
      claimed_by_manager_id: managerId,
      status: 'pending',
    });
    setFilingFor(null);
    load();
  }

  const eligible = playerSeasons.filter((ps) => ps.games_missed_injury >= 8);

  return (
    <section>
      <h2>Injury exemption</h2>
      <p>
        Players on your roster the commissioner has recorded as missing 8+ games to injury this
        season. Request a review to ask the commissioner to grant the exemption.
      </p>
      {eligible.length === 0 ? (
        <p>No players on your roster currently show 8+ games missed to injury.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Games missed</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {eligible.map((ps) => {
              const claim = claimFor(ps.player_id);
              return (
                <tr key={ps.id}>
                  <td>{playerName(ps.player_id)}</td>
                  <td>{ps.games_missed_injury}</td>
                  <td>{claim ? claim.status : 'Not requested'}</td>
                  <td>
                    {!claim && (
                      <button disabled={filingFor === ps.player_id} onClick={() => requestReview(ps)}>
                        Request review
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
