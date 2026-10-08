-- A purchase made ON the closing day belongs to the next invoice, not the one closing.
--
-- The rule was `day > closing_day`, which keeps the closing day itself in the invoice that
-- shuts that same day. The statement this was checked against says otherwise: its October
-- invoice covers "06 SET a 06 OUT" with a closing day of 6, and the purchases dated 06 SET
-- are billed in it. Under the old rule those would have fallen into September, and the two
-- periods would overlap on the 6th of every month, which no card does.
--
-- Changing this moves any purchase dated exactly on a closing day one invoice forward. It
-- only takes effect as rows are written or touched, because invoice items are generated at
-- that moment; existing items keep the month they were given until their transaction is
-- edited.

CREATE OR REPLACE FUNCTION public.get_invoice_period(p_purchase_date date, p_closing_day integer)
 RETURNS TABLE(inv_month integer, inv_year integer)
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  d_day integer;
  d_month integer;
  d_year integer;
BEGIN
  d_day := EXTRACT(DAY FROM p_purchase_date);
  d_month := EXTRACT(MONTH FROM p_purchase_date);
  d_year := EXTRACT(YEAR FROM p_purchase_date);

  -- On the closing day the invoice shuts, so the purchase goes to the one that opens.
  IF d_day >= p_closing_day THEN
    IF d_month = 12 THEN
      inv_month := 1;
      inv_year := d_year + 1;
    ELSE
      inv_month := d_month + 1;
      inv_year := d_year;
    END IF;
  ELSE
    inv_month := d_month;
    inv_year := d_year;
  END IF;

  RETURN NEXT;
END;
$function$;
