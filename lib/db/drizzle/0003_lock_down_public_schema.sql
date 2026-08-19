-- Browser and mobile clients authenticate with Supabase Auth but use the API
-- for all domain data. Do not let PostgREST bypass server-side authorization.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

DO $$
DECLARE
  public_table record;
BEGIN
  FOR public_table IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', public_table.tablename);
  END LOOP;
END $$;

-- Clients may read their own role/profile only. The policy in 0001 enforces
-- auth.uid() = id; this grant does not allow access to any domain table.
GRANT SELECT ON TABLE public.auth_profiles TO authenticated;