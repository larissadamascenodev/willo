-- Where an import came from, and what it read.
--
-- Two jobs in one pair of tables. The first is being able to answer "where did this number
-- come from" months later, which today is impossible: the reader's output is used once and
-- discarded, so a figure that looks wrong has nothing behind it. The second is not
-- importing the same statement twice. Both need the same thing, a record of the import,
-- so they are built together.

CREATE TABLE IF NOT EXISTS public.invoice_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_card_id uuid NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,

  -- SHA-256 of the uploaded file. The same document read twice is the same hash, which is
  -- what makes a second import recognisable before it duplicates anything.
  document_hash text,
  file_name text,

  -- The reconciliation, as it stood at import. Kept because it is a statement about that
  -- moment: the app's figures move afterwards, and this one should not.
  official_total numeric,
  calculated_total numeric,
  reconciliation_status text,
  official_used_limit numeric,
  calculated_used_limit numeric,
  limit_status text,
  event_count integer NOT NULL DEFAULT 0,
  row_count integer NOT NULL DEFAULT 0,
  alerts jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Every line the reader saw, whole, including the ones that became nothing. A line that
-- was deliberately not charged is exactly what you want to find when a total looks short.
CREATE TABLE IF NOT EXISTS public.invoice_import_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.invoice_imports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seq integer NOT NULL,

  event_date date,
  description text NOT NULL,
  amount numeric NOT NULL,
  category text,
  confidence text,
  operation_id text,
  installment_number integer,
  installment_total integer,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_imports_hash_idx
  ON public.invoice_imports (user_id, credit_card_id, document_hash);
CREATE INDEX IF NOT EXISTS invoice_import_events_import_idx
  ON public.invoice_import_events (import_id, seq);

ALTER TABLE public.invoice_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_import_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their own invoice imports" ON public.invoice_imports;
CREATE POLICY "Users can access their own invoice imports"
  ON public.invoice_imports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access their own invoice import events" ON public.invoice_import_events;
CREATE POLICY "Users can access their own invoice import events"
  ON public.invoice_import_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
