-- Recovered from the database, where it had been applied directly through the Supabase
-- dashboard and never written down here. The statements below are what actually ran, read
-- back from supabase_migrations.schema_migrations, so the repository and the database now
-- tell the same story and `db push` can run again.
--
-- Original name: e9bb0a2d-f1b0-478d-8bea-548ca853aa75

-- Revoke EXECUTE from PUBLIC by default for all SECURITY DEFINER functions in public schema
-- This prevents 'anon' and any other role from executing them unless explicitly granted.

DO $$ 
DECLARE 
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.prosecdef = true
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon', 
            func_record.nspname, func_record.proname, func_record.args);
    END LOOP;
END $$;

-- Grant EXECUTE back to authenticated and service_role for functions that are needed
-- These are either called via RPC or used as triggers for actions performed by authenticated users.

GRANT EXECUTE ON FUNCTION public.recalc_invoice_total(uuid) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.materialize_recurring_invoice_items(uuid, integer, integer) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_account_balance() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.handle_credit_card_invoice_delete() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.handle_credit_card_invoice() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_credit_card_limit() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.auto_assign_default_account() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.generate_installment_transactions() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.sync_profile_has_transactions() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.sync_profile_has_account() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_goal_current_amount() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_or_create_invoice(uuid, uuid, integer, integer) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.recalc_credit_card_used_limit(uuid) TO authenticated, service_role;

-- handle_new_user is a trigger on auth.users, usually fired by service_role/auth process
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
