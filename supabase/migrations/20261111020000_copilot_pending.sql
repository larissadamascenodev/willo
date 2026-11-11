-- Willo Copilot: what was caught from the bank's purchase notices (or e-mails, or the
-- iPhone's Wallet shortcut) waits here until the person confirms it. Confirmed, it becomes
-- a transaction and the row is marked so; discarded, it is marked so. Nothing here moves a
-- balance by itself.
--
-- Additive only: a new table, its policies and an index. Nothing existing changes.

create table if not exists public.copilot_pending (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  type text not null default 'despesa' check (type in ('despesa', 'receita')),
  category text,
  payment_method text check (payment_method in ('conta', 'cartao')),
  account_id uuid references public.accounts (id) on delete set null,
  credit_card_id uuid references public.credit_cards (id) on delete set null,
  occurred_at timestamptz not null default now(),
  -- Where it came from: "notificacao", "email", "atalho", "open_finance"…
  source text not null default 'notificacao',
  -- The bank's own wording, kept to show and to read again.
  raw text,
  status text not null default 'pendente' check (status in ('pendente', 'confirmado', 'descartado')),
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists copilot_pending_user_status_idx on public.copilot_pending (user_id, status, occurred_at desc);

alter table public.copilot_pending enable row level security;

create policy "copilot_pending own rows select" on public.copilot_pending for select using (auth.uid() = user_id);
create policy "copilot_pending own rows insert" on public.copilot_pending for insert with check (auth.uid() = user_id);
create policy "copilot_pending own rows update" on public.copilot_pending for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "copilot_pending own rows delete" on public.copilot_pending for delete using (auth.uid() = user_id);
