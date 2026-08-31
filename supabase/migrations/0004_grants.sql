-- New tables created directly in the SQL Editor don't automatically pick up the
-- usual Supabase default grants for anon/authenticated/service_role — only the
-- owning role (postgres) gets table privileges by default in plain Postgres.
-- RLS policies (0002) still gate per-row access; these grants just allow the
-- authenticated/service_role roles to reach the table at all.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated, service_role;

-- So future tables created the same way don't hit this again.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
