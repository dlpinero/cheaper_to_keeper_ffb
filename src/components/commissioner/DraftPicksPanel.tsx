import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { DraftPick, ManagerSeason, Player, Season } from '../../types/database';

interface Props {
  season: Season;
}

export function DraftPicksPanel({ season }: Props) {
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [managerSeasons, setManagerSeasons] = useState<ManagerSeason[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  const [managerSeasonId, setManagerSeasonId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [round, setRound] = useState(1);
  const [pickInRound, setPickInRound] = useState(1);
  const [isKeeperPick, setIsKeeperPick] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [{ data: p }, { data: ms }, { data: pl }] = await Promise.all([
      supabase
        .from('draft_picks')
        .select('*')
        .eq('season_id', season.id)
        .order('overall_pick'),
      supabase.from('manager_seasons').select('*').eq('season_id', season.id).eq('is_active', true),
      supabase.from('players').select('*').order('full_name'),
    ]);
    setPicks(p ?? []);
    setManagerSeasons(ms ?? []);
    setPlayers(pl ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id]);

  const teamsPerRound = managerSeasons.length || 1;
  const draftedPlayerIds = new Set(picks.map((p) => p.player_id));
  const availablePlayers = players.filter((p) => !draftedPlayerIds.has(p.id));

  async function addPick(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const overallPick = (round - 1) * teamsPerRound + pickInRound;
    const { error: insertErr } = await supabase.from('draft_picks').insert({
      season_id: season.id,
      manager_season_id: managerSeasonId,
      player_id: playerId,
      round,
      pick_in_round: pickInRound,
      overall_pick: overallPick,
      is_keeper_pick: isKeeperPick,
      source: 'manual',
    });
    if (insertErr) {
      setError(
        insertErr.code === '23505'
          ? 'That player has already been drafted this season.'
          : insertErr.message,
      );
      return;
    }
    // A fresh (non-keeper) draft pick seeds keeper_lineage as the starting point for
    // future compounding math. A kept player's lineage entry is instead written when
    // their keeper selection is finalized (Phase 3), since origin/locking depends on
    // whether the injury exemption was used.
    if (!isKeeperPick) {
      await supabase.from('keeper_lineage').insert({
        player_id: playerId,
        season_id: season.id,
        manager_season_id: managerSeasonId,
        slot_round: round,
        origin: 'drafted',
        locked_forever: false,
      });
    }
    setPickInRound(pickInRound + 1 > teamsPerRound ? 1 : pickInRound + 1);
    if (pickInRound + 1 > teamsPerRound) setRound(round + 1);
    setPlayerId('');
    setIsKeeperPick(false);
    load();
  }

  async function removePick(pick: DraftPick) {
    await supabase.from('draft_picks').delete().eq('id', pick.id);
    load();
  }

  function teamName(managerSeasonId: string) {
    return managerSeasons.find((ms) => ms.id === managerSeasonId)?.team_name ?? '?';
  }

  function playerName(playerId: string) {
    return players.find((p) => p.id === playerId)?.full_name ?? '?';
  }

  return (
    <section>
      <h2>Draft Picks — {season.year}</h2>
      <form onSubmit={addPick} className="inline-form">
        <label htmlFor="round">Round</label>
        <input
          id="round"
          type="number"
          min={1}
          value={round}
          onChange={(e) => setRound(Number(e.target.value))}
        />
        <label htmlFor="pick">Pick in round</label>
        <input
          id="pick"
          type="number"
          min={1}
          value={pickInRound}
          onChange={(e) => setPickInRound(Number(e.target.value))}
        />
        <label htmlFor="team">Team</label>
        <select
          id="team"
          required
          value={managerSeasonId}
          onChange={(e) => setManagerSeasonId(e.target.value)}
        >
          <option value="">Select team</option>
          {managerSeasons.map((ms) => (
            <option key={ms.id} value={ms.id}>
              {ms.team_name}
            </option>
          ))}
        </select>
        <label htmlFor="player">Player</label>
        <select id="player" required value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
          <option value="">Select player</option>
          {availablePlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={isKeeperPick}
            onChange={(e) => setIsKeeperPick(e.target.checked)}
          />
          Keeper pick
        </label>
        <button type="submit">Add pick</button>
        {error && <p className="error">{error}</p>}
      </form>

      <table>
        <thead>
          <tr>
            <th>Overall</th>
            <th>Round</th>
            <th>Pick</th>
            <th>Team</th>
            <th>Player</th>
            <th>Keeper?</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {picks.map((pick) => (
            <tr key={pick.id}>
              <td>{pick.overall_pick}</td>
              <td>{pick.round}</td>
              <td>{pick.pick_in_round}</td>
              <td>{teamName(pick.manager_season_id)}</td>
              <td>{playerName(pick.player_id)}</td>
              <td>{pick.is_keeper_pick ? 'Yes' : ''}</td>
              <td>
                <button onClick={() => removePick(pick)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
