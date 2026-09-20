import { supabase } from "@/integrations/supabase/client";
import { createAccount, createCreditCard, createTransaction, type CreateTransactionInput } from "@/services/transactionService";
import { createGoal, createGoalDeposit, RESERVE_NAME } from "@/services/goalService";

/**
 * Fills the signed-in account with three months of believable sample data —
 * accounts, cards, income, fixed and everyday expenses, an installment
 * purchase and goals — so every screen has something to show while testing.
 * Only reachable from Configurações?demo=1.
 */

type Tx = Omit<CreateTransactionInput, "date"> & { month: number; day: number };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** A date `month` months from now (0 = this month), or null if it's still ahead of today. */
function dateFor(month: number, day: number) {
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth() + month, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const d = new Date(base.getFullYear(), base.getMonth(), Math.min(day, last));
  return d > today ? null : iso(d);
}

export async function seedDemoData(userId: string, onProgress?: (done: number, total: number) => void) {
  // Accounts and cards
  const nubank = await createAccount(userId, { name: "Nubank", type: "checking", initial_balance: 3200, color: "violet" }) as { id: string };
  const itau = await createAccount(userId, { name: "Itaú", type: "checking", initial_balance: 1800, color: "amber" }) as { id: string };
  await createAccount(userId, { name: "Carteira", type: "cash", initial_balance: 150, color: "emerald" });
  await supabase.from("accounts").update({ is_default: true } as any).eq("id", nubank.id);

  const nuCard = await createCreditCard({ name: "Nubank", limit: 8000, closing_day: 20, due_day: 27, color: "violet", last_four_digits: "4821" }, userId) as unknown as { id: string };
  const itauCard = await createCreditCard({ name: "Itaú Click", limit: 5000, closing_day: 3, due_day: 10, color: "amber", last_four_digits: "1107" }, userId) as unknown as { id: string };

  const conta = (name: string, category: string, amount: number, month: number, day: number, extra: Partial<Tx> = {}): Tx => ({
    name, category, amount, month, day, type: "despesa", status: "pago", payment_method: "conta", account_id: nubank.id, ...extra,
  });
  const cartao = (name: string, category: string, amount: number, month: number, day: number, cardId: string, extra: Partial<Tx> = {}): Tx => ({
    name, category, amount, month, day, type: "despesa", status: "pendente", payment_method: "cartao", credit_card_id: cardId, ...extra,
  });

  const txs: Tx[] = [
    // Fixed bills, started two months ago and repeating every month
    conta("Aluguel", "Moradia", 1450, -2, 10, { recurrence_type: "fixa" }),
    conta("Internet", "Moradia", 99.9, -2, 22, { recurrence_type: "fixa" }),
    conta("Academia", "Academia", 119.9, -2, 7, { recurrence_type: "fixa" }),
    conta("Netflix", "Assinaturas", 55.9, -2, 15, { recurrence_type: "fixa" }),
    conta("Spotify", "Assinaturas", 21.9, -2, 20, { recurrence_type: "fixa" }),
    // A notebook in 10 installments on the Itaú card
    cartao("Notebook Dell", "Tecnologia", 349.9, -2, 8, itauCard.id, { recurrence_type: "parcelado", installments: 10, installment_current: 1 }),
    // One-off income
    { name: "Projeto de site", category: "Freelance", amount: 850, month: -1, day: 18, type: "receita", status: "pago", payment_method: "conta", account_id: itau.id },
    conta("Renner", "Vestuário", 219.9, -1, 25, { payment_method: "cartao", status: "pendente", account_id: null, credit_card_id: nuCard.id }),
  ];

  const luz = [176.4, 191.2, 184.3];
  const mercado: [number, number][] = [[412.3, 286.9], [389.7, 301.5], [436.8, 264.2]];
  for (const [i, month] of [-2, -1, 0].entries()) {
    txs.push(
      { name: "Salário", category: "Salário", amount: 6200, month, day: 5, type: "receita", status: "pago", payment_method: "conta", account_id: nubank.id },
      conta("Supermercado Extra", "Supermercado", mercado[i][0], month, 3),
      conta("Supermercado Extra", "Supermercado", mercado[i][1], month, 17),
      conta("iFood", "Delivery", [45.9, 52.3, 39.9][i], month, 6),
      conta("iFood", "Delivery", [62.4, 48.7, 57.2][i], month, 13),
      conta("iFood", "Delivery", [38.5, 44.1, 41.8][i], month, 21),
      conta("Uber", "Transporte", [27.9, 24.6, 31.2][i], month, 8),
      conta("Uber", "Transporte", [31.4, 36.8, 22.5][i], month, 19),
      conta("Starbucks", "Cafeteria", [24.9, 19.9, 27.5][i], month, 9),
      conta("Drogasil", "Saúde", [89.5, 42.3, 67.8][i], month, 14),
      conta("Conta de Luz", "Conta de Luz", luz[i], month, 12, { account_id: itau.id }),
      conta("Conta de Água", "Conta de Água", [78.6, 81.2, 74.9][i], month, 15, { account_id: itau.id }),
      cartao("Posto Shell", "Transporte", [180, 165.4, 172.3][i], month, 11, nuCard.id),
      cartao("Amazon", "Tecnologia", [149.9, 89.9, 129.9][i], month, 16, nuCard.id),
      cartao("Cinemark", "Lazer", [64, 58, 72][i], month, 24, itauCard.id),
    );
  }

  const due = txs.map((t) => ({ t, date: dateFor(t.month, t.day) })).filter((x): x is { t: Tx; date: string } => !!x.date);
  const goalSteps = 3;
  const total = due.length + goalSteps;
  let done = 0;

  for (const { t, date } of due) {
    const { month: _m, day: _d, ...input } = t;
    await createTransaction({ ...input, date, time: `${String(8 + (t.day % 12)).padStart(2, "0")}:${String((t.day * 7) % 60).padStart(2, "0")}` }, userId);
    onProgress?.(++done, total);
  }

  // Goals, with savings already on the way
  const goals: { name: string; target: number; monthly: number; deposits: [number, number, number][] }[] = [
    { name: RESERVE_NAME, target: 21600, monthly: 600, deposits: [[3800, -2, 6], [3000, -1, 6], [3000, 0, 6]] },
    { name: "Viagem pro Chile", target: 12000, monthly: 700, deposits: [[1500, -2, 6], [1400, -1, 6], [1300, 0, 6]] },
    { name: "Notebook novo", target: 6000, monthly: 400, deposits: [[1000, -2, 6], [800, -1, 6], [800, 0, 6]] },
  ];
  for (const g of goals) {
    const goal = await createGoal({ name: g.name, target_amount: g.target, monthly_contribution: g.monthly }, userId);
    for (const [amount, month, day] of g.deposits) {
      const date = dateFor(month, day);
      if (date) await createGoalDeposit({ goal_id: goal.id, amount, date, source: "Depósito" }, userId);
    }
    onProgress?.(++done, total);
  }

  // Everything the "Complete sua conta" card checks is done now
  await supabase.from("profiles").update({
    has_account: true,
    has_card: true,
    has_transactions: true,
    has_fixed_expenses: true,
    has_completed_profile: true,
  } as any).eq("id", userId);
}
