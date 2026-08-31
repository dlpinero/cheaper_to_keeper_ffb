import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type {
  CommissionerOverride,
  KeeperSelectionPick,
  ManagerSeason,
  OverrideReason,
  Player,
  Season,
} from '../../types/database';

interface Props {
  season: Season;
}

const REASONS: OverrideReason[] = ['injury', 'retirement', 'suspension'];

export function OverridesPanel({ season }: Props) {
  const [picks, setPicks] = useState<KeeperSelectionPick[]>([]);
  const [managerSeasons, setManagerSeasons] = useState<ManagerSeason[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [overrides, setOverrides] = useState<CommissionerOverride[]>([]);

  const [pickId, setPickId] = useState('');
  const [newPlayerId, setNewPlayerId] = useState('');
  const [newSlotRound, setNewSlotRound] = useState(1);
  const [reason, setReason] = useState<OverrideReason>('injury');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [{ data: finalized }, { data: ms }, { data: pl }, { data: ov }] = await Promise.all([
      supabase.from('keeper_selections').select('*').eq('season_id', season.id).eq('status', 'finalized'),
      supabase.from('manager_seasons').select('*').eq('season_id', season.id),
      supabase.from('players').select('*').order('full_name'),
      supabase
        .from('commissioner_overrides')
        .select('*')
        .eq('season_id', season.id)
        .order('performed_at', { ascending: false }),
    ]);
    setManagerSeasons(ms ?? []);
    setPlayers(pl ?? []);
    setOverrides((ov ?? []) as CommissionerOverride[]);

    const finalizedIds = (finalized ?? []).map((s) => s.id);
    if (finalizedIds.length === 0) {
      setPicks([]);
      return;
    }
    const { data: p } = await supabase
      .from('keeper_selection_picks')
      .select('*')
      .in('keeper_selection_id', finalizedIds);
    setPicks((p ?? []) as KeeperSelectionPick[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id]);

  function teamName(managerSeasonId: string) {
    return managerSeasons.find((ms) => ms.id === managerSeasonId)?.team_name ?? '?';
  }
  function playerName(playerId: string) {
    return players.find((p) => p.id === playerId)?.full_name ?? '?';
  }

  const selectedPick = picks.find((p) => p.id === pickId);

  async function submitOverride(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: rpcErr } = await supabase.rpc('commissioner_override_pick', {
      p_pick_id: pickId,
      p_new_player_id: newPlayerId,
      p_new_slot_round: newSlotRound,
      p_reason: reason,
      p_notes: notes || null,
    });
    if (rpcErr) {
      setError(rpcErr.message);
    } else {
      setPickId('');
      setNewPlayerId('');
      setNotes('');
      await load();
    }
    setSubmitting(false);
  }

  return (
    <section>
      <h2>Commissioner overrides — {season.year}</h2>
      <p>
        Only for a finalized pick where the player got hurt, retired, or was suspended. This is
        audited below and replaces the pick directly.
      </p>

      {picks.length === 0 ? (
        <p>No finalized keeper picks for this season yet.</p>
      ) : (
        <form onSubmit={submitOverride} className="inline-form">
          <label htmlFor="ov-pick">Finalized pick</label>
          <select id="ov-pick" required value={pickId} onChange={(e) => setPickId(e.target.value)}>
            <option value="">Select a pick</option>
            {picks.map((p) => (
              <option key={p.id} value={p.id}>
                {teamName(p.manager_season_id)} — {playerName(p.player_id)} (round {p.slot_round})
              </option>
            ))}
          </select>
          <label htmlFor="ov-reason">Reason</label>
          <select id="ov-reason" value={reason} onChange={(e) => setReason(e.target.value as OverrideReason)}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label htmlFor="ov-new-player">Replacement player</label>
          <select
            id="ov-new-player"
            required
            value={newPlayerId}
            onChange={(e) => setNewPlayerId(e.target.value)}
          >
            <option value="">Select player</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
          <label htmlFor="ov-round">New round</label>
          <input
            id="ov-round"
            type="number"
            min={1}
            value={newSlotRound}
            onChange={(e) => setNewSlotRound(Number(e.target.value))}
          />
          <label htmlFor="ov-notes">Notes</label>
          <input id="ov-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
          <button type="submit" disabled={submitting || !selectedPick}>
            Apply override
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <h3>Audit log</h3>
      {overrides.length === 0 ? (
        <p>No overrides yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Team</th>
              <th>Reason</th>
              <th>Previous player</th>
              <th>New player</th>
              <th>Round change</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {overrides.map((o) => (
              <tr key={o.id}>
                <td>{o.performed_at.slice(0, 10)}</td>
                <td>{teamName(o.manager_season_id)}</td>
                <td>{o.reason}</td>
                <td>{playerName(o.previous_player_id)}</td>
                <td>{playerName(o.new_player_id)}</td>
                <td>
                  {o.previous_slot_round} → {o.new_slot_round}
                </td>
                <td>{o.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
