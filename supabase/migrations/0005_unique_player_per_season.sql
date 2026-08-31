-- A player can only be drafted once per season (one team, one pick) — prevents
-- accidental double-entry of the same player across two draft picks.
alter table draft_picks
  add constraint draft_picks_unique_player_per_season unique (season_id, player_id);
