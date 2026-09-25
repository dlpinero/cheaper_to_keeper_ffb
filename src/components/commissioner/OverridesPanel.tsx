import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type {
  CommissionerOverride,
  CommissionerSelectionReset,
  KeeperLineage,
  KeeperSelection,
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
const RESET_REASONS: OverrideReason[] = ['finalized_in_error'];

export function OverridesPanel({ season }: Props) {
  const [picks, setPicks] = useState<KeeperSelectionPick[]>([]);
  const [finalizedSelections, setFinalizedSelections] = useState<KeeperSelection[]>([]);
  const [managerSeasons, setManagerSeasons] = useState<ManagerSeason[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [lineage, setLineage] = useState<KeeperLineage[]>([]);
  const [overrides, setOverrides] = useState<CommissionerOverride[]>([]);
  const [resets, setResets] = useState<CommissionerSelectionReset[]>([]);

  const [pickId, setPickId] = useState('');
  const [newPlayerId, setNewPlayerId] = useState('');
  const [reason, setReason] = useState<OverrideReason>('injury');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [resetSelectionId, setResetSelectionId] = useState('');
  const [resetReason, setResetReason] = useState<OverrideReason>('finalized_in_error');
  const [resetNotes, setResetNotes] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  async function load() {
    const [{ data: finalized }, { data: ms }, { data: pl }, { data: lin }, { data: ov }, { data: rs }] =
      await Promise.all([
        supabase.from('keeper_selections').select('*').eq('season_id', season.id).eq('status', 'finalized'),
        supabase.from('manager_seasons').select('*').eq('season_id', season.id),
        supabase.from('players').select('*').order('full_name'),
        supabase.from('keeper_lineage').select('*').eq('season_id', season.id),
        supabase
          .from('commissioner_overrides')
          .select('*')
          .eq('season_id', season.id)
          .order('performed_at', { ascending: false }),
        supabase
          .from('commissioner_selection_resets')
          .select('*')
          .eq('season_id', season.id)
          .order('performed_at', { ascending: false }),
      ]);
    setManagerSeasons(ms ?? []);
    setPlayers(pl ?? []);
    setLineage((lin ?? []) as KeeperLineage[]);
    setOverrides((ov ?? []) as CommissionerOverride[]);
    setResets((rs ?? []) as CommissionerSelectionReset[]);
    setFinalizedSelections((finalized ?? []) as KeeperSelection[]);

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

  useEffect(() => {
    setNewPlayerId('');
  }, [pickId]);

  function teamName(managerSeasonId: string) {
    return managerSeasons.find((ms) => ms.id === managerSeasonId)?.team_name ?? '?';
  }
  function playerName(playerId: string) {
    return players.find((p) => p.id === playerId)?.full_name ?? '?';
  }

  const selectedPick = picks.find((p) => p.id === pickId);

  // Only offer players actually on this manager's roster this season (via
  // keeper_lineage), excluding the player currently in the pick being replaced.
  const rosterPlayers = selectedPick
    ? players.filter((p) =>
        lineage.some(
          (l) =>
            l.manager_season_id === selectedPick.manager_season_id &&
            l.player_id === p.id &&
            p.id !== selectedPick.player_id,
        ),
      )
    : [];

  // The replacement's own round comes from his own lineage entry — the round he
  // occupies is a property of that player, not of the pick he's being swapped into.
  const replacementRound = selectedPick
    ? lineage.find(
        (l) => l.manager_season_id === selectedPick.manager_season_id && l.player_id === newPlayerId,
      )?.slot_round
    : undefined;

  async function submitOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPick || replacementRound === undefined) return;
    setError(null);
    setSubmitting(true);
    const { error: rpcErr } = await supabase.rpc('commissioner_override_pick', {
      p_pick_id: pickId,
      p_new_player_id: newPlayerId,
      p_new_slot_round: replacementRound,
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

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetSelectionId) return;
    setResetError(null);
    setResetting(true);
    const { error: rpcErr } = await supabase.rpc('commissioner_reset_keeper_selection', {
      p_selection_id: resetSelectionId,
      p_reason: resetReason,
      p_notes: resetNotes || null,
    });
    if (rpcErr) {
      setResetError(rpcErr.message);
    } else {
      setResetSelectionId('');
      setResetNotes('');
      await load();
    }
    setResetting(false);
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

          <div style={{ flexBasis: '100%', height: 0 }} />

          <label htmlFor="ov-new-player">Replacement player</label>
          <select
            id="ov-new-player"
            required
            disabled={!selectedPick}
            value={newPlayerId}
            onChange={(e) => setNewPlayerId(e.target.value)}
          >
            <option value="">{selectedPick ? 'Select player' : 'Select a pick first'}</option>
            {rosterPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
          <label htmlFor="ov-round">Replacement player's round</label>
          <input id="ov-round" type="text" readOnly value={replacementRound ?? ''} />

          <div style={{ flexBasis: '100%', height: 0 }} />

          <label htmlFor="ov-reason">Reason</label>
          <select id="ov-reason" value={reason} onChange={(e) => setReason(e.target.value as OverrideReason)}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label htmlFor="ov-notes">Notes</label>
          <input id="ov-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
          <button type="submit" disabled={submitting || !selectedPick || replacementRound === undefined}>
            Apply override
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      <h2>Reset a finalized selection — {season.year}</h2>
      <p>
        Reopens a manager's whole finalized selection back to draft so they can re-pick and
        re-finalize themselves — their previous picks stay as a starting point. Use this for a
        selection finalized in error, before the actual next draft has happened. This is audited
        below.
      </p>
      {finalizedSelections.length === 0 ? (
        <p>No finalized keeper selections for this season yet.</p>
      ) : (
        <form onSubmit={submitReset} className="inline-form">
          <label htmlFor="reset-selection">Finalized selection</label>
          <select
            id="reset-selection"
            required
            value={resetSelectionId}
            onChange={(e) => setResetSelectionId(e.target.value)}
          >
            <option value="">Select a team</option>
            {finalizedSelections.map((s) => (
              <option key={s.id} value={s.id}>
                {teamName(s.manager_season_id)}
                {s.finalized_at ? ` (finalized ${s.finalized_at.slice(0, 10)})` : ''}
              </option>
            ))}
          </select>

          <div style={{ flexBasis: '100%', height: 0 }} />

          <label htmlFor="reset-reason">Reason</label>
          <select
            id="reset-reason"
            value={resetReason}
            onChange={(e) => setResetReason(e.target.value as OverrideReason)}
          >
            {RESET_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label htmlFor="reset-notes">Notes</label>
          <input
            id="reset-notes"
            value={resetNotes}
            onChange={(e) => setResetNotes(e.target.value)}
            placeholder="optional"
          />
          <button type="submit" disabled={resetting || !resetSelectionId}>
            Reset to draft
          </button>
        </form>
      )}
      {resetError && <p className="error">{resetError}</p>}

      <h3>Reset audit log</h3>
      {resets.length === 0 ? (
        <p>No resets yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Team</th>
              <th>Reason</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {resets.map((r) => (
              <tr key={r.id}>
                <td>{r.performed_at.slice(0, 10)}</td>
                <td>{teamName(r.manager_season_id)}</td>
                <td>{r.reason}</td>
                <td>{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Override audit log</h3>
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
