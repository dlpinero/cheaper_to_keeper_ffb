// Shared helpers for the yahoo-oauth-exchange and yahoo-draft-import Edge Functions.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const YAHOO_TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';
export const YAHOO_FANTASY_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Verifies the caller is an authenticated commissioner. Throws a Response to short-circuit. */
export async function requireCommissioner(req: Request): Promise<{
  callerClient: SupabaseClient;
  adminClient: SupabaseClient;
}> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: isCommissioner, error: authCheckErr } = await callerClient.rpc('is_commissioner');
  if (authCheckErr || !isCommissioner) throw json({ error: 'Forbidden: commissioner only' }, 403);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  return { callerClient, adminClient };
}

/**
 * Returns a live Yahoo access token for the league, refreshing it first if it's
 * within 60s of expiring. Yahoo access tokens are short-lived (~1hr); refresh_token
 * is long-lived and reused indefinitely (Yahoo does not rotate it on refresh).
 */
export async function getValidAccessToken(adminClient: SupabaseClient, leagueId: string): Promise<string> {
  const { data: tokenRow, error } = await adminClient
    .from('yahoo_oauth_tokens')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !tokenRow) {
    throw json({ error: 'Not connected to Yahoo yet for this league.' }, 400);
  }

  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) {
    return tokenRow.access_token;
  }

  const clientId = Deno.env.get('YAHOO_CLIENT_ID')!;
  const clientSecret = Deno.env.get('YAHOO_CLIENT_SECRET')!;
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch(YAHOO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRow.refresh_token,
      redirect_uri: tokenRow.redirect_uri ?? '',
    }),
  });
  const refreshed = await res.json();
  if (!res.ok || !refreshed.access_token) {
    throw json({ error: `Yahoo token refresh failed: ${refreshed.error_description ?? res.statusText}` }, 502);
  }

  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await adminClient
    .from('yahoo_oauth_tokens')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? tokenRow.refresh_token,
      expires_at: newExpiresAt,
    })
    .eq('id', tokenRow.id);

  return refreshed.access_token;
}

/** Fetches a Yahoo Fantasy API path (relative to YAHOO_FANTASY_BASE) as parsed JSON. */
export async function yahooGet(accessToken: string, path: string): Promise<unknown> {
  const separator = path.includes('?') ? '&' : '?';
  const res = await fetch(`${YAHOO_FANTASY_BASE}${path}${separator}format=json`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw json({ error: `Yahoo API error: ${res.status} ${JSON.stringify(body)}` }, 502);
  }
  return body;
}

/**
 * Yahoo's JSON is a direct XML->JSON translation: collections show up as objects
 * keyed "0", "1", ... alongside a "count" key, and the field you want can be
 * nested at varying depths/positions depending on the resource. Rather than
 * relying on fixed indices (which breaks the moment Yahoo includes/omits an
 * optional field), this walks the whole tree and collects every object that has
 * ALL of the given keys — that's "one record" in Yahoo's collection.
 * NOTE: shape is based on Yahoo's documented/community-reverse-engineered format,
 * not verified against a live call (no API access yet at time of writing) —
 * expect to adjust this once real responses are available.
 */
export function findRecordsWithKeys(node: unknown, keys: string[]): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  function visit(n: unknown) {
    if (Array.isArray(n)) {
      for (const item of n) visit(item);
      return;
    }
    if (n && typeof n === 'object') {
      const obj = n as Record<string, unknown>;
      if (keys.every((k) => k in obj)) {
        results.push(obj);
      }
      for (const value of Object.values(obj)) visit(value);
    }
  }
  visit(node);
  return results;
}

/** Deep-searches for the first value found under the given key anywhere in the tree. */
export function findFirstValue(node: unknown, key: string): unknown {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirstValue(item, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (key in obj) return obj[key];
    for (const value of Object.values(obj)) {
      const found = findFirstValue(value, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}
