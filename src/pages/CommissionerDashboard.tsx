import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { signOut } from '../lib/auth';
import { LeagueSetup } from '../components/commissioner/LeagueSetup';
import { SeasonsPanel } from '../components/commissioner/SeasonsPanel';
import { ManagersPanel } from '../components/commissioner/ManagersPanel';
import { PlayersPanel } from '../components/commissioner/PlayersPanel';
import { DraftPicksPanel } from '../components/commissioner/DraftPicksPanel';
import { InjuryClaimsPanel } from '../components/commissioner/InjuryClaimsPanel';
import { KeeperLineagePreview } from '../components/commissioner/KeeperLineagePreview';
import type { League, Season } from '../types/database';

const TABS = [
  'Seasons',
  'Managers',
  'Players',
  'Draft Picks',
  'Injury Claims',
  'Keeper Preview',
] as const;
type Tab = (typeof TABS)[number];

export function CommissionerDashboard() {
  const { manager } = useAuth();
  const [league, setLeague] = useState<League | null>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [tab, setTab] = useState<Tab>('Seasons');

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Commissioner Console</h1>
        <div>
          <span>{manager?.display_name}</span>
          <button onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      <LeagueSetup league={league} onLeagueChange={setLeague} />

      {league && (
        <>
          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={t === tab ? 'active' : ''}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </nav>

          {tab === 'Seasons' && (
            <SeasonsPanel
              league={league}
              activeSeason={activeSeason}
              onActiveSeasonChange={setActiveSeason}
            />
          )}
          {tab === 'Managers' && activeSeason && (
            <ManagersPanel league={league} season={activeSeason} />
          )}
          {tab === 'Players' && <PlayersPanel />}
          {tab === 'Draft Picks' && activeSeason && (
            <DraftPicksPanel season={activeSeason} />
          )}
          {tab === 'Injury Claims' && activeSeason && (
            <InjuryClaimsPanel season={activeSeason} />
          )}
          {tab === 'Keeper Preview' && activeSeason && (
            <KeeperLineagePreview season={activeSeason} />
          )}
          {tab !== 'Seasons' && tab !== 'Players' && !activeSeason && (
            <p>Select a season on the Seasons tab first.</p>
          )}
        </>
      )}
    </div>
  );
}
