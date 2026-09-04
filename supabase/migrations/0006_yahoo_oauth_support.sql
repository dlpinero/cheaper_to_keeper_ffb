-- Phase 4: Yahoo OAuth + draft import support.

-- Yahoo's refresh_token grant is called with the same redirect_uri used during the
-- initial code exchange; store it alongside the tokens so yahoo-draft-import's
-- refresh path doesn't need it passed in from the frontend on every call.
alter table yahoo_oauth_tokens add column redirect_uri text;

-- One league only ever has one live Yahoo connection — re-authorizing should
-- replace it, not accumulate rows.
alter table yahoo_oauth_tokens add constraint yahoo_oauth_tokens_league_id_key unique (league_id);

-- Lets the Commissioner Console show "Connected"/"Not connected" without ever
-- granting SELECT on yahoo_oauth_tokens itself (which stays policy-free/service-role-only).
create or replace function is_yahoo_connected(p_league_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from yahoo_oauth_tokens where league_id = p_league_id
  );
$$;
