import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type {
  InjuryExemptionClaim,
  KeeperLineage,
  ManagerSeason,
  Player,
  PlayerSeason,
  Season,
} from '../../types/database';

interface Props {
  season: Season;
}

export function InjuryClaimsPanel({ season }: Props) {
  const [playerSeasons, setPlayerSeasons] = useState<PlayerSeason[]>([]);
  const [claims, setClaims] = useState<InjuryExemptionClaim[]>([]);
  const [managerSeasons, setManagerSeasons] = useState<ManagerSeason[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [lineage, setLineage] = useState<KeeperLineage[]>([]);

  const [managerSeasonId, setManagerSeasonId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [gamesMissed, setGamesMissed] = useState(0);
  const [continuityEligible, setContinuityEligible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [{ data: ps }, { data: c }, { data: ms }, { data: pl }, { data: lin }] = await Promise.all([
      supabase.from('player_seasons').select('*').eq('season_id', season.id),
      supabase.from('injury_exemption_claims').select('*').eq('season_id', season.id),
      supabase.from('manager_seasons').select('*').eq('season_id', season.id).eq('is_active', true),
      supabase.from('players').select('*').order('full_name'),
      supabase.from('keeper_lineage').select('*').eq('season_id', season.id),
    ]);
    setPlayerSeasons(ps ?? []);
    setClaims(c ?? []);
    setManagerSeasons(ms ?? []);
    setPlayers(pl ?? []);
    setLineage((lin ?? []) as KeeperLineage[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id]);

  useEffect(() => {
    setPlayerId('');
  }, [managerSeasonId]);

  async function upsertPlayerSeason(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: upsertErr } = await supabase.from('player_seasons').upsert(
      {
        season_id: season.id,
        manager_season_id: managerSeasonId,
        player_id: playerId,
        games_missed_injury: gamesMissed,
        roster_continuity_eligible: continuityEligible,
      },
      { onConflict: 'season_id,player_id' },
    );
    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }
    setGamesMissed(0);
    load();
  }

  async function fileClaimForRecord(ps: PlayerSeason) {
    setError(null);
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) return;
    const { data: manager } = await supabase
      .from('managers')
      .select('*')
      .eq('user_id', authUser.user.id)
      .maybeSingle();
    if (!manager) return;
    const { error: insertErr } = await supabase.from('injury_exemption_claims').insert({
      season_id: season.id,
      manager_season_id: ps.manager_season_id,
      player_id: ps.player_id,
      games_missed: ps.games_missed_injury,
      claimed_by_manager_id: manager.id,
      status: 'pending',
    });
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    load();
  }

  async function reviewClaim(claim: InjuryExemptionClaim, status: 'approved' | 'denied') {
    setError(null);
    const { error: updateErr } = await supabase
      .from('injury_exemption_claims')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', claim.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    load();
  }

  function teamName(managerSeasonId: string) {
    return managerSeasons.find((ms) => ms.id === managerSeasonId)?.team_name ?? '?';
  }
  function playerName(playerId: string) {
    return players.find((p) => p.id === playerId)?.full_name ?? '?';
  }

  // Only offer players actually on the selected team's roster this season, via keeper_lineage.
  const rosterPlayers = managerSeasonId
    ? players.filter((p) =>
        lineage.some((l) => l.manager_season_id === managerSeasonId && l.player_id === p.id),
      )
    : [];

  return (
    <section>
      <h2>Roster continuity &amp; injury data — {season.year}</h2>
      <p>
        Games missed and roster-continuity eligibility feed the keeper engine directly. Rule 1:
        continuity is absolute — dropping a player at any point during the playoffs disqualifies
        him as a keeper, even under the injury exemption.
      </p>
      <form onSubmit={upsertPlayerSeason} className="inline-form">
        <label htmlFor="ps-team">Team</label>
        <select id="ps-team" required value={managerSeasonId} onChange={(e) => setManagerSeasonId(e.target.value)}>
          <option value="">Select team</option>
          {managerSeasons.map((ms) => (
            <option key={ms.id} value={ms.id}>
              {ms.team_name}
            </option>
          ))}
        </select>
        <label htmlFor="ps-player">Player</label>
        <select
          id="ps-player"
          required
          disabled={!managerSeasonId}
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
        >
          <option value="">{managerSeasonId ? 'Select player' : 'Select a team first'}</option>
          {rosterPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
        <label htmlFor="games-missed">Games missed (injury)</label>
        <input
          id="games-missed"
          type="number"
          min={0}
          value={gamesMissed}
          onChange={(e) => setGamesMissed(Number(e.target.value))}
        />
        <label>
          <input
            type="checkbox"
            checked={continuityEligible}
            onChange={(e) => setContinuityEligible(e.target.checked)}
          />
          Roster-continuous through playoffs
        </label>
        <button type="submit">Save</button>
      </form>
      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Team</th>
            <th>Player</th>
            <th>Games missed</th>
            <th>Continuity OK</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {playerSeasons.map((ps) => (
            <tr key={ps.id}>
              <td>{teamName(ps.manager_season_id)}</td>
              <td>{playerName(ps.player_id)}</td>
              <td>{ps.games_missed_injury}</td>
              <td>{ps.roster_continuity_eligible ? 'Yes' : 'No'}</td>
              <td>
                {ps.games_missed_injury >= 8 && (
                  <button onClick={() => fileClaimForRecord(ps)}>File injury exemption claim</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Injury exemption claims</h3>
      <table>
        <thead>
          <tr>
            <th>Team</th>
            <th>Player</th>
            <th>Games missed</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c.id}>
              <td>{teamName(c.manager_season_id)}</td>
              <td>{playerName(c.player_id)}</td>
              <td>{c.games_missed}</td>
              <td>{c.status}</td>
              <td>
                {c.status === 'pending' && (
                  <>
                    <button onClick={() => reviewClaim(c, 'approved')}>Approve</button>
                    <button onClick={() => reviewClaim(c, 'denied')}>Deny</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
