import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { League } from '../../types/database';

interface Props {
  league: League | null;
  onLeagueChange: (league: League) => void;
}

export function LeagueSetup({ league, onLeagueChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  useEffect(() => {
    supabase
      .from('leagues')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) onLeagueChange(data);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createLeague(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('leagues')
      .insert({ name })
      .select()
      .single();
    if (!error && data) onLeagueChange(data);
  }

  if (loading) return <p>Loading league...</p>;
  if (league) return <p className="league-name">{league.name}</p>;

  return (
    <form onSubmit={createLeague} className="league-setup">
      <h2>Set up your league</h2>
      <label htmlFor="league-name">League name</label>
      <input
        id="league-name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit">Create league</button>
    </form>
  );
}
