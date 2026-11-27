-- A bank notice Willo could not read is kept, never shown in the app, so new ways banks word
-- things can be learned from what actually came in. Additive: one more allowed status.
alter table public.copilot_pending drop constraint if exists copilot_pending_status_check;
alter table public.copilot_pending
  add constraint copilot_pending_status_check
  check (status = any (array['pendente'::text, 'confirmado'::text, 'descartado'::text, 'ignorado'::text]));
