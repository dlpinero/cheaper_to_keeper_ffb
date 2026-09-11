import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Player, PlayerAdp, Season } from '../../types/database';

interface Props {
  season: Season | null;
}

export function PlayersPanel({ season }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [adpByPlayer, setAdpByPlayer] = useState<Map<string, PlayerAdp>>(new Map());
  const [adpDrafts, setAdpDrafts] = useState<Record<string, string>>({});
  const [fullName, setFullName] = useState('');
  const [nflTeam, setNflTeam] = useState('');
  const [position, setPosition] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from('players').select('*').order('full_name');
    setPlayers(data ?? []);
    if (season) {
      const { data: adp } = await supabase.from('player_adp').select('*').eq('season_id', season.id);
      setAdpByPlayer(new Map((adp ?? []).map((a) => [a.player_id, a])));
    } else {
      setAdpByPlayer(new Map());
    }
    setAdpDrafts({});
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season?.id]);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: insertErr } = await supabase
      .from('players')
      .insert({ full_name: fullName, nfl_team: nflTeam || null, position: position || null });
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setFullName('');
    setNflTeam('');
    setPosition('');
    load();
  }

  async function saveAdp(playerId: string) {
    if (!season) return;
    setError(null);
    const raw = adpDrafts[playerId];
    const adpRound = Number(raw);
    if (!raw || !Number.isInteger(adpRound) || adpRound < 1 || adpRound > 16) {
      setError('ADP round must be a whole number between 1 and 16.');
      return;
    }
    const { error: upsertErr } = await supabase.from('player_adp').upsert(
      { season_id: season.id, player_id: playerId, adp_round: adpRound, source: 'manual' },
      { onConflict: 'season_id,player_id' },
    );
    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }
    setAdpDrafts((d) => {
      const next = { ...d };
      delete next[playerId];
      return next;
    });
    load();
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
      {error && <p className="error">{error}</p>}
      {!season && <p>Select a season on the Seasons tab to enter ADP for that draft.</p>}

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
            <th>{season ? `${season.year + 1} ADP round` : 'ADP round'}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => {
            const saved = adpByPlayer.get(p.id);
            const draft = adpDrafts[p.id];
            return (
              <tr key={p.id}>
                <td>{p.full_name}</td>
                <td>{p.nfl_team}</td>
                <td>{p.position}</td>
                <td>
                  {season ? (
                    <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        min={1}
                        max={16}
                        style={{ width: '4rem' }}
                        value={draft ?? saved?.adp_round ?? ''}
                        onChange={(e) =>
                          setAdpDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                        }
                      />
                      {draft !== undefined && draft !== String(saved?.adp_round ?? '') && (
                        <button onClick={() => saveAdp(p.id)}>Save</button>
                      )}
                    </span>
                  ) : (
                    '—'
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
