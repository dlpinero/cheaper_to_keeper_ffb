import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Franchise, League, Manager, ManagerSeason, Season } from '../../types/database';

interface Props {
  league: League;
  season: Season;
}

export function ManagersPanel({ league, season }: Props) {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [managerSeasons, setManagerSeasons] = useState<ManagerSeason[]>([]);
  const [allManagerSeasons, setAllManagerSeasons] = useState<ManagerSeason[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passwordManagerId, setPasswordManagerId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSetFor, setPasswordSetFor] = useState<string | null>(null);

  async function load() {
    const { data: mgrs } = await supabase
      .from('managers')
      .select('*')
      .eq('league_id', league.id)
      .order('display_name');
    setManagers(mgrs ?? []);

    const { data: ms } = await supabase
      .from('manager_seasons')
      .select('*')
      .eq('season_id', season.id);
    setManagerSeasons(ms ?? []);

    const managerIds = (mgrs ?? []).map((m) => m.id);
    const [{ data: allMs }, { data: fr }] = await Promise.all([
      managerIds.length > 0
        ? supabase.from('manager_seasons').select('*').in('manager_id', managerIds)
        : Promise.resolve({ data: [] as ManagerSeason[] }),
      supabase.from('franchises').select('*').eq('league_id', league.id),
    ]);
    setAllManagerSeasons(allMs ?? []);
    setFranchises(fr ?? []);
  }

  // A franchise is the persistent seat a manager's whole history is filed under, independent of
  // team name and (if the seat later changes hands) the manager too — see
  // supabase/migrations/0009_franchises.sql. Every manager_seasons row for a given manager points
  // at the same franchise, so resolving a manager's current franchise only needs any one of them.
  function franchiseIdForManager(managerId: string): string | null {
    return allManagerSeasons.find((x) => x.manager_id === managerId)?.franchise_id ?? null;
  }

  function franchiseLabel(franchiseId: string): string {
    const managerIds = new Set(
      allManagerSeasons.filter((x) => x.franchise_id === franchiseId).map((x) => x.manager_id),
    );
    const names = managers.filter((m) => managerIds.has(m.id)).map((m) => m.display_name);
    return names.length > 0 ? names.join(' / ') : 'Unnamed franchise';
  }

  async function createFranchise(): Promise<Franchise | null> {
    const { data: newFranchise, error: franchiseErr } = await supabase
      .from('franchises')
      .insert({ league_id: league.id })
      .select()
      .single();
    if (franchiseErr || !newFranchise) {
      setError(franchiseErr?.message ?? 'Could not create franchise');
      return null;
    }
    return newFranchise;
  }

  async function assignManagerToFranchise(managerId: string, franchiseId: string) {
    setError(null);
    const { error: updateErr } = await supabase
      .from('manager_seasons')
      .update({ franchise_id: franchiseId })
      .eq('manager_id', managerId);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    load();
  }

  async function splitIntoNewFranchise(managerId: string) {
    setError(null);
    const newFranchise = await createFranchise();
    if (!newFranchise) return;
    await assignManagerToFranchise(managerId, newFranchise.id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league.id, season.id]);

  async function addManager(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: insertErr } = await supabase
      .from('managers')
      .insert({ league_id: league.id, display_name: displayName, email, role: 'manager' });
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setDisplayName('');
    setEmail('');
    load();
  }

  async function joinSeason(manager: Manager) {
    setError(null);
    let franchiseId = franchiseIdForManager(manager.id);
    if (!franchiseId) {
      const newFranchise = await createFranchise();
      if (!newFranchise) return;
      franchiseId = newFranchise.id;
    }
    const { error: insertErr } = await supabase.from('manager_seasons').insert({
      manager_id: manager.id,
      season_id: season.id,
      team_name: manager.display_name,
      is_active: true,
      franchise_id: franchiseId,
    });
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    load();
  }

  async function leaveSeason(managerSeason: ManagerSeason) {
    setError(null);
    const { error: updateErr } = await supabase
      .from('manager_seasons')
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq('id', managerSeason.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    load();
  }

  async function updateTeamName(managerSeason: ManagerSeason, teamName: string) {
    setError(null);
    const { error: updateErr } = await supabase
      .from('manager_seasons')
      .update({ team_name: teamName })
      .eq('id', managerSeason.id);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    load();
  }

  function startSetPassword(managerId: string) {
    setPasswordManagerId(managerId);
    setNewPassword('');
    setPasswordError(null);
    setPasswordSetFor(null);
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordManagerId) return;
    setPasswordError(null);
    setPasswordSaving(true);
    const { data, error } = await supabase.functions.invoke('set-manager-password', {
      body: { manager_id: passwordManagerId, password: newPassword },
    });
    setPasswordSaving(false);
    if (error || (data && 'error' in data)) {
      setPasswordError(
        (data && 'error' in data && (data as { error: string }).error) ||
          (error instanceof Error ? error.message : 'Could not set password'),
      );
      return;
    }
    setPasswordSetFor(passwordManagerId);
    setPasswordManagerId(null);
    setNewPassword('');
  }

  return (
    <section>
      <h2>Managers</h2>
      <form onSubmit={addManager} className="inline-form">
        <label htmlFor="mgr-name">Name</label>
        <input id="mgr-name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <label htmlFor="mgr-email">Email</label>
        <input
          id="mgr-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit">Add manager to league</button>
      </form>
      {error && <p className="error">{error}</p>}

      <h3>Roster for {season.year}</h3>
      <p>
        Franchise is the seat a manager's history is filed under — it stays linked across team-name
        changes. Merging two managers into the same franchise moves the earlier manager's whole
        history (all years) onto the seat with the manager currently selected; use "Split off" to
        undo that and give a manager back their own seat.
      </p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Team name (Current)</th>
            <th>Franchise</th>
            <th>In this season</th>
            <th>Password</th>
          </tr>
        </thead>
        <tbody>
          {managers.map((m) => {
            const ms = managerSeasons.find((x) => x.manager_id === m.id);
            const franchiseId = franchiseIdForManager(m.id);
            return (
              <tr key={m.id}>
                <td>{m.display_name}</td>
                <td>{m.email}</td>
                <td>
                  {ms ? (
                    <input
                      defaultValue={ms.team_name}
                      onBlur={(e) => updateTeamName(ms, e.target.value)}
                    />
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {franchiseId ? (
                    <>
                      <select
                        value={franchiseId}
                        onChange={(e) => assignManagerToFranchise(m.id, e.target.value)}
                      >
                        {franchises.map((f) => (
                          <option key={f.id} value={f.id}>
                            {franchiseLabel(f.id)}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => splitIntoNewFranchise(m.id)}>
                        Split off
                      </button>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {ms ? (
                    ms.is_active ? (
                      <button onClick={() => leaveSeason(ms)}>Remove from season</button>
                    ) : (
                      <span>Inactive (left {ms.left_at?.slice(0, 10)})</span>
                    )
                  ) : (
                    <button onClick={() => joinSeason(m)}>Add to season</button>
                  )}
                </td>
                <td>
                  {passwordManagerId === m.id ? (
                    <form onSubmit={submitPassword} className="inline-form">
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="Temporary password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button type="submit" disabled={passwordSaving}>
                        {passwordSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setPasswordManagerId(null)}>
                        Cancel
                      </button>
                      {passwordError && <p className="error">{passwordError}</p>}
                    </form>
                  ) : (
                    <>
                      <button onClick={() => startSetPassword(m.id)}>Set password</button>
                      {passwordSetFor === m.id && <span> Password set.</span>}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
