import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { League, Manager, ManagerSeason, Season } from '../../types/database';

interface Props {
  league: League;
  season: Season;
}

export function ManagersPanel({ league, season }: Props) {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [managerSeasons, setManagerSeasons] = useState<ManagerSeason[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

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
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league.id, season.id]);

  async function addManager(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from('managers')
      .insert({ league_id: league.id, display_name: displayName, email, role: 'manager' });
    if (!error) {
      setDisplayName('');
      setEmail('');
      load();
    }
  }

  async function joinSeason(manager: Manager) {
    const { error } = await supabase.from('manager_seasons').insert({
      manager_id: manager.id,
      season_id: season.id,
      team_name: manager.display_name,
      is_active: true,
    });
    if (!error) load();
  }

  async function leaveSeason(managerSeason: ManagerSeason) {
    await supabase
      .from('manager_seasons')
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq('id', managerSeason.id);
    load();
  }

  async function updateTeamName(managerSeason: ManagerSeason, teamName: string) {
    await supabase.from('manager_seasons').update({ team_name: teamName }).eq('id', managerSeason.id);
    load();
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

      <h3>Roster for {season.year}</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Team name ({season.year})</th>
            <th>In this season</th>
          </tr>
        </thead>
        <tbody>
          {managers.map((m) => {
            const ms = managerSeasons.find((x) => x.manager_id === m.id);
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
