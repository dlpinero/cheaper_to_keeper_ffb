-- Row Level Security: the real trust boundary between rival managers.
-- SECURITY DEFINER helper functions bypass RLS safely so they can be used *inside*
-- policies without causing policy recursion.

alter table leagues enable row level security;
alter table seasons enable row level security;
alter table managers enable row level security;
alter table manager_seasons enable row level security;
alter table players enable row level security;
alter table draft_picks enable row level security;
alter table player_seasons enable row level security;
alter table keeper_lineage enable row level security;
alter table injury_exemption_claims enable row level security;
alter table keeper_selections enable row level security;
alter table keeper_selection_picks enable row level security;
alter table commissioner_overrides enable row level security;
-- yahoo_oauth_tokens: RLS enabled, NO policies at all. Only service-role (Edge
-- Functions) can touch it; that role bypasses RLS entirely.
alter table yahoo_oauth_tokens enable row level security;

-- Resolves the logged-in user's own manager_seasons row for a given season.
create or replace function my_manager_season(p_season_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select ms.id
  from manager_seasons ms
  join managers m on m.id = ms.manager_id
  where ms.season_id = p_season_id
    and m.user_id = auth.uid()
  limit 1;
$$;

create or replace function is_commissioner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from managers
    where user_id = auth.uid()
      and role = 'commissioner'
      and deactivated_at is null
  );
$$;

-- Has the logged-in user finalized their own keeper picks for this season.
create or replace function i_have_finalized(p_season_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from keeper_selections ks
    where ks.season_id = p_season_id
      and ks.manager_season_id = my_manager_season(p_season_id)
      and ks.status = 'finalized'
  );
$$;

-- Any authenticated league member can read league/season/roster/history data.
-- None of this is "someone's private pick" and the engine needs full lineage
-- visibility regardless of viewer.
create policy "leagues_read_all" on leagues for select using (auth.uid() is not null);
create policy "seasons_read_all" on seasons for select using (auth.uid() is not null);
create policy "managers_read_all" on managers for select using (auth.uid() is not null);
create policy "manager_seasons_read_all" on manager_seasons for select using (auth.uid() is not null);
create policy "players_read_all" on players for select using (auth.uid() is not null);
create policy "draft_picks_read_all" on draft_picks for select using (auth.uid() is not null);
create policy "player_seasons_read_all" on player_seasons for select using (auth.uid() is not null);
create policy "keeper_lineage_read_all" on keeper_lineage for select using (auth.uid() is not null);
create policy "commissioner_overrides_read_all" on commissioner_overrides for select using (auth.uid() is not null);

-- Injury exemption claims: any league member can read (they're evaluated in the
-- open, not a secret pick), but only the claiming manager or commissioner can write.
create policy "injury_claims_read_all" on injury_exemption_claims for select using (auth.uid() is not null);
create policy "injury_claims_insert_own" on injury_exemption_claims for insert
  with check (
    claimed_by_manager_id in (select id from managers where user_id = auth.uid())
    or is_commissioner()
  );
create policy "injury_claims_update_commissioner" on injury_exemption_claims for update
  using (is_commissioner());

-- Commissioner-only writes on reference/roster data. All mutations to these tables
-- happen from the Commissioner Console.
create policy "leagues_write_commissioner" on leagues for all
  using (is_commissioner()) with check (is_commissioner());
create policy "seasons_write_commissioner" on seasons for all
  using (is_commissioner()) with check (is_commissioner());
create policy "managers_write_commissioner" on managers for all
  using (is_commissioner()) with check (is_commissioner());
create policy "manager_seasons_write_commissioner" on manager_seasons for all
  using (is_commissioner()) with check (is_commissioner());
create policy "players_write_commissioner" on players for all
  using (is_commissioner()) with check (is_commissioner());
create policy "draft_picks_write_commissioner" on draft_picks for all
  using (is_commissioner()) with check (is_commissioner());
create policy "player_seasons_write_commissioner" on player_seasons for all
  using (is_commissioner()) with check (is_commissioner());
create policy "keeper_lineage_write_commissioner" on keeper_lineage for all
  using (is_commissioner()) with check (is_commissioner());

-- keeper_selections / keeper_selection_picks: the core privacy gate. Own row, or
-- the viewer has finalized their own picks for that season, or the viewer is the
-- commissioner.
create policy "keeper_selections_select" on keeper_selections for select
  using (
    manager_season_id = my_manager_season(season_id)
    or i_have_finalized(season_id)
    or is_commissioner()
  );
create policy "keeper_selections_insert_own" on keeper_selections for insert
  with check (manager_season_id = my_manager_season(season_id));
create policy "keeper_selections_update_own" on keeper_selections for update
  using (manager_season_id = my_manager_season(season_id) and status = 'draft');

create policy "keeper_selection_picks_select" on keeper_selection_picks for select
  using (
    manager_season_id = my_manager_season(season_id)
    or i_have_finalized(season_id)
    or is_commissioner()
  );
create policy "keeper_selection_picks_insert_own" on keeper_selection_picks for insert
  with check (
    manager_season_id = my_manager_season(season_id)
    and keeper_selection_id in (
      select id from keeper_selections where status = 'draft'
    )
  );
-- Once the parent selection is finalized, only the commissioner_override_pick()
-- RPC (SECURITY DEFINER, audited) may touch a pick row — not the owning manager.
create policy "keeper_selection_picks_update_own" on keeper_selection_picks for update
  using (
    manager_season_id = my_manager_season(season_id)
    and keeper_selection_id in (
      select id from keeper_selections where status = 'draft'
    )
  );
create policy "keeper_selection_picks_delete_own" on keeper_selection_picks for delete
  using (
    manager_season_id = my_manager_season(season_id)
    and keeper_selection_id in (
      select id from keeper_selections where status = 'draft'
    )
  );
