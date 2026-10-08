-- What the bank printed, kept apart from what the app works out.
--
-- These two must never be the same column. used_limit is derived: a trigger recomputes it
-- from the invoice items every time anything changes, so a figure written there is gone on
-- the next edit. And the bank's number is not a better version of ours, it is a different
-- measurement, taken on the day the statement closed. Keeping both is what lets the app say
-- "we count R$ 5.808,00 and your statement said R$ 5.980,21" instead of silently picking one.
--
-- Nothing here feeds a calculation. It is evidence.

ALTER TABLE public.credit_cards
  ADD COLUMN IF NOT EXISTS statement_total_limit numeric,
  ADD COLUMN IF NOT EXISTS statement_used_limit numeric,
  ADD COLUMN IF NOT EXISTS statement_available_limit numeric,
  -- Which statement these came from ("2026-10"), so an older one cannot overwrite a newer.
  ADD COLUMN IF NOT EXISTS statement_ref text,
  ADD COLUMN IF NOT EXISTS statement_read_at timestamptz;

ALTER TABLE public.invoices
  -- "Total a pagar", exactly as printed.
  ADD COLUMN IF NOT EXISTS official_total numeric,
  -- "Fechamento da próxima fatura", which is the only check the document gives on a month
  -- that has not happened yet.
  ADD COLUMN IF NOT EXISTS official_next_closing numeric,
  ADD COLUMN IF NOT EXISTS official_read_at timestamptz;

COMMENT ON COLUMN public.credit_cards.statement_used_limit IS
  'Limite utilizado as printed by the bank. Never computed, never used in a calculation.';
COMMENT ON COLUMN public.invoices.official_total IS
  'Total a pagar as printed by the bank. total_amount stays the app''s own sum.';
