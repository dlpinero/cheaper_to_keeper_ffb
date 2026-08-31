-- Keeper League Manager: initial schema
-- Single-league app: one row in `leagues` is expected, but the schema doesn't hard-enforce that.

create extension if not exists "pgcrypto";

create type season_status as enum (
  'setup',           -- roster/season being configured
  'draft_complete',  -- live Yahoo draft has happened, picks imported/entered
  'regular_season',
  'playoffs_complete', -- keeper eligibility window has closed for the season
  'keepers_open',    -- managers can submit keeper selections for the following season
  'keepers_locked'   -- all keeper selections finalized/locked for next draft
);

create type manager_role as enum ('commissioner', 'manager');

create type draft_pick_source as enum ('yahoo_import', 'manual');

create type lineage_origin as enum ('drafted', 'kept_normal', 'kept_injury_exempt');

create type exemption_status as enum ('pending', 'approved', 'denied');

create type keeper_selection_status as enum ('draft', 'finalized');

create type override_reason as enum ('injury', 'retirement', 'suspension');

create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  yahoo_league_key text,
  created_at timestamptz not null default now()
);

create table seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  year int not null,
  status season_status not null default 'setup',
  consolation_champion_manager_season_id uuid, -- FK added after manager_seasons exists
  created_at timestamptz not null default now(),
  unique (league_id, year)
);

create table managers (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  display_name text not null,
  email text not null,
  user_id uuid references auth.users(id), -- null until first magic-link login
  role manager_role not null default 'manager',
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (league_id, email)
);

create table manager_seasons (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references managers(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  team_name text not null,
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (manager_id, season_id)
);

alter table seasons
  add constraint seasons_consolation_champion_fk
  foreign key (consolation_champion_manager_season_id) references manager_seasons(id);

create table players (
  id uuid primary key default gen_random_uuid(),
  external_yahoo_player_id text unique,
  full_name text not null,
  nfl_team text,
  position text,
  created_at timestamptz not null default now()
);

create table draft_picks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  manager_season_id uuid not null references manager_seasons(id) on delete cascade,
  player_id uuid not null references players(id),
  round int not null,
  pick_in_round int not null,
  overall_pick int not null,
  is_keeper_pick boolean not null default false,
  source draft_pick_source not null default 'manual',
  created_at timestamptz not null default now(),
  unique (season_id, overall_pick)
);

create table player_seasons (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  manager_season_id uuid not null references manager_seasons(id) on delete cascade,
  player_id uuid not null references players(id),
  games_missed_injury int not null default 0,
  roster_continuity_eligible boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (season_id, player_id)
);

-- Append-only: single source of truth for compounding keeper-round math.
-- The engine always reads the most recent entry per player, never re-derives from
-- the original draft round.
create table keeper_lineage (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id),
  season_id uuid not null references seasons(id) on delete cascade,
  manager_season_id uuid not null references manager_seasons(id) on delete cascade,
  slot_round int not null,
  origin lineage_origin not null,
  locked_forever boolean not null default false,
  derived_from_lineage_id uuid references keeper_lineage(id),
  created_at timestamptz not null default now(),
  unique (season_id, player_id)
);

create table injury_exemption_claims (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  manager_season_id uuid not null references manager_seasons(id) on delete cascade,
  player_id uuid not null references players(id),
  games_missed int not null,
  claimed_by_manager_id uuid not null references managers(id),
  claim_notes text,
  status exemption_status not null default 'pending',
  reviewed_by_commissioner_id uuid references managers(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Header row. This is what RLS privacy gates on.
create table keeper_selections (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  manager_season_id uuid not null references manager_seasons(id) on delete cascade,
  status keeper_selection_status not null default 'draft',
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (season_id, manager_season_id)
);

create table keeper_selection_picks (
  id uuid primary key default gen_random_uuid(),
  keeper_selection_id uuid not null references keeper_selections(id) on delete cascade,
  season_id uuid not null, -- denormalized for simple/fast RLS
  manager_season_id uuid not null, -- denormalized for simple/fast RLS
  player_id uuid not null references players(id),
  slot_round int not null,
  is_injury_exempt_slot boolean not null default false,
  created_at timestamptz not null default now()
);

create table commissioner_overrides (
  id uuid primary key default gen_random_uuid(),
  keeper_selection_pick_id uuid not null references keeper_selection_picks(id),
  season_id uuid not null references seasons(id),
  manager_season_id uuid not null references manager_seasons(id),
  reason override_reason not null,
  previous_player_id uuid not null references players(id),
  new_player_id uuid not null references players(id),
  previous_slot_round int not null,
  new_slot_round int not null,
  notes text,
  performed_by_commissioner_id uuid not null references managers(id),
  performed_at timestamptz not null default now()
);

-- Yahoo OAuth tokens: no client-readable RLS policy at all (see 0002). Only the
-- Edge Function, using the service-role key, ever touches this table.
create table yahoo_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index on manager_seasons (season_id);
create index on manager_seasons (manager_id);
create index on draft_picks (season_id);
create index on draft_picks (manager_season_id);
create index on keeper_lineage (player_id);
create index on keeper_lineage (season_id);
create index on keeper_selection_picks (keeper_selection_id);
create index on keeper_selection_picks (season_id, manager_season_id);
create index on injury_exemption_claims (season_id, manager_season_id);
