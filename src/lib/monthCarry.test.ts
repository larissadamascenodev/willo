import { describe, expect, it } from "vitest";
import {
  closedBalance,
  closingBalance,
  openingBalance,
  shiftSeriesToNextMonth,
  sumPaidAhead,
  type MonthFlow,
} from "./monthCarry";

/*
 * The months' balances, against a small ledger kept the way the database keeps it.
 *
 * The account holds everything marked as happened, whatever its date (that is what the
 * balance trigger does). Each month reads its own rows. The tests do to the ledger what
 * a person does on the phone — mark received, put back to pending, mark again, change
 * the amount, delete — and check every month still adds up.
 *
 * "Now" is November 2026: October is past, November current, December and January ahead.
 */

type Row = { id: string; type: "receita" | "despesa"; amount: number; date: string; status: "pago" | "pendente"; account_id: string | null };

const ACC = "nubank";
const NOW = { y: 2026, m: 10 }; // November (0-based month)
const key = (y: number, m: number) => y * 12 + m;
const monthOf = (r: Row) => ({ y: Number(r.date.slice(0, 4)), m: Number(r.date.slice(5, 7)) - 1 });

function accountBalance(rows: Row[]) {
  return rows
    .filter((r) => r.status === "pago" && r.account_id === ACC)
    .reduce((s, r) => s + (r.type === "receita" ? r.amount : -r.amount), 0);
}

function flow(rows: Row[], y: number, m: number): MonthFlow {
  const f = { income: 0, expense: 0, paidIncome: 0, paidExpense: 0 };
  for (const r of rows) {
    const d = monthOf(r);
    if (d.y !== y || d.m !== m) continue;
    if (r.type === "receita") {
      f.income += r.amount;
      if (r.status === "pago") f.paidIncome += r.amount;
    } else {
      f.expense += r.amount;
      if (r.status === "pago") f.paidExpense += r.amount;
    }
  }
  return f;
}

const endOfNow = "2026-11-30";
const paidAhead = (rows: Row[]) =>
  sumPaidAhead(rows.filter((r) => r.status === "pago" && r.date > endOfNow), new Set([ACC]));

/** What the engine works out for a month: where it starts and where it ends. */
function month(rows: Row[], y: number, m: number) {
  const k = key(y, m);
  const now = key(NOW.y, NOW.m);
  const target = flow(rows, y, m);
  const common = { accountBalance: accountBalance(rows), paidAhead: paidAhead(rows), target };
  let opening: number;
  if (k === now) opening = openingBalance({ kind: "current", ...common });
  else if (k < now) {
    const after: MonthFlow[] = [];
    for (let i = k + 1; i <= now; i++) after.push(flow(rows, Math.floor(i / 12), i % 12));
    opening = openingBalance({ kind: "past", ...common, after });
  } else {
    const between: MonthFlow[] = [];
    for (let i = now + 1; i < k; i++) between.push(flow(rows, Math.floor(i / 12), i % 12));
    opening = openingBalance({ kind: "future", ...common, current: flow(rows, NOW.y, NOW.m), between });
  }
  return { opening, closing: closingBalance(opening, target), closed: closedBalance(opening, target) };
}

const salario = (over: Partial<Row> = {}): Row => ({
  id: "sal",
  type: "receita",
  amount: 850,
  date: "2026-11-15",
  status: "pendente",
  account_id: ACC,
  ...over,
});
const set = (rows: Row[], id: string, patch: Partial<Row>) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r));

describe("receber, voltar para pendente e receber de novo", () => {
  it("o saldo acompanha cada passo sem somar duas vezes", () => {
    let rows = [salario()];
    expect(accountBalance(rows)).toBe(0);

    rows = set(rows, "sal", { status: "pago" });
    expect(accountBalance(rows)).toBe(850);

    rows = set(rows, "sal", { status: "pendente" });
    expect(accountBalance(rows)).toBe(0);

    rows = set(rows, "sal", { status: "pago" });
    expect(accountBalance(rows)).toBe(850);
  });

  it("excluir o lançamento tira o valor da conta", () => {
    let rows = [salario({ status: "pago" })];
    rows = rows.filter((r) => r.id !== "sal");
    expect(accountBalance(rows)).toBe(0);
    expect(month(rows, 2026, 10).closing).toBe(0);
  });

  it("mudar o valor de um lançamento recebido troca o valor, não soma", () => {
    let rows = [salario({ status: "pago" })];
    rows = set(rows, "sal", { amount: 900 });
    expect(accountBalance(rows)).toBe(900);
  });
});

describe("tirar um fixo só deste mês", () => {
  it("ele chega no mês seguinte esperando, não recebido", () => {
    expect(shiftSeriesToNextMonth("2026-11-15")).toEqual({ date: "2026-12-15", status: "pendente" });
  });

  it("o dia é mantido; só encurta quando o mês seguinte não tem esse dia", () => {
    expect(shiftSeriesToNextMonth("2026-01-31").date).toBe("2026-02-28");
    expect(shiftSeriesToNextMonth("2026-12-10").date).toBe("2027-01-10");
  });

  it("o caso que aconteceu: recebido, editado só neste mês e depois excluído não deixa 850 presos", () => {
    // Recebido em novembro.
    let rows = [salario({ status: "pago" })];
    // Editar "só este mês": a série vai para dezembro e novembro ganha um lançamento próprio.
    rows = set(rows, "sal", shiftSeriesToNextMonth("2026-11-15"));
    rows.push({ id: "nov", type: "receita", amount: 850, date: "2026-11-15", status: "pago", account_id: ACC });
    expect(accountBalance(rows)).toBe(850);
    // Excluir o de novembro.
    rows = rows.filter((r) => r.id !== "nov");
    expect(accountBalance(rows)).toBe(0);
    expect(month(rows, 2026, 10).opening).toBe(0);
  });
});

describe("os meses encadeados", () => {
  const base: Row[] = [
    { id: "out-sal", type: "receita", amount: 1000, date: "2026-10-05", status: "pago", account_id: ACC },
    { id: "out-luz", type: "despesa", amount: 970, date: "2026-10-10", status: "pago", account_id: ACC },
    { id: "nov-sal", type: "receita", amount: 1000, date: "2026-11-05", status: "pago", account_id: ACC },
    { id: "nov-ali", type: "despesa", amount: 400, date: "2026-11-08", status: "pago", account_id: ACC },
    { id: "nov-alu", type: "despesa", amount: 330, date: "2026-11-25", status: "pendente", account_id: ACC },
    { id: "dez-sal", type: "receita", amount: 1000, date: "2026-12-05", status: "pendente", account_id: ACC },
    { id: "dez-alu", type: "despesa", amount: 900, date: "2026-12-25", status: "pendente", account_id: ACC },
    { id: "jan-sal", type: "receita", amount: 1000, date: "2027-01-05", status: "pendente", account_id: ACC },
  ];

  it("outubro termina com o que sobrou nele", () => {
    expect(month(base, 2026, 9).closed).toBe(30);
  });

  it("novembro começa com o que outubro deixou e tem o saldo das contas", () => {
    const nov = month(base, 2026, 10);
    expect(nov.opening).toBe(30);
    expect(nov.closed).toBe(accountBalance(base)); // 630, o que está nas contas
    expect(nov.closing).toBe(300); // previsto no fim de novembro
  });

  it("dezembro: o previsto dele em cima do que novembro deve deixar (300 + 100 = 400)", () => {
    const dez = month(base, 2026, 11);
    expect(dez.opening).toBe(300);
    expect(dez.closing).toBe(400);
  });

  it("janeiro continua a corrente", () => {
    expect(month(base, 2027, 0).opening).toBe(400);
    expect(month(base, 2027, 0).closing).toBe(1400);
  });

  it("um salário de dezembro marcado como recebido em novembro conta uma vez só", () => {
    const rows = set(base, "dez-sal", { status: "pago" });
    expect(accountBalance(rows)).toBe(1630); // o dinheiro está na conta
    expect(month(rows, 2026, 9).closed).toBe(30); // outubro não muda
    expect(month(rows, 2026, 10).closing).toBe(300); // novembro não muda
    expect(month(rows, 2026, 11).closing).toBe(400); // dezembro conta ele uma vez
    expect(month(rows, 2027, 0).opening).toBe(400);
  });

  it("marcar e desmarcar em qualquer mês nunca muda o que cada mês deve terminar", () => {
    let rows = base;
    const before = [month(rows, 2026, 11).closing, month(rows, 2027, 0).closing];
    for (const id of ["nov-alu", "dez-sal", "dez-alu", "jan-sal"]) {
      rows = set(rows, id, { status: "pago" });
      expect([month(rows, 2026, 11).closing, month(rows, 2027, 0).closing]).toEqual(before);
      rows = set(rows, id, { status: "pendente" });
      expect([month(rows, 2026, 11).closing, month(rows, 2027, 0).closing]).toEqual(before);
    }
  });

  it("excluir uma receita futura baixa a previsão dali em diante", () => {
    const rows = base.filter((r) => r.id !== "dez-sal");
    expect(month(rows, 2026, 11).closing).toBe(-600);
    expect(month(rows, 2027, 0).opening).toBe(-600);
  });
});

describe("o que fica fora da conta", () => {
  it("compras no cartão e lançamentos sem conta não entram no adiantado", () => {
    expect(
      sumPaidAhead(
        [
          { amount: 100, type: "despesa", payment_method: "cartao", account_id: ACC },
          { amount: 50, type: "receita", payment_method: "conta", account_id: null },
          { amount: 30, type: "receita", payment_method: "conta", account_id: "investimento" },
          { amount: 20, type: "receita", payment_method: "conta", account_id: ACC },
        ],
        new Set([ACC]),
      ),
    ).toBe(20);
  });
});
