-- Average Draft Position per player, scoped to the season whose upcoming draft it applies to.
-- Feeds rule 7 (undrafted player's keeper round = ADP round + 2) and is otherwise just useful
-- context for managers/commissioner regardless of whether a player was drafted.

create table player_adp (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  player_id uuid not null references players(id),
  adp_round int not null check (adp_round between 1 and 16),
  source draft_pick_source not null default 'manual',
  created_at timestamptz not null default now(),
  unique (season_id, player_id)
);

alter table player_adp enable row level security;

-- Same shape as other reference data: any league member can read, only the
-- commissioner writes.
create policy "player_adp_read_all" on player_adp for select using (auth.uid() is not null);
create policy "player_adp_write_commissioner" on player_adp for all
  using (is_commissioner()) with check (is_commissioner());

create index on player_adp (season_id);
