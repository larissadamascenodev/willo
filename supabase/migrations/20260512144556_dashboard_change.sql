-- Recovered from the database, where it had been applied directly through the Supabase
-- dashboard and never written down here. The statements below are what actually ran, read
-- back from supabase_migrations.schema_migrations, so the repository and the database now
-- tell the same story and `db push` can run again.
--
-- Original name: 78269a2a-7a4c-4212-be20-7714ae6b7c07

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
