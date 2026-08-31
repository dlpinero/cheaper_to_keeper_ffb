import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Player } from '../../types/database';

export function PlayersPanel() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [fullName, setFullName] = useState('');
  const [nflTeam, setNflTeam] = useState('');
  const [position, setPosition] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    const { data } = await supabase.from('players').select('*').order('full_name');
    setPlayers(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from('players')
      .insert({ full_name: fullName, nfl_team: nflTeam || null, position: position || null });
    if (!error) {
      setFullName('');
      setNflTeam('');
      setPosition('');
      load();
    }
  }

  const filtered = players.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <section>
      <h2>Players</h2>
      <form onSubmit={addPlayer} className="inline-form">
        <label htmlFor="p-name">Name</label>
        <input id="p-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <label htmlFor="p-team">NFL Team</label>
        <input id="p-team" value={nflTeam} onChange={(e) => setNflTeam(e.target.value)} />
        <label htmlFor="p-pos">Position</label>
        <input id="p-pos" value={position} onChange={(e) => setPosition(e.target.value)} />
        <button type="submit">Add player</button>
      </form>

      <input
        placeholder="Search players..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Team</th>
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id}>
              <td>{p.full_name}</td>
              <td>{p.nfl_team}</td>
              <td>{p.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
