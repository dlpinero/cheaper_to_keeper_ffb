-- A "franchise" is a persistent competitive seat in the league, independent of both
-- the team name (which a manager can rename year to year) and the manager (which can
-- change hands entirely). manager_seasons.franchise_id links a given year's team to
-- the seat it belongs to, so history can be browsed by seat rather than by person.
-- This is purely a display/bookkeeping layer — the keeper-math engine already tracks
-- continuity per player via keeper_lineage, independent of any of this.

create table franchises (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id),
  created_at timestamptz not null default now()
);

alter table manager_seasons add column franchise_id uuid references franchises(id);

alter table franchises enable row level security;

create policy "franchises_read_all" on franchises for select using (auth.uid() is not null);
create policy "franchises_write_commissioner" on franchises for all
  using (is_commissioner()) with check (is_commissioner());

-- One-time backfill: every manager who already has manager_seasons rows gets their own solo
-- franchise, so existing history isn't left with a null franchise_id. Going forward the
-- commissioner merges/splits seats from the Managers tab.
do $$
declare
  m record;
  new_franchise_id uuid;
begin
  for m in
    select distinct ms.manager_id, mgr.league_id
    from manager_seasons ms
    join managers mgr on mgr.id = ms.manager_id
  loop
    insert into franchises (league_id) values (m.league_id) returning id into new_franchise_id;
    update manager_seasons set franchise_id = new_franchise_id where manager_id = m.manager_id;
  end loop;
end $$;
