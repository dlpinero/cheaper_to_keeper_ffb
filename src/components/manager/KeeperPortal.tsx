import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { computeKeeperOption, validateKeeperSelection } from '../../engine';
import type { SelectionValidationResult } from '../../engine';
import { buildLineageHistory } from '../../lib/lineageHistory';
import type {
  InjuryExemptionClaim,
  KeeperLineage,
  KeeperSelection,
  ManagerSeason,
  PlayerSeason,
  Season,
} from '../../types/database';

interface Props {
  season: Season;
  managerSeason: ManagerSeason;
}

interface Candidate {
  playerId: string;
  playerName: string;
  currentRound: number;
  eligible: boolean;
  ineligibleReason?: string;
  keeperSlotRound: number | null;
  usesInjuryExemptionSlot: boolean;
}

interface OtherPick {
  teamName: string;
  playerName: string;
  slotRound: number;
  usesInjuryExemptionSlot: boolean;
}

export function KeeperPortal({ season, managerSeason }: Props) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selection, setSelection] = useState<KeeperSelection | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [others, setOthers] = useState<OtherPick[] | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id, managerSeason.id]);

  async function load() {
    setLoading(true);
    setError(null);

    const [{ data: seasons }, { data: existingSelection }] = await Promise.all([
      supabase
        .from('seasons')
        .select('*')
        .eq('league_id', season.league_id)
        .lte('year', season.year)
        .order('year'),
      supabase
        .from('keeper_selections')
        .select('*')
        .eq('season_id', season.id)
        .eq('manager_season_id', managerSeason.id)
        .maybeSingle(),
    ]);
    setSelection(existingSelection ?? null);

    const seasonYearById = new Map((seasons ?? []).map((s) => [s.id, s.year]));
    const seasonIds = (seasons ?? []).map((s) => s.id);

    const [{ data: lineage }, { data: playerSeasons }, { data: claims }, { data: players }] =
      await Promise.all([
        supabase.from('keeper_lineage').select('*').in('season_id', seasonIds),
        supabase
          .from('player_seasons')
          .select('*')
          .eq('season_id', season.id)
          .eq('manager_season_id', managerSeason.id),
        supabase
          .from('injury_exemption_claims')
          .select('*')
          .eq('season_id', season.id)
          .eq('manager_season_id', managerSeason.id)
          .eq('status', 'approved'),
        supabase.from('players').select('*'),
      ]);

    const playerName = (id: string) => players?.find((p) => p.id === id)?.full_name ?? '?';

    const historyByPlayer = buildLineageHistory((lineage ?? []) as KeeperLineage[], seasonYearById);

    const eligibilityByPlayer = new Map(
      ((playerSeasons ?? []) as PlayerSeason[]).map((ps) => [ps.player_id, ps]),
    );
    const approvedClaimByPlayer = new Map(
      ((claims ?? []) as InjuryExemptionClaim[]).map((c) => [c.player_id, c]),
    );

    const rows: Candidate[] = [];
    for (const [playerId, history] of historyByPlayer.entries()) {
      const latest = history[history.length - 1];
      // Only players on this manager's roster this season, via this season's lineage entry.
      const onMyRoster = (lineage ?? []).some(
        (l) =>
          l.player_id === playerId &&
          l.season_id === season.id &&
          l.manager_season_id === managerSeason.id,
      );
      if (!onMyRoster || latest.seasonYear !== season.year) continue;

      const ps = eligibilityByPlayer.get(playerId);
      const claim = approvedClaimByPlayer.get(playerId);
      const result = computeKeeperOption(
        { playerId, history },
        {
          rosterContinuityEligible: ps?.roster_continuity_eligible ?? true,
          gamesMissed: ps?.games_missed_injury ?? 0,
          injuryExemptionApproved: Boolean(claim),
        },
      );

      rows.push({
        playerId,
        playerName: playerName(playerId),
        currentRound: latest.slotRound,
        eligible: result.eligible,
        ineligibleReason: result.ineligibleReason,
        keeperSlotRound: result.keeperSlotRound,
        usesInjuryExemptionSlot: result.usesInjuryExemptionSlot,
      });
    }
    rows.sort((a, b) => a.playerName.localeCompare(b.playerName));
    setCandidates(rows);

    if (existingSelection) {
      const { data: picks } = await supabase
        .from('keeper_selection_picks')
        .select('*')
        .eq('keeper_selection_id', existingSelection.id);
      setSelectedIds(new Set((picks ?? []).map((p) => p.player_id)));

      if (existingSelection.status === 'finalized') {
        await loadOthers();
      }
    } else {
      setSelectedIds(new Set());
    }

    setLoading(false);
  }

  async function loadOthers() {
    const [{ data: picks }, { data: selections }, { data: managerSeasons }, { data: players }] =
      await Promise.all([
        supabase.from('keeper_selection_picks').select('*').eq('season_id', season.id),
        supabase
          .from('keeper_selections')
          .select('*')
          .eq('season_id', season.id)
          .eq('status', 'finalized'),
        supabase.from('manager_seasons').select('*').eq('season_id', season.id),
        supabase.from('players').select('*'),
      ]);

    const finalizedManagerSeasonIds = new Set(
      (selections ?? []).filter((s) => s.manager_season_id !== managerSeason.id).map((s) => s.manager_season_id),
    );
    const teamName = (id: string) => managerSeasons?.find((ms) => ms.id === id)?.team_name ?? '?';
    const playerName = (id: string) => players?.find((p) => p.id === id)?.full_name ?? '?';

    const rows: OtherPick[] = (picks ?? [])
      .filter((p) => finalizedManagerSeasonIds.has(p.manager_season_id))
      .map((p) => ({
        teamName: teamName(p.manager_season_id),
        playerName: playerName(p.player_id),
        slotRound: p.slot_round,
        usesInjuryExemptionSlot: p.is_injury_exempt_slot,
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName) || a.slotRound - b.slotRound);

    setOthers(rows);
  }

  function toggle(playerId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  const selectedPicks = candidates
    .filter((c) => selectedIds.has(c.playerId))
    .map((c) => ({
      playerId: c.playerId,
      eligible: c.eligible,
      usesInjuryExemptionSlot: c.usesInjuryExemptionSlot,
    }));
  const validation: SelectionValidationResult = validateKeeperSelection(selectedPicks);

  async function saveDraft(): Promise<string | null> {
    setError(null);
    let selectionId = selection?.id ?? null;

    if (!selectionId) {
      const { data, error: insertErr } = await supabase
        .from('keeper_selections')
        .insert({ season_id: season.id, manager_season_id: managerSeason.id, status: 'draft' })
        .select()
        .single();
      if (insertErr || !data) {
        setError(insertErr?.message ?? 'Could not create keeper selection');
        return null;
      }
      selectionId = data.id;
      setSelection(data);
    }

    await supabase.from('keeper_selection_picks').delete().eq('keeper_selection_id', selectionId);

    const rows = candidates
      .filter((c) => selectedIds.has(c.playerId) && c.keeperSlotRound !== null)
      .map((c) => ({
        keeper_selection_id: selectionId as string,
        season_id: season.id,
        manager_season_id: managerSeason.id,
        player_id: c.playerId,
        slot_round: c.keeperSlotRound as number,
        is_injury_exempt_slot: c.usesInjuryExemptionSlot,
      }));

    if (rows.length > 0) {
      const { error: picksErr } = await supabase.from('keeper_selection_picks').insert(rows);
      if (picksErr) {
        setError(picksErr.message);
        return null;
      }
    }

    return selectionId;
  }

  async function handleSave() {
    setSaving(true);
    await saveDraft();
    setSaving(false);
  }

  async function handleFinalize() {
    if (!validation.valid) return;
    setSaving(true);
    const selectionId = await saveDraft();
    if (selectionId) {
      const { error: rpcErr } = await supabase.rpc('finalize_keeper_selection', {
        p_keeper_selection_id: selectionId,
      });
      if (rpcErr) {
        setError(rpcErr.message);
      } else {
        await load();
      }
    }
    setSaving(false);
  }

  if (loading) return <p>Loading your roster...</p>;

  const isFinalized = selection?.status === 'finalized';

  return (
    <section>
      <h2>Keeper selection for the {season.year + 1} draft</h2>
      <p>Based on your {season.year} roster.</p>

      {candidates.length === 0 ? (
        <p>No rostered players with lineage history found for you this season yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              {!isFinalized && <th></th>}
              <th>Player</th>
              <th>{season.year + 1} round if kept</th>
              <th>Eligible?</th>
              <th>{season.year} round</th>
              <th>Uses injury exemption</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => {
              const checked = selectedIds.has(c.playerId);
              if (isFinalized && !checked) return null;
              return (
                <tr key={c.playerId} className={checked ? 'active-row' : ''}>
                  {!isFinalized && (
                    <td>
                      <input
                        type="checkbox"
                        disabled={!c.eligible}
                        checked={checked}
                        onChange={() => toggle(c.playerId)}
                      />
                    </td>
                  )}
                  <td>{c.playerName}</td>
                  <td>{c.eligible ? c.keeperSlotRound : '—'}</td>
                  <td>{c.eligible ? 'Yes' : `No (${c.ineligibleReason})`}</td>
                  <td>{c.currentRound}</td>
                  <td>{c.eligible && c.usesInjuryExemptionSlot ? 'Yes' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {isFinalized ? (
        <p>
          Your picks are <strong>finalized</strong>
          {selection?.finalized_at ? ` as of ${selection.finalized_at.slice(0, 10)}` : ''}. Only the
          commissioner can change a finalized pick now, and only for injury, retirement, or
          suspension.
        </p>
      ) : (
        <>
          {validation.errors.length > 0 && selectedIds.size > 0 && (
            <ul className="error">
              {validation.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {error && <p className="error">{error}</p>}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleSave} disabled={saving}>
              Save draft
            </button>
            <button onClick={handleFinalize} disabled={saving || !validation.valid || selectedIds.size === 0}>
              Finalize (locks your picks)
            </button>
          </div>
        </>
      )}

      {isFinalized && (
        <>
          <h3>Other teams' picks</h3>
          {others === null ? (
            <p>Loading...</p>
          ) : others.length === 0 ? (
            <p>No other teams have finalized their picks yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Player</th>
                  <th>Round</th>
                  <th>Injury exemption</th>
                </tr>
              </thead>
              <tbody>
                {others.map((o, i) => (
                  <tr key={i}>
                    <td>{o.teamName}</td>
                    <td>{o.playerName}</td>
                    <td>{o.slotRound}</td>
                    <td>{o.usesInjuryExemptionSlot ? 'Yes' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
