-- ════════════════════════════════════════════════════════════════════════════
-- PROPOSTA — NÃO APLICADA. Fica fora de supabase/migrations de propósito.
--
-- Caixinhas: a meta e o cofrinho passam a ser uma coisa só (a linha de `goals`, como já é).
-- Só ADICIONA coluna, tabela e função, e troca UMA função existente (item 2).
-- Nada em uso é apagado ou renomeado, então a web continua funcionando.
-- ════════════════════════════════════════════════════════════════════════════

-- 1 ── Rendimento: três colunas novas em goals ─────────────────────────────────
-- yield_type nulo = a caixinha não rende. Hoje só existe 'cdi'.
alter table public.goals
  add column if not exists yield_type     text    check (yield_type in ('cdi')),
  add column if not exists yield_percent  numeric(6,2) check (yield_percent is null or (yield_percent > 0 and yield_percent <= 1000)),
  add column if not exists last_yield_date date;                 -- último dia de CDI já aplicado

alter table public.goals
  add constraint goals_yield_pair check ((yield_type is null) = (yield_percent is null));

-- Quando o rendimento é ligado, ele conta a partir de hoje, nunca para trás.
create or replace function public.set_goal_yield_start() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.yield_type is not null and (tg_op = 'INSERT' or old.yield_type is null) then
    new.last_yield_date := current_date;
  end if;
  if new.yield_type is null then
    new.last_yield_date := null;
  end if;
  return new;
end $$;
create trigger trg_set_goal_yield_start
  before insert or update of yield_type on public.goals
  for each row execute function public.set_goal_yield_start();

-- 2 ── O saldo deixa de ser cortado no valor da meta ───────────────────────────
-- Hoje: current_amount = LEAST(soma, target_amount). Com target_amount = 0 ("sem valor
-- definido") o saldo some (R$ 875 guardados aparecem como R$ 0) e, com rendimento, o que
-- passa da meta também sumiria. Passa a ser exatamente a soma dos movimentos.
create or replace function public.update_goal_current_amount() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_goal uuid := coalesce(new.goal_id, old.goal_id);
begin
  update public.goals
     set current_amount = (select coalesce(sum(amount), 0) from public.goal_transactions where goal_id = v_goal)
   where id = v_goal;
  return null;
end $$;

-- Acerto único (opcional, mostrado antes): metas cujo saldo guardado diverge da soma real.
-- select g.id, g.name, g.current_amount, s.total from goals g
--   join (select goal_id, sum(amount) total from goal_transactions group by goal_id) s on s.goal_id = g.id
--  where g.current_amount <> s.total;
--   → hoje só 1 linha: "Reserva de emergência", R$ 0 guardado e R$ 875 em movimentos.
-- update goals g set current_amount = s.total
--   from (select goal_id, sum(amount) total from goal_transactions group by goal_id) s
--  where s.goal_id = g.id and g.current_amount <> s.total;

-- 3 ── CDI diário (cache do Banco Central, série SGS 12) ───────────────────────
create table if not exists public.cdi_rates (
  date       date primary key,
  daily_rate numeric(14,10) not null          -- em % ao dia, como o Banco Central publica
);
alter table public.cdi_rates enable row level security;
create policy "Signed-in users read CDI" on public.cdi_rates for select to authenticated using (true);
-- Sem política de escrita: só a Edge Function `sync-cdi`, com a chave de serviço do servidor.

-- 4 ── Um dia de rendimento nunca entra duas vezes na mesma caixinha ───────────
create unique index if not exists goal_yield_once
  on public.goal_transactions (goal_id, date) where source = 'Rendimento estimado';

-- 5 ── Aplicar o rendimento, no servidor, só nas caixinhas de quem chama ───────
-- Pode ser chamada quantas vezes quiser: cada dia só entra uma vez. Se o app ficou
-- 5 dias fechado, a próxima chamada aplica os 5 dias de uma vez (catch-up).
-- Rendimento do dia = saldo até o dia anterior × CDI do dia × (% do CDI ÷ 100).
-- Não cria transação de conta: não é receita nem despesa, só aumenta a caixinha.
create or replace function public.apply_my_yields() returns integer
language plpgsql security definer set search_path = public as $$
declare
  g record; r record;
  v_uid uuid := auth.uid();
  v_bal numeric; v_gain numeric; v_n integer := 0;
begin
  if v_uid is null then raise exception 'não autenticado'; end if;

  for g in select * from public.goals where user_id = v_uid and yield_type = 'cdi' for update loop
    for r in select date, daily_rate from public.cdi_rates
              where date > coalesce(g.last_yield_date, current_date)
              order by date loop
      select coalesce(sum(amount), 0) into v_bal
        from public.goal_transactions where goal_id = g.id and date < r.date;
      v_gain := round(v_bal * (r.daily_rate / 100) * (g.yield_percent / 100), 2);
      if v_gain > 0 then
        insert into public.goal_transactions (goal_id, user_id, amount, date, source)
        values (g.id, v_uid, v_gain, r.date, 'Rendimento estimado')
        on conflict (goal_id, date) where source = 'Rendimento estimado' do nothing;
        v_n := v_n + 1;
      end if;
      update public.goals set last_yield_date = r.date where id = g.id;
    end loop;
  end loop;
  return v_n;
end $$;
revoke all on function public.apply_my_yields() from public, anon;
grant execute on function public.apply_my_yields() to authenticated;
