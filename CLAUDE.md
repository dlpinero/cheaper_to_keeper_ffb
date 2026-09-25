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

**Unconfirmed hypothesis (2026-09-16, user-flagged):** the email submitted on the Developer
Application Confirmation Form (`https://sports.yahoo.com/developer/application-confirmation/`)
may have been `welcome2yankeeland@yahoo.com` (the user's fantasy-league email), which may NOT
match the Yahoo account the developer app (`T6cPHsgf`) is registered under, or the account that
received the DocuSign "all parties completed" notice.
- Confirmed 2026-09-16: the DocuSign completion notice went to the user's `dlpinero` (hotmail)
  address, NOT `welcome2yankeeland@yahoo.com`.
- Checked 2026-09-16 via browser, but that check was methodologically flawed — the browser was
  already signed into Yahoo as `welcome2yankeeland@yahoo.com` before navigating to the app page,
  so seeing an editable form (Client Secret included) wasn't independent proof of ownership.
  **User independently re-verified by signing out first and checking cold via the original
  link — confirmed the app (`T6cPHsgf`) is indeed owned by `welcome2yankeeland@yahoo.com`.**
  This supersedes the earlier flawed check; same conclusion, better evidence.
- **Mismatch confirmed**: app ownership = `welcome2yankeeland@yahoo.com`; DocuSign signer =
  `dlpinero` (hotmail). Still unconfirmed which email was actually typed into the Developer
  Application Confirmation Form on 09-11 — user isn't certain.
- This is a plausible root cause of the stuck provisioning: if Yahoo's backend can't reconcile
  "this app" + "this signed agreement" + "this confirmation form" as one consistent identity, it
  may silently fail to provision rather than surface an error. **Next step**: mention this
  three-way mismatch explicitly when emailing Yahoo's Fantasy API team
  (`fantasyapiapplications@yahoosports.com`), including the App ID (`T6cPHsgf`) and both emails
  involved, so they can reconcile it on their end.
- Confirmed 2026-09-23 via Supabase SQL Editor (`select email, user_id is not null as
  has_logged_in from managers`): every manager who has logged into the *app itself*
  (`dlpinero@hotmail.com`, `dlpinero+m1@hotmail.com`, `dlpinero+m2@hotmail.com` — test manager
  accounts via `+` aliasing) is on the `dlpinero` identity. `welcome2yankeeland@yahoo.com` is
  unrelated to app login — it's specifically the Yahoo account that owns the Yahoo *developer* app
  (`T6cPHsgf`), a separate system from our own Supabase-backed manager accounts.

**Re-tested 2026-09-23**: clicked "Connect to Yahoo" on the live site (logged in as `dlpinero@hotmail.com`,
Commissioner Console) — still `?error=invalid_scope&error_description=invalid+scope`. No change
since 09-11. Provisioning still not live; the mismatch theory above remains the leading explanation.

**Follow-up email sent 2026-09-23** (to `fantasyapiapplications@yahoosports.com`, the mismatch
noted above included) — **no response yet as of today.** Cross-verified the same day via an
independent `curl` check (see "Browser-free provisioning check" below) — same `invalid_scope`
result, confirming this isn't a stale/flaky reading.

**Browser automation note (2026-09-23):** if Claude-in-Chrome browser tools start failing with
"Script injection timed out" / "waited 45000ms for document_idle" on every page — including
simple ones — check `chrome://extensions` → Claude → **Site access**. If it's set to "On click,"
switch it to "On all sites." That was the actual cause of a multi-session browser-automation
outage; it was not a page-specific or codebase-specific bug.

**Browser-free provisioning check (found 2026-09-23, per the user's "avoid browser automation"
global preference):** the app's OAuth flow (`YahooImportPanel.tsx`'s `connectToYahoo()`) requests
scope `fspt-r`. Yahoo validates that scope BEFORE requiring any login, so a plain unauthenticated
`curl` reproduces the exact same `invalid_scope` signal as clicking "Connect to Yahoo" live —
no browser, no cookies, no session needed:

```
curl -s -D - -o /dev/null "https://api.login.yahoo.com/oauth2/request_auth?client_id=<VITE_YAHOO_CLIENT_ID from .env.local>&redirect_uri=https://dlpinero.github.io/cheaper_to_keeper_ffb/&response_type=code&scope=fspt-r&state=check"
```

Look at the `location:` header. As of 2026-09-23 it's:
`https://dlpinero.github.io/cheaper_to_keeper_ffb/?error=invalid_scope&error_description=invalid+scope`
— still not provisioned. Once Fantasy Sports is live, this should redirect somewhere else
entirely (a real Yahoo login/consent flow) or at minimum drop `error=invalid_scope`. **Use this
curl check instead of browser automation for the daily monitoring job going forward.**

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

**2026 ADP source for `player_adp` rows (2026-09-25):** Yahoo's public "Player List" page in
Research stats view (`https://football.fantasysports.yahoo.com/f1/537265/playersearch?&search=<name>&stat1=R_O`,
"Avg Pick" column) gives the real average draft position from actual completed 2026 drafts across
Yahoo leagues — not a shifting preseason projection, since this league's 2026 draft already
happened (Aug 28). Convert to a round for this 10-team league via `ceil(avg_pick / 10)`; there's
no existing helper for this, it was done ad hoc. A player with no Avg Pick at all (too rarely
drafted for Yahoo to average) gets `adp_round = 16` per user instruction ("16th round is the last
round for all eligibility") — rule 7 then adds +2 and caps at 16 anyway, so this just skips
straight to the cap rather than leaving the player stuck at `adp_pending`. Applied 2026-09-25 to
the 6 undrafted-but-kept players on the commissioner's own team (Ceedee burners obsolete): Will
Reichard (Avg Pick 142.7 -> round 15), 49ers/Browns DEF (123.5/129.7 -> round 13 each), Packers
DEF (134.4 -> round 14), Zach Ertz and Theo Johnson (no Avg Pick -> round 16). The other 9 teams'
undrafted-but-kept players (all currently `adp_pending`) haven't been done yet — same process:
look up each by name at that URL, convert, insert into `player_adp`.

**`keeper_lineage` does not self-heal — workflow rule (confirmed by user 2026-09-23):** both
manual entry (`DraftPicksPanel.tsx`) and `yahoo-draft-import` only *insert* a `keeper_lineage` row
if one doesn't already exist for that `(season_id, player_id)` — neither ever updates one. This is
intentional (`keeper_lineage` is append-only, the sole source of truth compounding math reads from
— overwriting it could silently invalidate already-finalized *later* seasons' keeper math that was
computed off it), but it means a manually-seeded season is never automatically corrected once real
Yahoo data comes in; `draft_picks` itself does upsert cleanly (`0005_unique_player_per_season.sql`
constraint), but `keeper_lineage` staying stale is the actual risk.
**Rule**: for any given season, pick one path and don't mix — either leave it alone for Yahoo
import (once Phase 4 unblocks) or enter it manually as a permanent historical record you'll never
re-import. Never manually seed a season you intend to later Yahoo-import. Concretely for this
league: 2026 (and any future season) should stay untouched until Yahoo import is live; seasons
2015–2025 are historical-only and safe to enter by hand anytime since they'll never be re-imported.

**2025 season seeded manually (2026-09-23)** — first real season data in the app. League/managers
were pulled from the actual Yahoo league site (`cheapertokeepernycfl`, league ID 434543 for 2025),
not the commissioner's own free-text Commish Notes (which are personal notes, not Yahoo data — do
not treat Commish Notes content as authoritative for anything). Manager emails are `@placeholder.local`
for everyone except the commissioner (`dlpinero@hotmail.com`, real, since only the commissioner
needs to log in during this trial phase) — **do not enter real manager emails into Supabase**
without the user's explicit go-ahead; see `data/managers_2025.csv` (git-ignored, local-only) for
the real emails on file if/when needed. Seed script: `data/gen_seed_2025.cjs` generates
`data/seed_2025.sql` from `data/draft_results_2025.csv` + the hardcoded manager/defense mappings in
the script — regenerate via `node data/gen_seed_2025.cjs` if the source CSV changes, don't hand-edit
the generated SQL. Result: 1 season, 9 new managers (+ reused the existing `dlpinero` row), 10
`manager_seasons`, 160 players (150 real + 10 team defenses, `position='DEF'`), 160 `draft_picks`,
160 `keeper_lineage` rows — verified via row counts and visually confirmed correct in the Draft
Picks tab. All of `data/` is git-ignored (added 2026-09-23) since it contains manager PII — never
remove that `.gitignore` entry without re-checking what's in the folder first.

**Keeper eligibility = the roster checkpoint, not the draft (user-confirmed 2026-09-24).** The draft
only sets a player's round + initial eligibility. A player is keeper-eligible only if he was on the
same manager's roster at the end of week 14 (last regular-season week) and stayed through week 17
(end of playoffs); dropped in wk15-17, or not on that roster at wk14 => not eligible. A drafted
player picked up off waivers by another team keeps his original draft round (user-confirmed). No
trades happened in 2025. Modeled with `player_seasons` (unique per season+player): `manager_season_id`
= holder at the wk14 checkpoint, `roster_continuity_eligible` = held through wk17, `notes` = why not.
`src/lib/keeperCandidates.ts` (`buildKeeperCandidates`, unit-tested) is the single builder used by
BOTH `KeeperPortal` and `KeeperLineagePreview`: a checkpoint row overrides the drafting manager
(so `keeper_lineage` is never touched for trades/pickups), and undrafted players held wk14-17 use
rule 7 (next-draft ADP + 2) — shown as `adp_pending` until `player_adp` has a value (2026 ADP
comes from Yahoo; not available yet). The `?? true` default for a player with no checkpoint row is
still there: for a NEW season, checkpoint rows must be recorded or everyone drafted looks eligible.
2025 data loaded 2026-09-24 via the SQL Editor: 213 `player_seasons` rows (165 wk14-rostered +
48 draftees on no roster) and 53 new `players` (44 kept undrafted pickups + 9 dropped; 10 are team
defenses, `position='DEF'`). Source pulled from Yahoo (`/2025/f1/434543/<team_id>?week=N`, team ids
1-10, plus `/transactions`); local files in git-ignored `data/`: `rosters_2025.json`,
`checkpoint_2025_rows.json`, `gen_checkpoint_2025.cjs` -> `seed_checkpoint_2025.sql`.
Verified: 150 kept through wk17 (93 drafted-by-same-team, 13 drafted-by-another-team waiver pickups,
44 undrafted), 15 dropped after wk14. Roster-scoped dropdowns in Overrides/Injury Claims still key
off `keeper_lineage` (drafter), so they don't list undrafted pickups or waiver pickups yet.

**Removed the 2 scaffolding test manager accounts (2026-09-24)** — "Test Manager One"
(`dlpinero+m1@hotmail.com`) and "Test Manager Two" (`dlpinero+m2@hotmail.com`) were leftover dev
scaffolding, unrelated to the real league. Verified 0 `manager_seasons`/injury claims before
deleting (safe, no cascade impact). Only real managers remain: the commissioner (`dlpinero`) +
9 placeholder-email managers from the 2025 seed.

**Browser automation note**: pasting a large (10k+ char) single-line SQL string into Supabase's
Monaco-based SQL Editor via synthetic keystrokes makes the tab briefly unresponsive to
screenshot/read actions (CDP script-injection timeouts) while Monaco processes it — this is normal,
not a crash. Wait ~10-20s and retry `get_page_text` (not `screenshot`, which times out faster);
the content lands correctly despite the errors. Don't re-type or navigate away thinking it failed.

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
