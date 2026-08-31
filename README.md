# Keeper League Manager

A tool for managing a fantasy football keeper league year to year: tracks keeper eligibility and
escalating draft-round cost per player, lets each manager privately submit their own keeper picks,
and keeps picks hidden from other managers until you finalize your own.

See the [full design plan](../../../../Users/Daddy%20Pinero/.claude/plans/cheerful-weaving-petal.md)
for the complete rule set, schema, and phased build order.

## Local development

```
npm install
npm run dev
npm test
```

## Build & deploy

Pushing to `main` builds the app and deploys it to GitHub Pages automatically (see
`.github/workflows/deploy.yml`). The site will be available at
`https://<your-github-username>.github.io/cheaper_to_keeper_ffb/`.

## Supabase setup (one-time)

1. In the Supabase dashboard, open **SQL Editor** for your project.
2. Run these three files, in order, pasting each one's contents and clicking Run:
   - `supabase/migrations/0001_init_schema.sql`
   - `supabase/migrations/0002_rls_policies.sql`
   - `supabase/migrations/0003_rpc_functions.sql`
3. Bootstrap yourself as the first commissioner (the app can't do this step itself —
   every write is gated behind `is_commissioner()`, and nobody is a commissioner yet).
   Run this in the SQL Editor, filling in your own values:

   ```sql
   insert into leagues (name) values ('Your League Name') returning id;
   -- copy the returned id into league_id below
   insert into managers (league_id, display_name, email, role)
   values ('<league-id-from-above>', 'Your Name', 'you@example.com', 'commissioner');
   ```

4. In **Authentication → URL Configuration**, add your dev and prod URLs (e.g.
   `http://localhost:5174` and `https://<user>.github.io/cheaper_to_keeper_ffb/`) as
   redirect URLs so magic links work.
5. Sign in on the app with the email you used above — `claim_manager_seat()` links
   your login to that manager row automatically on first sign-in.

## Status

Phase 2 (Supabase schema + Commissioner Console) in progress. See the plan doc for the full
phase breakdown.
