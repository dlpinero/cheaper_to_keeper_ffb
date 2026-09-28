import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { CollapsibleSection } from '../CollapsibleSection';
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
  function isDefense(playerId: string) {
    return players.find((p) => p.id === playerId)?.position === 'DEF';
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

  // A claim is a manager's way of flagging a player the commissioner hasn't already granted the
  // exemption to. Once games_missed_injury hits 8+, the exemption is already in effect on its
  // own — filing a claim for a player in that state would be redundant, so only offer it for
  // players not already exempt. Defenses never qualify for the injury exemption, so exclude them.
  const notYetExempt = playerSeasons.filter(
    (ps) => ps.games_missed_injury < 8 && !isDefense(ps.player_id),
  );

  return (
    <CollapsibleSection
      title="Injury exemption"
      description="If you believe a player on your roster missed 8+ regular season games (weeks 1-14) to injury but hasn't been granted the exemption, file a request below for the commissioner to review. Players already showing 8+ games missed already have the exemption automatically and don't need a request."
    >
      {notYetExempt.length === 0 ? (
        <p>Every player on your roster already has the correct exemption status recorded.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Games missed (recorded)</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {notYetExempt.map((ps) => {
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
    </CollapsibleSection>
  );
}
