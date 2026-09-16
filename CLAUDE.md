# Cheaper To Keeper Manager

Fantasy football keeper-league manager app. Full architecture, confirmed keeper rules, schema,
and phased build plan live in the approved plan doc:
`C:\Users\Daddy Pinero\.claude\plans\cheerful-weaving-petal.md`

## Stack
- Vite + React + TypeScript, deployed to GitHub Pages via GitHub Actions.
- Supabase (Postgres + Auth + RLS) as backend — RLS is the real trust boundary between rival
  managers, not just app-code checks.
- Repo: `https://github.com/dlpinero/cheaper_to_keeper_ffb.git`, live at
  `https://dlpinero.github.io/cheaper_to_keeper_ffb/`.

## Status
Phases 0–2 complete. Phase 3 (Manager Portal) is in progress — magic-link/password login,
keeper selection, commissioner overrides, and injury exemption claims (both commissioner- and
manager-filed) are built. Phase 4 (Yahoo OAuth + draft import) is code-complete
(`b19b56e`, `8ef1e7c`) but **blocked**: Yahoo approved the API key application, but the key isn't
functional yet, so live Yahoo data can't be pulled until Yahoo activates it.

**Yahoo provisioning progress (as of 2026-09-15):**
1. ✅ Signed the DocuSign "Personal Use - API Access and Use Agreement."
2. ✅ Submitted the Developer Application Confirmation Form (name, email, client ID) — Yahoo's
   instructions say to submit it *whether or not* Fantasy Sports permissions are listed yet.
3. ❌ Checked the Yahoo Developer app page per Yahoo's instructions — **Fantasy Sports API
   permissions are still not listed/associated with the app.** Provisioning is not done.
   Verified directly via browser on 2026-09-15: the app's "API Permissions" section at
   https://developer.yahoo.com/apps/T6cPHsgf/ is completely empty — no checkboxes for ANY API
   render there yet, not just Fantasy Sports. This is not a self-service toggle in the app's own
   settings; it has to be provisioned server-side by Yahoo after they process the signed
   agreement + confirmation form.
Re-checked 3 days later (user-reported, still same in-session date): still completely empty,
no change from the 09-15 check. Per the user's own timeline it's now been 3 days since the
confirmation form was submitted with no provisioning — **next step is to reply to the Fantasy
API Team email** (the DocuSign/confirmation thread) noting the form was submitted but permissions
never appeared, rather than continuing to silently re-check.

## Standing workflow (established by prior sessions — follow this exactly)
After any code change:
1. `npx tsc --noEmit`
2. `npx eslint .`
3. `npm test -- --run`
4. `npm run build`
   (all must pass cleanly except one pre-existing unrelated `react-refresh/only-export-components`
   warning in `src/lib/AuthContext.tsx`)
5. Show the user the diff/summary and ask for explicit confirmation before `git commit`/`git push`.
6. After pushing, verify the GitHub Pages deploy via:
   `curl -s "https://api.github.com/repos/dlpinero/cheaper_to_keeper_ffb/actions/runs?per_page=3"`
   (grep for `"status"|"conclusion"|"head_sha"`) — poll every ~60-75s until the run for the pushed
   commit shows `"conclusion": "success"`. No `gh` CLI available; use `curl` directly.

Never type the user's password into a login field to test something live — ask them to verify
manually, or push+deploy and confirm via the Actions API instead.

## Key UI patterns to reuse
- **Sortable table columns**: see `src/components/commissioner/DraftPicksPanel.tsx` for the
  `SortKey` union + `sortKey`/`sortDir` state + `toggleSort`/`sortArrow` pattern (already also
  applied to `KeeperLineagePreview.tsx`).
- **Roster-scoped player dropdowns**: filter a player `<select>` to only players on the selected
  manager's roster for the season via `keeper_lineage` (manager_season_id + player_id), not the
  full `players` table. Used in `OverridesPanel.tsx`, `InjuryClaimsPanel.tsx`.
- **Season-year column labels**: use literal `{season.year} round` / `{season.year + 1} round if
  kept` instead of generic "Current round"/"Next round" labels, with the "round if kept" column
  placed before the current-round column. Established in `KeeperPortal.tsx`, replicated in
  `KeeperLineagePreview.tsx`.

## Data model note
"Team" means two different things depending on the tab:
- **Players tab**: `players.nfl_team` — the player's real NFL team, static, unrelated to the league.
- **Draft Picks / Injury Claims / Keeper Preview / Overrides tabs**: `manager_seasons.team_name` —
  the fantasy manager's team name for that specific season, resolved via `manager_season_id`.

**Manual entry is test-only, not a production data path** (confirmed by user 2026-09-15): the
`source` enum on `draft_picks`/`player_adp` (`'manual' | 'yahoo_import'`) exists because manual
entry was scaffolding to test the engine/UI before Yahoo import existed. For a real current-year
draft, all players and their ADP are expected to come from Yahoo once Phase 4 is unblocked —
nothing manual. Don't treat the Players-tab manual ADP input as a permanent fallback feature.

## Recent work (most recent first)
- Added ADP round display to the Players tab (`4496328`); code review flagged a data-loss bug
  where saving/adding a player wipes other unsaved ADP edits in `PlayersPanel.tsx` — not yet fixed.
- Passed `VITE_YAHOO_CLIENT_ID` into the production build (`8ef1e7c`).
- Built Yahoo OAuth + draft import, Phase 4 (`b19b56e`) — code-complete but blocked on Yahoo
  activating the approved API key; see Status above.
- Scoped the Injury Claims panel's player dropdown to the selected team's roster (was showing
  all players in the league regardless of team).
- Added sortable Team/Round columns and season-year column labels/order to the commissioner's
  Keeper Preview tab (`KeeperLineagePreview.tsx`), matching `KeeperPortal.tsx` and
  `DraftPicksPanel.tsx` patterns.
- Added sortable Team/Round columns to Draft Picks tab.
- Added manager-facing Injury Exemption request UI (`InjuryExemptionRequest.tsx`) — manager
  requests review only, doesn't self-report games missed; no RLS/schema changes were needed
  since `0002_rls_policies.sql` already permitted manager-initiated claims.
- Fixed Commissioner Overrides: replacement player's round must come from the replacement
  player's own `keeper_lineage` entry, not be inherited from the original finalized pick.
- Dropped consolation-champion UI from scope (display-only, not needed).

## Open/next
Waiting on Yahoo to activate the approved API key before Phase 4 can be tested/used live.
In the meantime: fix the ADP-editing data-loss bug in `PlayersPanel.tsx` (see Recent work above).
