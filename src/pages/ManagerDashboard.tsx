import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabaseClient';
import { KeeperPortal } from '../components/manager/KeeperPortal';
import { InjuryExemptionRequest } from '../components/manager/InjuryExemptionRequest';
import type { ManagerSeason, Season } from '../types/database';

export function ManagerDashboard() {
  const { manager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<Season | null>(null);
  const [managerSeason, setManagerSeason] = useState<ManagerSeason | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager?.id]);

  async function load() {
    if (!manager) return;
    setLoading(true);

    const { data: seasons } = await supabase
      .from('seasons')
      .select('*')
      .eq('league_id', manager.league_id)
      .eq('status', 'keepers_open')
      .order('year', { ascending: false });

    for (const s of seasons ?? []) {
      const { data: ms } = await supabase
        .from('manager_seasons')
        .select('*')
        .eq('season_id', s.id)
        .eq('manager_id', manager.id)
        .maybeSingle();
      if (ms) {
        setSeason(s);
        setManagerSeason(ms);
        setLoading(false);
        return;
      }
    }

    setSeason(null);
    setManagerSeason(null);
    setLoading(false);
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>My Team</h1>
        <div>
          <span>{manager?.display_name}</span>
          <button onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      {loading ? (
        <p>Loading...</p>
      ) : season && managerSeason && manager ? (
        <>
          <InjuryExemptionRequest season={season} managerSeason={managerSeason} managerId={manager.id} />
          <KeeperPortal season={season} managerSeason={managerSeason} />
        </>
      ) : (
        <p>
          Keeper selections aren't open right now. Check back once the commissioner opens the
          keeper window for the next season.
        </p>
      )}
    </div>
  );
}
