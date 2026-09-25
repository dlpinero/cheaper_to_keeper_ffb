-- Commissioner-only, audited full reset of one manager's finalized keeper selection
-- back to draft — for "finalized in error" before the actual next draft has happened.
-- Unlike commissioner_override_pick (which swaps one player on one pick, for injury/
-- retirement/suspension only), this reopens the WHOLE selection so the manager can
-- freely re-pick and re-finalize themselves. Scoped to a single selection (one
-- manager/team), never the whole league.

alter type override_reason add value 'finalized_in_error';

create table commissioner_selection_resets (
  id uuid primary key default gen_random_uuid(),
  keeper_selection_id uuid not null references keeper_selections(id),
  season_id uuid not null references seasons(id),
  manager_season_id uuid not null references manager_seasons(id),
  reason override_reason not null,
  notes text,
  performed_by_commissioner_id uuid not null references managers(id),
  performed_at timestamptz not null default now()
);

alter table commissioner_selection_resets enable row level security;

create policy "commissioner_selection_resets_read_all" on commissioner_selection_resets
  for select using (auth.uid() is not null);

create or replace function commissioner_reset_keeper_selection(
  p_selection_id uuid,
  p_reason override_reason,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_selection keeper_selections%rowtype;
  v_commissioner_id uuid;
begin
  if not is_commissioner() then
    raise exception 'not authorized: commissioner only';
  end if;

  select id into v_commissioner_id from managers where user_id = auth.uid();

  select * into v_selection from keeper_selections where id = p_selection_id;
  if v_selection.id is null then
    raise exception 'keeper selection not found';
  end if;
  if v_selection.status <> 'finalized' then
    raise exception 'can only reset a finalized selection';
  end if;

  insert into commissioner_selection_resets (
    keeper_selection_id, season_id, manager_season_id, reason, notes, performed_by_commissioner_id
  ) values (
    p_selection_id, v_selection.season_id, v_selection.manager_season_id, p_reason, p_notes, v_commissioner_id
  );

  -- Picks are left as-is (still the manager's last attempt, visible as a starting
  -- point) — only the header flips back to draft, which re-opens the manager's own
  -- RLS-gated edit/delete access to their picks (those policies already check for
  -- status = 'draft').
  update keeper_selections
  set status = 'draft', finalized_at = null
  where id = p_selection_id;
end;
$$;
