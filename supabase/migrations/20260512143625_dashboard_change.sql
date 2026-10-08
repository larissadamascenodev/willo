-- Recovered from the database, where it had been applied directly through the Supabase
-- dashboard and never written down here. The statements below are what actually ran, read
-- back from supabase_migrations.schema_migrations, so the repository and the database now
-- tell the same story and `db push` can run again.
--
-- Original name: 0d7e8572-f4f6-401c-acf7-b7d58f69fc87

-- Security Hardening: Revoke default EXECUTE from public on all SECURITY DEFINER functions
-- This ensures they can only be called by authenticated users if RLS/owner check allows, 
-- or by system triggers.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Re-grant to authenticated role only for needed ones
GRANT EXECUTE ON FUNCTION public.materialize_recurring_invoice_items(uuid, integer, integer) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_or_create_invoice(uuid, uuid, integer, integer) TO authenticated;

-- Hardening profiles table: Ensure id always matches auth.uid() on INSERT
ALTER POLICY "Users can insert own profile" ON public.profiles 
WITH CHECK (auth.uid() = id);

-- Hardening handle_new_user to be even more resilient
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Double check: only allow creation for the authenticated user's own ID if triggered by auth.users
  -- System trigger is fine
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NULL)
  );
  RETURN NEW;
END;
$function$;

-- Hardening get_or_create_invoice: Prevent creating invoices for other users
CREATE OR REPLACE FUNCTION public.get_or_create_invoice(p_user_id uuid, p_credit_card_id uuid, p_month integer, p_year integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice_id uuid;
  v_card_owner uuid;
BEGIN
  -- SECURITY: Verify that the caller owns the credit card or is the user
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access Denied: Cannot create invoice for another user';
  END IF;

  SELECT user_id INTO v_card_owner FROM public.credit_cards WHERE id = p_credit_card_id;
  IF v_card_owner != p_user_id THEN
    RAISE EXCEPTION 'Access Denied: User does not own this credit card';
  END IF;

  SELECT id INTO v_invoice_id
  FROM public.invoices
  WHERE credit_card_id = p_credit_card_id AND month = p_month AND year = p_year;

  IF v_invoice_id IS NULL THEN
    INSERT INTO public.invoices (user_id, credit_card_id, month, year, total_amount)
    VALUES (p_user_id, p_credit_card_id, p_month, p_year, 0)
    RETURNING id INTO v_invoice_id;
  END IF;

  RETURN v_invoice_id;
END;
$function$;

-- Hardening materialize_recurring_invoice_items
CREATE OR REPLACE FUNCTION public.materialize_recurring_invoice_items(p_user_id uuid, p_month integer, p_year integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx RECORD;
  v_invoice_id uuid;
  v_exists boolean;
  v_closing_day integer;
  v_period RECORD;
  v_origin_month integer;
  v_origin_year integer;
BEGIN
  -- SECURITY: Principle of Least Privilege
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access Denied: Cannot materialize data for another user';
  END IF;

  FOR v_tx IN
    SELECT t.id, t.credit_card_id, t.amount, t.date, t.name, t.category
    FROM public.transactions t
    WHERE t.user_id = p_user_id
      AND t.recurrence_type = 'fixa'
      AND t.payment_method = 'cartao'
      AND t.credit_card_id IS NOT NULL
      AND t.parent_transaction_id IS NULL
  LOOP
    SELECT closing_day INTO v_closing_day
    FROM public.credit_cards WHERE id = v_tx.credit_card_id;

    IF v_closing_day IS NULL THEN
      CONTINUE;
    END IF;

    SELECT gip.inv_month, gip.inv_year INTO v_period
    FROM public.get_invoice_period(v_tx.date::date, v_closing_day) gip;

    v_origin_month := v_period.inv_month;
    v_origin_year := v_period.inv_year;

    IF p_year < v_origin_year OR (p_year = v_origin_year AND p_month <= v_origin_month) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.recurring_exclusions
      WHERE transaction_id = v_tx.id
        AND month = p_month - 1
        AND year = p_year
    ) THEN
      CONTINUE;
    END IF;

    v_invoice_id := public.get_or_create_invoice(p_user_id, v_tx.credit_card_id, p_month, p_year);

    SELECT EXISTS (
      SELECT 1 FROM public.invoice_items
      WHERE invoice_id = v_invoice_id AND transaction_id = v_tx.id
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO public.invoice_items (invoice_id, transaction_id, amount, installment_number, total_installments)
      VALUES (v_invoice_id, v_tx.id, v_tx.amount, 1, 1);

      PERFORM public.recalc_invoice_total(v_invoice_id);
    END IF;
  END LOOP;

  PERFORM public.recalc_credit_card_used_limit(cc.id)
  FROM public.credit_cards cc WHERE cc.user_id = p_user_id;
END;
$function$;

-- Ensure RLS on invoice_items properly checks invoice ownership during INSERT/UPDATE
DROP POLICY IF EXISTS "Users can access their own invoice items" ON public.invoice_items;

CREATE POLICY "Users can access their own invoice items" 
ON public.invoice_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id AND i.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id AND i.user_id = auth.uid()
  )
);
