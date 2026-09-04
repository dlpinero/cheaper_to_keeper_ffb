// Commissioner-only. Two modes, both driven by `commit`:
//   commit=false (preview): fetch Yahoo's teams + draft results + player metadata for
//     the given league, match players against our `players` table, and return
//     everything needed to build the reconciliation UI (team mapping, ambiguous/
//     unmatched player resolutions) WITHOUT writing anything.
//   commit=true: same fetch, but requires the frontend to supply a complete
//     `team_mapping` (Yahoo team_key -> our manager_season_id) and
//     `player_resolutions` (Yahoo player_key -> an existing player_id, or
//     instructions to create a new player row), then performs the actual writes.
//
// NOTE on Yahoo's JSON shape: the parsing here (findRecordsWithKeys/findFirstValue)
// is written defensively against Yahoo's documented XML-derived JSON format, since
// this was built before API access was approved and could not be tested against a
// live league. Smoke-test against a real draft the first time this runs for real,
// and adjust the field lookups in this file if Yahoo's actual shape differs.
import {
  corsHeaders,
  findFirstValue,
  findRecordsWithKeys,
  getValidAccessToken,
  json,
  requireCommissioner,
  yahooGet,
} from '../_shared/yahoo.ts';

interface YahooPick {
  pick: number;
  round: number;
  team_key: string;
  player_key: string;
}

interface YahooPlayerMeta {
  player_key: string;
  full_name: string;
  nfl_team: string | null;
  position: string | null;
}

interface PlayerResolution {
  player_id?: string;
  create_new?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let auth;
  try {
    auth = await requireCommissioner(req);
  } catch (res) {
    return res as Response;
  }
  const { adminClient } = auth;

  let body: {
    league_id?: string;
    season_id?: string;
    yahoo_league_key?: string;
    commit?: boolean;
    team_mapping?: Record<string, string>;
    player_resolutions?: Record<string, PlayerResolution>;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { league_id, season_id, yahoo_league_key, commit } = body;
  if (!league_id || !season_id || !yahoo_league_key) {
    return json({ error: 'league_id, season_id, and yahoo_league_key are required' }, 400);
  }
  const teamMapping = body.team_mapping ?? {};
  const playerResolutions = body.player_resolutions ?? {};

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(adminClient, league_id);
  } catch (res) {
    return res as Response;
  }

  // 1. Teams (for the team-mapping step of reconciliation).
  const teamsRaw = await yahooGet(accessToken, `/league/${yahoo_league_key}/teams`);
  const teamRecords = findRecordsWithKeys(teamsRaw, ['team_key', 'name']);
  const teams = dedupeBy(
    teamRecords.map((t) => ({ team_key: String(t.team_key), name: String(t.name) })),
    (t) => t.team_key,
  );

  // 2. Draft results.
  const draftRaw = await yahooGet(accessToken, `/league/${yahoo_league_key}/draftresults`);
  const pickRecords = findRecordsWithKeys(draftRaw, ['pick', 'round', 'team_key', 'player_key']);
  const picks: YahooPick[] = dedupeBy(
    pickRecords.map((p) => ({
      pick: Number(p.pick),
      round: Number(p.round),
      team_key: String(p.team_key),
      player_key: String(p.player_key),
    })),
    (p) => p.player_key,
  );

  // 3. Player metadata for every drafted player, batched into one call.
  const playerKeys = picks.map((p) => p.player_key);
  const playersRaw = playerKeys.length
    ? await yahooGet(accessToken, `/league/${yahoo_league_key}/players;player_keys=${playerKeys.join(',')}`)
    : null;
  const playerRecords = playersRaw ? findRecordsWithKeys(playersRaw, ['player_key', 'name']) : [];
  const playerMetaByKey = new Map<string, YahooPlayerMeta>();
  for (const rec of playerRecords) {
    const key = String(rec.player_key);
    const fullName = String(findFirstValue(rec.name, 'full') ?? findFirstValue(rec, 'full') ?? '');
    playerMetaByKey.set(key, {
      player_key: key,
      full_name: fullName,
      nfl_team: (findFirstValue(rec, 'editorial_team_abbr') as string) ?? null,
      position: (findFirstValue(rec, 'display_position') as string) ?? null,
    });
  }

  // 4. Match each drafted player against our `players` table: by external Yahoo ID
  // first (a returning player already imported before), then by exact case-
  // insensitive name (Yahoo mints a new player_key per game/season, so a returning
  // player's ID *will* differ from last year's — this is why name-matching and a
  // manual fallback both matter, not just ID matching).
  const { data: existingPlayers } = await adminClient.from('players').select('*');
  const byYahooId = new Map((existingPlayers ?? []).map((p) => [p.external_yahoo_player_id, p]));
  const byNameLower = new Map((existingPlayers ?? []).map((p) => [p.full_name.toLowerCase(), p]));

  const enrichedPicks = picks.map((pick) => {
    const meta = playerMetaByKey.get(pick.player_key);
    const idMatch = byYahooId.get(pick.player_key);
    const nameMatch = meta ? byNameLower.get(meta.full_name.toLowerCase()) : undefined;
    const resolvedPlayer = idMatch ?? nameMatch ?? null;
    return {
      ...pick,
      yahoo_name: meta?.full_name ?? '(unknown player)',
      nfl_team: meta?.nfl_team ?? null,
      position: meta?.position ?? null,
      resolved_player_id: resolvedPlayer?.id ?? null,
      matched_by: idMatch ? 'yahoo_id' : nameMatch ? 'name' : null,
    };
  });

  if (!commit) {
    return json({ teams, picks: enrichedPicks }, 200);
  }

  // --- Commit path: validate completeness, then write. ---
  const missingTeamMapping = teams.filter((t) => !teamMapping[t.team_key]);
  if (missingTeamMapping.length > 0) {
    return json(
      { error: `Missing team mapping for: ${missingTeamMapping.map((t) => t.name).join(', ')}` },
      400,
    );
  }
  const unresolved = enrichedPicks.filter((p) => !p.resolved_player_id && !playerResolutions[p.player_key]);
  if (unresolved.length > 0) {
    return json(
      { error: `Missing player resolution for: ${unresolved.map((p) => p.yahoo_name).join(', ')}` },
      400,
    );
  }

  const results: { player_key: string; status: 'imported' | 'error'; message?: string }[] = [];

  for (const pick of enrichedPicks) {
    try {
      let playerId = pick.resolved_player_id;

      if (!playerId) {
        const resolution = playerResolutions[pick.player_key];
        if (resolution?.player_id) {
          playerId = resolution.player_id;
          // Backfill the Yahoo ID so next season's import can match by ID directly.
          await adminClient
            .from('players')
            .update({ external_yahoo_player_id: pick.player_key })
            .eq('id', playerId);
        } else if (resolution?.create_new) {
          const { data: created, error: createErr } = await adminClient
            .from('players')
            .insert({
              external_yahoo_player_id: pick.player_key,
              full_name: pick.yahoo_name,
              nfl_team: pick.nfl_team,
              position: pick.position,
            })
            .select()
            .single();
          if (createErr || !created) throw new Error(createErr?.message ?? 'Could not create player');
          playerId = created.id;
        }
      }

      if (!playerId) throw new Error('No player resolution provided');

      const managerSeasonId = teamMapping[pick.team_key];
      const overallPick = (pick.round - 1) * teams.length + pick.pick;

      const { error: pickErr } = await adminClient.from('draft_picks').upsert(
        {
          season_id,
          manager_season_id: managerSeasonId,
          player_id: playerId,
          round: pick.round,
          pick_in_round: pick.pick,
          overall_pick: overallPick,
          is_keeper_pick: false,
          source: 'yahoo_import',
        },
        { onConflict: 'season_id,player_id' },
      );
      if (pickErr) throw new Error(pickErr.message);

      // Seed keeper_lineage the same way a manual fresh draft pick does (see
      // DraftPicksPanel.tsx) — imported picks aren't kept picks, so they're always
      // the starting point for compounding math, never derived from prior lineage.
      const { data: existingLineage } = await adminClient
        .from('keeper_lineage')
        .select('id')
        .eq('season_id', season_id)
        .eq('player_id', playerId)
        .maybeSingle();
      if (!existingLineage) {
        await adminClient.from('keeper_lineage').insert({
          player_id: playerId,
          season_id,
          manager_season_id: managerSeasonId,
          slot_round: pick.round,
          origin: 'drafted',
          locked_forever: false,
        });
      }

      results.push({ player_key: pick.player_key, status: 'imported' });
    } catch (e) {
      results.push({ player_key: pick.player_key, status: 'error', message: (e as Error).message });
    }
  }

  return json({ results }, 200);
});

function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const item of items) seen.set(keyFn(item), item);
  return [...seen.values()];
}
