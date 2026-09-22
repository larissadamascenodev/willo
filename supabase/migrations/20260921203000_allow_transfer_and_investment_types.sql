-- The balance triggers, the finance engine and the invoice logic already handle
-- 'transferencia' and 'investimento', but the original CHECK constraint still only
-- allowed 'receita' and 'despesa'. Every transfer between accounts and every goal
-- deposit was therefore rejected (23514) and the error was swallowed client-side:
-- the deposit was recorded against the goal while the money never left the account.
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('receita', 'despesa', 'transferencia', 'investimento'));
