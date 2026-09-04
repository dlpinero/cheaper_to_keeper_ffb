import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { League, ManagerSeason, Player, Season } from '../../types/database';

interface Props {
  league: League;
  season: Season | null;
}

interface PreviewPick {
  pick: number;
  round: number;
  team_key: string;
  player_key: string;
  yahoo_name: string;
  nfl_team: string | null;
  position: string | null;
  resolved_player_id: string | null;
  matched_by: 'yahoo_id' | 'name' | null;
}

interface PreviewTeam {
  team_key: string;
  name: string;
}

interface ImportResultRow {
  player_key: string;
  status: 'imported' | 'error';
  message?: string;
}

function redirectUri() {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

export function YahooImportPanel({ league, season }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [yahooLeagueKey, setYahooLeagueKey] = useState(league.yahoo_league_key ?? '');
  const [managerSeasons, setManagerSeasons] = useState<ManagerSeason[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [preview, setPreview] = useState<{ teams: PreviewTeam[]; picks: PreviewPick[] } | null>(null);
  const [teamMapping, setTeamMapping] = useState<Record<string, string>>({});
  const [playerResolutions, setPlayerResolutions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<ImportResultRow[] | null>(null);

  async function refreshConnectionStatus() {
    const { data } = await supabase.rpc('is_yahoo_connected', { p_league_id: league.id });
    setConnected(!!data);
  }

  useEffect(() => {
    refreshConnectionStatus();
    if (season) {
      supabase
        .from('manager_seasons')
        .select('*')
        .eq('season_id', season.id)
        .eq('is_active', true)
        .then(({ data }) => setManagerSeasons(data ?? []));
    }
    supabase
      .from('players')
      .select('*')
      .order('full_name')
      .then(({ data }) => setPlayers(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league.id, season?.id]);

  // Pick up the ?code=...&state=... query string Yahoo redirects back with.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code) return;

    const expectedState = sessionStorage.getItem('yahoo_oauth_state');
    window.history.replaceState(null, '', window.location.pathname);
    if (!expectedState || state !== expectedState) {
      setError('Yahoo sign-in response could not be verified (state mismatch) — please try connecting again.');
      return;
    }
    sessionStorage.removeItem('yahoo_oauth_state');

    setLoading(true);
    supabase.functions
      .invoke('yahoo-oauth-exchange', {
        body: { league_id: league.id, code, redirect_uri: redirectUri() },
      })
      .then(({ data, error: fnError }) => {
        setLoading(false);
        if (fnError || (data && 'error' in data)) {
          setError(
            (data && 'error' in data && (data as { error: string }).error) ||
              (fnError instanceof Error ? fnError.message : 'Could not connect to Yahoo'),
          );
          return;
        }
        refreshConnectionStatus();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function connectToYahoo() {
    const clientId = import.meta.env.VITE_YAHOO_CLIENT_ID;
    if (!clientId) {
      setError('VITE_YAHOO_CLIENT_ID is not set — add the Yahoo app Client ID to .env first.');
      return;
    }
    const state = crypto.randomUUID();
    sessionStorage.setItem('yahoo_oauth_state', state);
    const authorizeUrl = new URL('https://api.login.yahoo.com/oauth2/request_auth');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri());
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'fspt-r');
    authorizeUrl.searchParams.set('state', state);
    window.location.href = authorizeUrl.toString();
  }

  async function saveLeagueKey() {
    setError(null);
    const { error: updateErr } = await supabase
      .from('leagues')
      .update({ yahoo_league_key: yahooLeagueKey })
      .eq('id', league.id);
    if (updateErr) setError(updateErr.message);
  }

  async function fetchDraftResults() {
    if (!season) return;
    setError(null);
    setImportResults(null);
    setLoading(true);
    const { data, error: fnError } = await supabase.functions.invoke('yahoo-draft-import', {
      body: {
        league_id: league.id,
        season_id: season.id,
        yahoo_league_key: yahooLeagueKey,
        commit: false,
      },
    });
    setLoading(false);
    if (fnError || (data && 'error' in data)) {
      setError(
        (data && 'error' in data && (data as { error: string }).error) ||
          (fnError instanceof Error ? fnError.message : 'Could not fetch draft results from Yahoo'),
      );
      return;
    }
    setPreview(data);
    setTeamMapping({});
    setPlayerResolutions({});
  }

  const unresolvedPicks = preview?.picks.filter((p) => !p.resolved_player_id) ?? [];
  const teamMappingComplete = preview ? preview.teams.every((t) => teamMapping[t.team_key]) : false;
  const playerResolutionsComplete = unresolvedPicks.every((p) => playerResolutions[p.player_key]);
  const readyToImport = !!preview && teamMappingComplete && playerResolutionsComplete;

  async function runImport() {
    if (!preview || !season) return;
    setError(null);
    setLoading(true);
    const resolutions: Record<string, { player_id?: string; create_new?: boolean }> = {};
    for (const [playerKey, value] of Object.entries(playerResolutions)) {
      resolutions[playerKey] = value === '__create_new__' ? { create_new: true } : { player_id: value };
    }
    const { data, error: fnError } = await supabase.functions.invoke('yahoo-draft-import', {
      body: {
        league_id: league.id,
        season_id: season.id,
        yahoo_league_key: yahooLeagueKey,
        commit: true,
        team_mapping: teamMapping,
        player_resolutions: resolutions,
      },
    });
    setLoading(false);
    if (fnError || (data && 'error' in data)) {
      setError(
        (data && 'error' in data && (data as { error: string }).error) ||
          (fnError instanceof Error ? fnError.message : 'Import failed'),
      );
      return;
    }
    setImportResults(data.results);
    setPreview(null);
  }

  if (connected === null) return <p>Checking Yahoo connection...</p>;

  return (
    <section>
      <h2>Yahoo Import{season ? ` — ${season.year}` : ''}</h2>
      {error && <p className="error">{error}</p>}

      {!connected && (
        <div>
          <p>Not connected to Yahoo yet.</p>
          <button onClick={connectToYahoo}>Connect to Yahoo</button>
        </div>
      )}

      {connected && !season && <p>Select a season on the Seasons tab to import a draft into it.</p>}

      {connected && season && (
        <>
          <p>Connected to Yahoo.</p>
          <div className="inline-form">
            <label htmlFor="yahoo-league-key">Yahoo league key</label>
            <input
              id="yahoo-league-key"
              value={yahooLeagueKey}
              onChange={(e) => setYahooLeagueKey(e.target.value)}
              placeholder="e.g. 449.l.123456"
            />
            <button onClick={saveLeagueKey} disabled={!yahooLeagueKey}>
              Save
            </button>
            <button onClick={fetchDraftResults} disabled={!yahooLeagueKey || loading}>
              {loading ? 'Fetching...' : 'Fetch Draft Results'}
            </button>
          </div>

          {preview && (
            <>
              <h3>Map Yahoo teams to your managers</h3>
              <table>
                <thead>
                  <tr>
                    <th>Yahoo team</th>
                    <th>Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.teams.map((t) => (
                    <tr key={t.team_key}>
                      <td>{t.name}</td>
                      <td>
                        <select
                          value={teamMapping[t.team_key] ?? ''}
                          onChange={(e) =>
                            setTeamMapping((m) => ({ ...m, [t.team_key]: e.target.value }))
                          }
                        >
                          <option value="">Select manager</option>
                          {managerSeasons.map((ms) => (
                            <option key={ms.id} value={ms.id}>
                              {ms.team_name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>Draft results ({preview.picks.length} picks)</h3>
              <table>
                <thead>
                  <tr>
                    <th>Round</th>
                    <th>Pick</th>
                    <th>Yahoo player</th>
                    <th>NFL team</th>
                    <th>Position</th>
                    <th>Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.picks.map((p) => (
                    <tr key={p.player_key}>
                      <td>{p.round}</td>
                      <td>{p.pick}</td>
                      <td>{p.yahoo_name}</td>
                      <td>{p.nfl_team ?? ''}</td>
                      <td>{p.position ?? ''}</td>
                      <td>
                        {p.resolved_player_id ? (
                          <span>Matched ({p.matched_by === 'yahoo_id' ? 'Yahoo ID' : 'name'})</span>
                        ) : (
                          <select
                            value={playerResolutions[p.player_key] ?? ''}
                            onChange={(e) =>
                              setPlayerResolutions((r) => ({ ...r, [p.player_key]: e.target.value }))
                            }
                          >
                            <option value="">Resolve...</option>
                            <option value="__create_new__">Create new player: {p.yahoo_name}</option>
                            {players.map((pl) => (
                              <option key={pl.id} value={pl.id}>
                                Match to existing: {pl.full_name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button onClick={runImport} disabled={!readyToImport || loading}>
                {loading ? 'Importing...' : 'Import Draft Results'}
              </button>
              {!teamMappingComplete && <p>Map every Yahoo team to a manager before importing.</p>}
              {teamMappingComplete && !playerResolutionsComplete && (
                <p>Resolve every unmatched player before importing.</p>
              )}
            </>
          )}

          {importResults && (
            <>
              <h3>Import results</h3>
              <p>
                {importResults.filter((r) => r.status === 'imported').length} imported,{' '}
                {importResults.filter((r) => r.status === 'error').length} errors
              </p>
              <ul>
                {importResults
                  .filter((r) => r.status === 'error')
                  .map((r) => (
                    <li key={r.player_key}>
                      {r.player_key}: {r.message}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
