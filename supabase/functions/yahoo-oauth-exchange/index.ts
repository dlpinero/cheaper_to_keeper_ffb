// Commissioner-only. Exchanges a Yahoo OAuth authorization code for access/refresh
// tokens and stores them. Must run server-side: the client secret can never ship
// to the browser bundle, and yahoo_oauth_tokens has no client-readable RLS policy
// at all (see 0002_rls_policies.sql) — only this function (service-role) touches it.
import { corsHeaders, json, requireCommissioner, YAHOO_TOKEN_URL } from '../_shared/yahoo.ts';

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

  let body: { league_id?: string; code?: string; redirect_uri?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { league_id, code, redirect_uri } = body;
  if (!league_id || !code || !redirect_uri) {
    return json({ error: 'league_id, code, and redirect_uri are required' }, 400);
  }

  const clientId = Deno.env.get('YAHOO_CLIENT_ID');
  const clientSecret = Deno.env.get('YAHOO_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return json({ error: 'Yahoo app credentials are not configured on the server yet.' }, 500);
  }
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const tokenRes = await fetch(YAHOO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      redirect_uri,
      code,
    }),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok || !token.access_token) {
    return json(
      { error: `Yahoo token exchange failed: ${token.error_description ?? tokenRes.statusText}` },
      502,
    );
  }

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  const { error: upsertErr } = await adminClient.from('yahoo_oauth_tokens').upsert(
    {
      league_id,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      redirect_uri,
      expires_at: expiresAt,
    },
    { onConflict: 'league_id' },
  );
  if (upsertErr) return json({ error: upsertErr.message }, 500);

  return json({ ok: true }, 200);
});
