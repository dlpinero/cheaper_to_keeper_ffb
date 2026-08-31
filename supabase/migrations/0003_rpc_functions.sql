-- SECURITY DEFINER RPCs for mutations that must be audited or business-rule-gated.

-- First-login self-claim: links the authenticated user to the manager seat the
-- commissioner pre-created for their email. managers is otherwise commissioner-write-
-- only (see 0002), so without this a manager could never complete their own login.
create or replace function claim_manager_seat()
returns managers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_manager managers%rowtype;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'not authenticated';
  end if;

  select * into v_manager from managers where lower(email) = lower(v_email);
  if v_manager.id is null then
    raise exception 'no manager seat found for this email; ask the commissioner to add you';
  end if;

  if v_manager.user_id is not null and v_manager.user_id <> auth.uid() then
    raise exception 'this manager seat is already claimed by a different account';
  end if;

  update managers set user_id = auth.uid() where id = v_manager.id
  returning * into v_manager;

  return v_manager;
end;
$$;

-- Manager finalizes their own keeper selection. Locks it so keeper_selection_picks
-- RLS update/delete policies stop allowing edits (see 0002).
create or replace function finalize_keeper_selection(p_keeper_selection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager_season_id uuid;
  v_season_id uuid;
begin
  select manager_season_id, season_id
  into v_manager_season_id, v_season_id
  from keeper_selections
  where id = p_keeper_selection_id;

  if v_manager_season_id is null then
    raise exception 'keeper selection not found';
  end if;

  if v_manager_season_id <> my_manager_season(v_season_id) then
    raise exception 'not authorized to finalize this selection';
  end if;

  update keeper_selections
  set status = 'finalized', finalized_at = now()
  where id = p_keeper_selection_id
    and status = 'draft';
end;
$$;

-- Commissioner-only, audited override of an already-finalized pick. Only permitted
-- for injury, retirement, or suspension.
create or replace function commissioner_override_pick(
  p_pick_id uuid,
  p_new_player_id uuid,
  p_new_slot_round int,
  p_reason override_reason,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pick keeper_selection_picks%rowtype;
  v_selection keeper_selections%rowtype;
  v_commissioner_id uuid;
begin
  if not is_commissioner() then
    raise exception 'not authorized: commissioner only';
  end if;

  select id into v_commissioner_id from managers where user_id = auth.uid();

  select * into v_pick from keeper_selection_picks where id = p_pick_id;
  if v_pick.id is null then
    raise exception 'pick not found';
  end if;

  select * into v_selection from keeper_selections where id = v_pick.keeper_selection_id;
  if v_selection.status <> 'finalized' then
    raise exception 'can only override a finalized pick';
  end if;

  insert into commissioner_overrides (
    keeper_selection_pick_id, season_id, manager_season_id, reason,
    previous_player_id, new_player_id, previous_slot_round, new_slot_round,
    notes, performed_by_commissioner_id
  ) values (
    p_pick_id, v_pick.season_id, v_pick.manager_season_id, p_reason,
    v_pick.player_id, p_new_player_id, v_pick.slot_round, p_new_slot_round,
    p_notes, v_commissioner_id
  );

  update keeper_selection_picks
  set player_id = p_new_player_id, slot_round = p_new_slot_round
  where id = p_pick_id;
end;
$$;
