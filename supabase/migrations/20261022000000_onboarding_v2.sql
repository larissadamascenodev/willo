-- The second onboarding: what it asks, and what it records on the way.
--
-- Three additive pieces, none of which touches a column anything already reads. The
-- funnel needs to know where people stop, the finished answers have to survive the
-- signup that happens at the very end, and a goal has to be able to say whether it is
-- money being gathered or a debt being paid off.

-- ── Where people stop ────────────────────────────────────────────────────────────
--
-- One row per screen seen, answered or skipped, written before there is an account:
-- the funnel's whole point is the people who leave, and those never sign in. So the
-- row carries a session id generated in the browser and nothing that identifies a
-- person. Insert is open to anonymous callers for that reason, and SELECT is open to
-- nobody — reading this is a dashboard job, done with the service role.
CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Generated in the browser for one run of the flow. Not a user, not a device.
  session_id text NOT NULL,
  screen_id text NOT NULL,
  event text NOT NULL CHECK (
    event IN ('view', 'answer', 'skip', 'finish', 'paywall_view', 'paywall_cta', 'paywall_close')
  ),

  -- Where the person came from: the ?src= on the landing URL.
  src text,

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

-- Anyone may add to the log. Nobody may read it back, so there is nothing here to
-- harvest even though the insert is open.
DROP POLICY IF EXISTS "onboarding_events_insert_anyone" ON public.onboarding_events;
CREATE POLICY "onboarding_events_insert_anyone"
  ON public.onboarding_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS onboarding_events_session_idx
  ON public.onboarding_events (session_id, created_at);

CREATE INDEX IF NOT EXISTS onboarding_events_screen_idx
  ON public.onboarding_events (screen_id, event);

-- ── The answers themselves ───────────────────────────────────────────────────────
--
-- Kept whole, as given, because the flow's questions will keep changing and a column
-- per question would be a migration per edit. What the app acts on — the goal, the
-- name — is copied into its real home when the onboarding finishes; this is the
-- record of what was said, and what the Radar reads later for the chosen categories.
CREATE TABLE IF NOT EXISTS public.onboarding_answers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- The two flags the app will want without parsing the json.
  onboarding_completed boolean NOT NULL DEFAULT false,
  paywall_dismissed boolean NOT NULL DEFAULT false,

  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_answers_select_own" ON public.onboarding_answers;
CREATE POLICY "onboarding_answers_select_own"
  ON public.onboarding_answers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "onboarding_answers_insert_own" ON public.onboarding_answers;
CREATE POLICY "onboarding_answers_insert_own"
  ON public.onboarding_answers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "onboarding_answers_update_own" ON public.onboarding_answers;
CREATE POLICY "onboarding_answers_update_own"
  ON public.onboarding_answers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── A goal that is a debt ────────────────────────────────────────────────────────
--
-- Paying off a debt and saving up are the same arithmetic pointed in opposite
-- directions, so they are the same row with a direction on it rather than a second
-- table. Everything that exists today was money being gathered, which is the default,
-- so no existing row changes meaning.
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'juntar';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'goals_tipo_check'
  ) THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_tipo_check CHECK (tipo IN ('juntar', 'quitar'));
  END IF;
END $$;
