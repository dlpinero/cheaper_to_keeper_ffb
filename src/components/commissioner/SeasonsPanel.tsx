import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { League, Season, SeasonStatus } from '../../types/database';

const STATUSES: SeasonStatus[] = [
  'setup',
  'draft_complete',
  'regular_season',
  'playoffs_complete',
  'keepers_open',
  'keepers_locked',
];

interface Props {
  league: League;
  activeSeason: Season | null;
  onActiveSeasonChange: (season: Season) => void;
}

export function SeasonsPanel({ league, activeSeason, onActiveSeasonChange }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());

  async function load() {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('league_id', league.id)
      .order('year', { ascending: false });
    setSeasons(data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league.id]);

  async function addSeason(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('seasons').insert({ league_id: league.id, year });
    if (!error) {
      setYear(year + 1);
      load();
    }
  }

  async function updateStatus(season: Season, status: SeasonStatus) {
    await supabase.from('seasons').update({ status }).eq('id', season.id);
    load();
  }

  return (
    <section>
      <h2>Seasons</h2>
      <form onSubmit={addSeason} className="inline-form">
        <label htmlFor="year">Year</label>
        <input
          id="year"
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
        <button type="submit">Add season</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Status</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((s) => (
            <tr key={s.id} className={activeSeason?.id === s.id ? 'active-row' : ''}>
              <td>{s.year}</td>
              <td>
                <select value={s.status} onChange={(e) => updateStatus(s, e.target.value as SeasonStatus)}>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button onClick={() => onActiveSeasonChange(s)}>
                  {activeSeason?.id === s.id ? 'Selected' : 'Select'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
