-- Where a person's Gmail connection lives.
--
-- The refresh token here is a long-lived credential to someone's mailbox, so the browser
-- must never be able to read it. RLS is enabled and deliberately given NO policy for
-- authenticated users: that denies every client-side read and write, and leaves the
-- edge functions, which hold the service role key, as the only thing that can touch it.
-- The app learns whether a mailbox is connected by asking a function, not by selecting
-- the row.
CREATE TABLE IF NOT EXISTS public.gmail_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  -- When the current access token stops working, so it is only refreshed when needed.
  access_expires_at timestamptz,
  -- How far back the last scan looked, so the next one does not re-read the whole inbox.
  last_scan_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.gmail_connections IS
  'Gmail OAuth credentials. No RLS policy on purpose: service role only.';
