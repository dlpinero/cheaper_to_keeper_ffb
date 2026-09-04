// Hand-written to match supabase/migrations/0001_init_schema.sql.
// Once the project is linked via the Supabase CLI, this can be regenerated with
// `supabase gen types typescript` instead.
//
// These are `type` aliases, not `interface`s, on purpose: postgrest-js's generic
// constraints check assignability to `Record<string, unknown>`, and plain
// interfaces (unlike type-literal aliases) aren't assignable to index-signature
// types without an explicit index signature — using `interface` here silently
// breaks all query typing (everything degrades to `never`).

export type SeasonStatus =
  | 'setup'
  | 'draft_complete'
  | 'regular_season'
  | 'playoffs_complete'
  | 'keepers_open'
  | 'keepers_locked';

export type ManagerRole = 'commissioner' | 'manager';
export type DraftPickSource = 'yahoo_import' | 'manual';
export type LineageOrigin = 'drafted' | 'kept_normal' | 'kept_injury_exempt';
export type ExemptionStatus = 'pending' | 'approved' | 'denied';
export type KeeperSelectionStatus = 'draft' | 'finalized';
export type OverrideReason = 'injury' | 'retirement' | 'suspension';

export type League = {
  id: string;
  name: string;
  yahoo_league_key: string | null;
  created_at: string;
};

export type Season = {
  id: string;
  league_id: string;
  year: number;
  status: SeasonStatus;
  consolation_champion_manager_season_id: string | null;
  created_at: string;
};

export type Manager = {
  id: string;
  league_id: string;
  display_name: string;
  email: string;
  user_id: string | null;
  role: ManagerRole;
  deactivated_at: string | null;
  created_at: string;
};

export type ManagerSeason = {
  id: string;
  manager_id: string;
  season_id: string;
  team_name: string;
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
};

export type Player = {
  id: string;
  external_yahoo_player_id: string | null;
  full_name: string;
  nfl_team: string | null;
  position: string | null;
  created_at: string;
};

export type DraftPick = {
  id: string;
  season_id: string;
  manager_season_id: string;
  player_id: string;
  round: number;
  pick_in_round: number;
  overall_pick: number;
  is_keeper_pick: boolean;
  source: DraftPickSource;
  created_at: string;
};

export type PlayerSeason = {
  id: string;
  season_id: string;
  manager_season_id: string;
  player_id: string;
  games_missed_injury: number;
  roster_continuity_eligible: boolean;
  notes: string | null;
  created_at: string;
};

export type KeeperLineage = {
  id: string;
  player_id: string;
  season_id: string;
  manager_season_id: string;
  slot_round: number;
  origin: LineageOrigin;
  locked_forever: boolean;
  derived_from_lineage_id: string | null;
  created_at: string;
};

export type InjuryExemptionClaim = {
  id: string;
  season_id: string;
  manager_season_id: string;
  player_id: string;
  games_missed: number;
  claimed_by_manager_id: string;
  claim_notes: string | null;
  status: ExemptionStatus;
  reviewed_by_commissioner_id: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type KeeperSelection = {
  id: string;
  season_id: string;
  manager_season_id: string;
  status: KeeperSelectionStatus;
  finalized_at: string | null;
  created_at: string;
};

export type KeeperSelectionPick = {
  id: string;
  keeper_selection_id: string;
  season_id: string;
  manager_season_id: string;
  player_id: string;
  slot_round: number;
  is_injury_exempt_slot: boolean;
  created_at: string;
};

export type CommissionerOverride = {
  id: string;
  keeper_selection_pick_id: string;
  season_id: string;
  manager_season_id: string;
  reason: OverrideReason;
  previous_player_id: string;
  new_player_id: string;
  previous_slot_round: number;
  new_slot_round: number;
  notes: string | null;
  performed_by_commissioner_id: string;
  performed_at: string;
};

// Minimal Database shape for supabase-js generics. Not exhaustive (Insert/Update
// are just Partial<Row>, and Relationships/Views/Functions are stubbed empty since
// postgrest-js's GenericTable/GenericSchema require them to be present) — good
// enough until `supabase gen types` replaces this file.
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      leagues: Table<League>;
      seasons: Table<Season>;
      managers: Table<Manager>;
      manager_seasons: Table<ManagerSeason>;
      players: Table<Player>;
      draft_picks: Table<DraftPick>;
      player_seasons: Table<PlayerSeason>;
      keeper_lineage: Table<KeeperLineage>;
      injury_exemption_claims: Table<InjuryExemptionClaim>;
      keeper_selections: Table<KeeperSelection>;
      keeper_selection_picks: Table<KeeperSelectionPick>;
      commissioner_overrides: Table<CommissionerOverride>;
    };
    Views: Record<string, never>;
    Functions: {
      claim_manager_seat: { Args: Record<string, never>; Returns: Manager };
      finalize_keeper_selection: { Args: { p_keeper_selection_id: string }; Returns: void };
      commissioner_override_pick: {
        Args: {
          p_pick_id: string;
          p_new_player_id: string;
          p_new_slot_round: number;
          p_reason: OverrideReason;
          p_notes: string | null;
        };
        Returns: void;
      };
      is_yahoo_connected: { Args: { p_league_id: string }; Returns: boolean };
    };
  };
};
