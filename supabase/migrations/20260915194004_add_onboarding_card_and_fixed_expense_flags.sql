-- Recovered from the database, where it had been applied directly through the Supabase
-- dashboard and never written down here. The statements below are what actually ran, read
-- back from supabase_migrations.schema_migrations, so the repository and the database now
-- tell the same story and `db push` can run again.
--
-- Original name: add_onboarding_card_and_fixed_expense_flags

alter table public.profiles
  add column if not exists has_card boolean not null default false,
  add column if not exists has_fixed_expenses boolean not null default false,
  add column if not exists initial_score integer,
  add column if not exists initial_score_label text;

create or replace function public.sync_profile_has_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles set has_card = true where id = new.user_id;
    return new;
  elsif TG_OP = 'DELETE' then
    if not exists (select 1 from public.credit_cards where user_id = old.user_id) then
      update public.profiles set has_card = false where id = old.user_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_sync_profile_has_card
after insert or delete on public.credit_cards
for each row execute function public.sync_profile_has_card();

create or replace function public.sync_profile_has_fixed_expenses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' and new.recurrence_type = 'fixa' then
    update public.profiles set has_fixed_expenses = true where id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger trg_sync_profile_has_fixed_expenses
after insert on public.transactions
for each row execute function public.sync_profile_has_fixed_expenses();
