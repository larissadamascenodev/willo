import { describe, expect, it } from "vitest";
import { recurringSignature } from "@/services/recurringService";
import { planDelete, planEdit, type SeriesOp, type SeriesRow } from "./seriesPlan";

/*
 * Deleting and changing entries that repeat, checked on a small database that shows
 * each month the way the app does:
 *
 * - a fixed entry shows in its own month as itself, and in every later month as the
 *   newest definition of it (same name, amount, day…) — unless that month is excluded;
 * - an instalment shows in the month of its date.
 *
 * The case that started it: a salary written down twice, months apart. Deleting it "only
 * this month" used to move the newer row to the next month, and the older one showed
 * through in its place — "deleted", and still there.
 */

type Db = { rows: SeriesRow[]; excluded: Set<string> };
const ex = (id: string, m: number, y: number) => `${id}:${m}:${y}`;
let seq = 0;

function apply(db: Db, ops: SeriesOp[]): Db {
  let rows = db.rows.map((r) => ({ ...r }));
  const excluded = new Set(db.excluded);
  for (const o of ops) {
    if (o.op === "exclude") excluded.add(ex(o.id, o.month, o.year));
    else if (o.op === "excludeOnward") {
      for (let i = 0; i < 60; i++) {
        const k = o.year * 12 + o.month + i;
        excluded.add(ex(o.id, k % 12, Math.floor(k / 12)));
      }
    } else if (o.op === "update") rows = rows.map((r) => (r.id === o.id ? { ...r, ...o.patch } : r));
    else if (o.op === "delete") rows = rows.filter((r) => r.id !== o.id);
    else rows.push({ id: `new${++seq}`, status: "pendente", ...(o.fields as Partial<SeriesRow>) } as SeriesRow);
  }
  return { rows, excluded };
}

const key = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;

/** What a month lists: names with amounts. */
function view(db: Db, month: number, year: number) {
  const k = year * 12 + month;
  const own = db.rows.filter((r) => key(r.date) === k && !(r.recurrence_type === "fixa" && db.excluded.has(ex(r.id, month, year))));
  const latest = new Map<string, SeriesRow>();
  for (const r of [...db.rows].filter((r) => r.recurrence_type === "fixa" && key(r.date) <= k).sort((a, b) => b.date.localeCompare(a.date))) {
    const s = recurringSignature(r as never);
    if (!latest.has(s)) latest.set(s, r);
  }
  const carried = [...latest.values()].filter((r) => key(r.date) !== k && !db.excluded.has(ex(r.id, month, year)));
  return [...own, ...carried].map((r) => `${r.name} ${Number(r.amount)}`).sort();
}

/** Money counted in the accounts: every row marked as happened. */
const balance = (db: Db) => db.rows.filter((r) => r.status === "pago").reduce((s, r) => s + (r.type === "receita" ? 1 : -1) * Number(r.amount), 0);

const fixa = (id: string, date: string, over: Partial<SeriesRow> = {}): SeriesRow => ({
  id, name: "Salário", type: "receita", category: "Salário", amount: 850, date, status: "pendente",
  payment_method: "conta", account_id: "acc", recurrence_type: "fixa", parent_transaction_id: null, ...over,
});

function parcels(n: number, start = "2026-10-20"): SeriesRow[] {
  const [y, m] = start.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 + i, 20);
    return {
      id: `p${i + 1}`, name: "Tv", type: "despesa", category: "Casa", amount: 480,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-20`,
      status: i === 0 ? "pago" : "pendente", payment_method: "conta", account_id: "acc",
      recurrence_type: "parcelado", installments: n, installment_current: i + 1,
      parent_transaction_id: i === 0 ? null : "p1",
    };
  });
}

const NOV = { month: 10, year: 2026 };
const DEZ = { month: 11, year: 2026 };
const JAN = { month: 0, year: 2027 };
const OUT = { month: 9, year: 2026 };

describe("fixo: excluir só deste mês", () => {
  it("some daquele mês e só dele", () => {
    let db: Db = { rows: [fixa("s", "2026-10-15")], excluded: new Set() };
    db = apply(db, planDelete(db.rows[0], "month", { ...NOV, all: db.rows }));
    expect(view(db, NOV.month, NOV.year)).toEqual([]);
    expect(view(db, OUT.month, OUT.year)).toEqual(["Salário 850"]);
    expect(view(db, DEZ.month, DEZ.year)).toEqual(["Salário 850"]);
  });

  it("no próprio mês de origem também some, sem nada ir para a frente", () => {
    let db: Db = { rows: [fixa("s", "2026-11-15")], excluded: new Set() };
    db = apply(db, planDelete(db.rows[0], "month", { ...NOV, all: db.rows }));
    expect(view(db, NOV.month, NOV.year)).toEqual([]);
    expect(view(db, DEZ.month, DEZ.year)).toEqual(["Salário 850"]);
    expect(db.rows[0].date).toBe("2026-11-15");
  });

  it("o caso que aconteceu: com uma cópia antiga do mesmo salário, ele não volta a aparecer", () => {
    let db: Db = { rows: [fixa("velho", "2026-10-06", { account_id: null }), fixa("novo", "2026-12-06")], excluded: new Set() };
    expect(view(db, DEZ.month, DEZ.year)).toEqual(["Salário 850"]);
    db = apply(db, planDelete(db.rows[1], "month", { ...DEZ, all: db.rows }));
    expect(view(db, DEZ.month, DEZ.year)).toEqual([]);
    expect(view(db, JAN.month, JAN.year)).toEqual(["Salário 850"]);
  });

  it("se já tinha sido recebido no próprio mês, deixa de contar no saldo", () => {
    let db: Db = { rows: [fixa("s", "2026-11-15", { status: "pago" })], excluded: new Set() };
    expect(balance(db)).toBe(850);
    db = apply(db, planDelete(db.rows[0], "month", { ...NOV, all: db.rows }));
    expect(balance(db)).toBe(0);
  });
});

describe("fixo: excluir deste mês em diante", () => {
  it("os meses de antes ficam, este e os próximos somem", () => {
    let db: Db = { rows: [fixa("s", "2026-10-15", { status: "pago" })], excluded: new Set() };
    db = apply(db, planDelete(db.rows[0], "all", { ...NOV, all: db.rows }));
    expect(view(db, OUT.month, OUT.year)).toEqual(["Salário 850"]);
    expect(view(db, NOV.month, NOV.year)).toEqual([]);
    expect(view(db, JAN.month, JAN.year)).toEqual([]);
    expect(balance(db)).toBe(850); // outubro recebido continua
  });

  it("começando neste mês, apaga de vez, e cópias antigas não voltam", () => {
    let db: Db = { rows: [fixa("velho", "2026-10-06"), fixa("novo", "2026-11-06")], excluded: new Set() };
    db = apply(db, planDelete(db.rows[1], "all", { ...NOV, all: db.rows }));
    expect(view(db, NOV.month, NOV.year)).toEqual([]);
    expect(view(db, DEZ.month, DEZ.year)).toEqual([]);
    expect(view(db, OUT.month, OUT.year)).toEqual(["Salário 850"]);
  });
});

describe("fixo: editar", () => {
  it("só este mês: muda o valor deste mês, os outros continuam iguais, nada vai para a frente", () => {
    let db: Db = { rows: [fixa("s", "2026-10-15")], excluded: new Set() };
    db = apply(db, planEdit(db.rows[0], "month", { ...db.rows[0], amount: 900, date: "2026-11-15" }, { ...NOV, all: db.rows }));
    expect(view(db, OUT.month, OUT.year)).toEqual(["Salário 850"]);
    expect(view(db, NOV.month, NOV.year)).toEqual(["Salário 900"]);
    expect(view(db, DEZ.month, DEZ.year)).toEqual(["Salário 850"]);
    expect(db.rows.find((r) => r.id === "s")!.date).toBe("2026-10-15");
  });

  it("só este mês, no mês de origem: o mesmo, e o saldo não dobra", () => {
    let db: Db = { rows: [fixa("s", "2026-11-15", { status: "pago" })], excluded: new Set() };
    db = apply(db, planEdit(db.rows[0], "month", { ...db.rows[0], name: "Salário Novembro", status: "pago" }, { ...NOV, all: db.rows }));
    expect(view(db, NOV.month, NOV.year)).toEqual(["Salário Novembro 850"]);
    expect(view(db, DEZ.month, DEZ.year)).toEqual(["Salário 850"]);
    expect(balance(db)).toBe(850);
  });

  it("este e os próximos: muda daqui em diante, os meses de antes ficam como eram", () => {
    let db: Db = { rows: [fixa("s", "2026-10-15")], excluded: new Set() };
    db = apply(db, planEdit(db.rows[0], "all", { ...db.rows[0], id: undefined, amount: 1000, date: "2026-11-15" }, { ...NOV, all: db.rows }));
    expect(view(db, OUT.month, OUT.year)).toEqual(["Salário 850"]);
    expect(view(db, NOV.month, NOV.year)).toEqual(["Salário 1000"]);
    expect(view(db, JAN.month, JAN.year)).toEqual(["Salário 1000"]);
  });

  it("este e os próximos com uma cópia antiga: a antiga não reaparece com o valor velho", () => {
    let db: Db = { rows: [fixa("velho", "2026-10-15"), fixa("novo", "2026-11-15")], excluded: new Set() };
    db = apply(db, planEdit(db.rows[1], "all", { ...db.rows[1], amount: 1000 }, { ...NOV, all: db.rows }));
    expect(view(db, NOV.month, NOV.year)).toEqual(["Salário 1000"]);
    expect(view(db, DEZ.month, DEZ.year)).toEqual(["Salário 1000"]);
    expect(view(db, OUT.month, OUT.year)).toEqual(["Salário 850"]);
  });
});

describe("parcelas", () => {
  const months = (db: Db) => [OUT, NOV, DEZ, JAN].map((m) => view(db, m.month, m.year).join());

  it("excluir só esta parcela tira só ela", () => {
    let db: Db = { rows: parcels(4), excluded: new Set() };
    db = apply(db, planDelete(db.rows[1], "month", { ...NOV, all: db.rows }));
    expect(months(db)).toEqual(["Tv 480", "", "Tv 480", "Tv 480"]);
  });

  it("excluir só a primeira parcela não leva as outras junto", () => {
    let db: Db = { rows: parcels(4), excluded: new Set() };
    db = apply(db, planDelete(db.rows[0], "month", { ...OUT, all: db.rows }));
    expect(months(db)).toEqual(["", "Tv 480", "Tv 480", "Tv 480"]);
    const heads = db.rows.filter((r) => !r.parent_transaction_id);
    expect(heads.map((r) => r.id)).toEqual(["p2"]);
    expect(db.rows.filter((r) => r.parent_transaction_id).every((r) => r.parent_transaction_id === "p2")).toBe(true);
    expect(balance(db)).toBe(0);
  });

  it("excluir esta e as próximas mantém as de antes", () => {
    let db: Db = { rows: parcels(4), excluded: new Set() };
    db = apply(db, planDelete(db.rows[2], "all", { ...DEZ, all: db.rows }));
    expect(months(db)).toEqual(["Tv 480", "Tv 480", "", ""]);
  });

  it("editar só esta parcela muda só ela", () => {
    let db: Db = { rows: parcels(4), excluded: new Set() };
    db = apply(db, planEdit(db.rows[1], "month", { ...db.rows[1], amount: 500, installments: 1 }, { ...NOV, all: db.rows }));
    expect(months(db)).toEqual(["Tv 480", "Tv 500", "Tv 480", "Tv 480"]);
    expect(db.rows.find((r) => r.id === "p2")!.installments).toBe(4);
  });

  it("editar a primeira só nela não muda as outras", () => {
    let db: Db = { rows: parcels(4), excluded: new Set() };
    db = apply(db, planEdit(db.rows[0], "month", { ...db.rows[0], name: "Televisão" }, { ...OUT, all: db.rows }));
    expect(months(db)).toEqual(["Televisão 480", "Tv 480", "Tv 480", "Tv 480"]);
  });

  it("editar esta e as próximas muda daqui em diante, cada uma na sua data", () => {
    let db: Db = { rows: parcels(4), excluded: new Set() };
    db = apply(db, planEdit(db.rows[1], "all", { ...db.rows[1], name: "Televisão", amount: 500 }, { ...NOV, all: db.rows }));
    expect(months(db)).toEqual(["Tv 480", "Televisão 500", "Televisão 500", "Televisão 500"]);
    expect(db.rows.map((r) => r.date)).toEqual(parcels(4).map((r) => r.date));
    expect(db.rows.find((r) => r.id === "p1")!.status).toBe("pago");
  });
});

describe("lançamento comum", () => {
  it("excluir e editar mexem só nele", () => {
    const row: SeriesRow = { id: "u", name: "Uber", type: "despesa", category: "Transporte", amount: 18, date: "2026-11-02", status: "pago", recurrence_type: "unica" };
    let db: Db = { rows: [row], excluded: new Set() };
    db = apply(db, planEdit(row, "all", { amount: 20 }, { ...NOV, all: db.rows }));
    expect(balance(db)).toBe(-20);
    db = apply(db, planDelete(db.rows[0], "all", { ...NOV, all: db.rows }));
    expect(db.rows).toEqual([]);
  });
});
