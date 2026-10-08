-- Recovered from the database, where it had been applied directly through the Supabase
-- dashboard and never written down here. The statements below are what actually ran, read
-- back from supabase_migrations.schema_migrations, so the repository and the database now
-- tell the same story and `db push` can run again.
--
-- Original name: e12a107b-d857-4ae1-8830-687a0dffa9a7

-- Harden search_path
ALTER FUNCTION public.handle_subscription_update() SET search_path = public;

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION public.handle_subscription_update() FROM PUBLIC, anon;
