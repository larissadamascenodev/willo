import { recurringSignature } from "@/services/recurringService";

/**
 * What to do to the rows when one entry of a series is deleted or changed.
 *
 * A series is either a fixed entry (one row that stands for every month from its own
 * on) or a purchase in instalments (one row per instalment, the later ones hanging
 * from the first). Either way the person is asked: only this one, or this one and the
 * ones after. Nothing is ever moved to another date to make it disappear — moving a
 * fixed entry forward let an older copy of the same entry show through in its place.
 *
 * - Only this one: the month (or instalment) changes; every other stays as it was.
 * - This and the next: from this month on, all of them change alike; the months
 *   before keep what they had.
 *
 * The plan is a list of plain operations, so it can be checked without a database.
 */

export interface SeriesRow {
  id: string;
  name: string;
  type: string;
  category: string;
  amount: number | string;
  date: string;
  status: string;
  payment_method?: string | null;
  account_id?: string | null;
  credit_card_id?: string | null;
  recurrence_type?: string | null;
  installments?: number | null;
  installment_current?: number | null;
  parent_transaction_id?: string | null;
}

export type SeriesOp =
  /** This month no longer shows the fixed entry. */
  | { op: "exclude"; id: string; month: number; year: number }
  /** Neither this month nor any after it shows the fixed entry. */
  | { op: "excludeOnward"; id: string; month: number; year: number }
  /** Change this one row, and only it. */
  | { op: "update"; id: string; patch: Record<string, unknown> }
  /** Delete this one row, and only it. */
  | { op: "delete"; id: string }
  | { op: "create"; fields: Record<string, unknown> };

export type Scope = "month" | "all";

const monthKey = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;

export const isFixed = (r: Pick<SeriesRow, "recurrence_type">) => r.recurrence_type === "fixa";
export const isParcel = (r: Pick<SeriesRow, "recurrence_type" | "installments">) =>
  r.recurrence_type === "parcelado" && (r.installments ?? 0) > 1;

/** Other rows that define the very same fixed entry (it was written down more than once). */
export function sameSeries(row: SeriesRow, all: SeriesRow[]) {
  const sig = recurringSignature(row as never);
  return all.filter((r) => r.id !== row.id && isFixed(r) && recurringSignature(r as never) === sig);
}

/** The instalments of the purchase this row belongs to, first to last. */
export function purchaseOf(row: SeriesRow, all: SeriesRow[]) {
  const head = row.parent_transaction_id ?? row.id;
  return all
    .filter((r) => r.id === head || r.parent_transaction_id === head)
    .sort((a, b) => (a.installment_current ?? 0) - (b.installment_current ?? 0) || a.date.localeCompare(b.date));
}

/** Ending a fixed entry from a month on: rows that start there or later go, older ones stop showing. */
function endFrom(rows: SeriesRow[], month: number, year: number): SeriesOp[] {
  const k = year * 12 + month;
  return rows.map((r) => (monthKey(r.date) >= k ? { op: "delete", id: r.id } : { op: "excludeOnward", id: r.id, month, year }));
}

/**
 * Taking one instalment out of a purchase. The first instalment is the one the others
 * hang from, so before it goes the next one takes its place.
 */
function dropInstalment(row: SeriesRow, purchase: SeriesRow[]): SeriesOp[] {
  if (row.parent_transaction_id) return [{ op: "delete", id: row.id }];
  const rest = purchase.filter((r) => r.id !== row.id);
  if (rest.length === 0) return [{ op: "delete", id: row.id }];
  const [next, ...others] = rest;
  return [
    { op: "update", id: next.id, patch: { parent_transaction_id: null } },
    ...others.map((r) => ({ op: "update" as const, id: r.id, patch: { parent_transaction_id: next.id } })),
    { op: "delete", id: row.id },
  ];
}

export function planDelete(
  row: SeriesRow,
  scope: Scope,
  where: { month: number; year: number; all: SeriesRow[] },
): SeriesOp[] {
  const { month, year, all } = where;
  const k = year * 12 + month;

  if (isFixed(row)) {
    if (scope === "month") {
      const ops: SeriesOp[] = [{ op: "exclude", id: row.id, month, year }];
      /* In its own month it is a real row: if it had happened, it stops counting. */
      if (monthKey(row.date) === k && row.status === "pago") ops.push({ op: "update", id: row.id, patch: { status: "pendente" } });
      return ops;
    }
    return endFrom([row, ...sameSeries(row, all)], month, year);
  }

  if (isParcel(row)) {
    const purchase = purchaseOf(row, all);
    if (scope === "month") return dropInstalment(row, purchase);
    const at = row.installment_current ?? 1;
    /* The later ones first: the first instalment is what the rest hang from. */
    return purchase
      .filter((r) => (r.installment_current ?? 1) >= at)
      .reverse()
      .map((r) => ({ op: "delete" as const, id: r.id }));
  }

  return [{ op: "delete", id: row.id }];
}

/** The fields that belong to a purchase as a whole, as opposed to one instalment's date and state. */
const SHARED = ["name", "type", "amount", "category", "payment_method", "account_id", "credit_card_id", "observation"] as const;

export function planEdit(
  row: SeriesRow,
  scope: Scope,
  fields: Record<string, unknown>,
  where: { month: number; year: number; all: SeriesRow[] },
): SeriesOp[] {
  const { month, year, all } = where;
  const k = year * 12 + month;

  if (isFixed(row)) {
    if (scope === "month") {
      /* This month leaves the series and gets an entry of its own; the series is untouched. */
      const ops: SeriesOp[] = [{ op: "exclude", id: row.id, month, year }];
      if (monthKey(row.date) === k && row.status === "pago") ops.push({ op: "update", id: row.id, patch: { status: "pendente" } });
      ops.push({ op: "create", fields: { ...fields, recurrence_type: "unica", installments: null, installment_current: null } });
      return ops;
    }
    /* From this month on the series is the changed one; the months before keep the old. */
    const siblings = endFrom(sameSeries(row, all), month, year);
    if (monthKey(row.date) >= k) return [{ op: "update", id: row.id, patch: fields }, ...siblings];
    return [{ op: "excludeOnward", id: row.id, month, year }, { op: "create", fields }, ...siblings];
  }

  if (isParcel(row)) {
    /* An instalment keeps its place in the purchase whatever is changed on it. */
    const own: Record<string, unknown> = { ...fields };
    for (const f of ["recurrence_type", "installments", "installment_current", "parent_transaction_id"]) delete own[f];
    if (scope === "month") return [{ op: "update", id: row.id, patch: own }];
    const shared: Record<string, unknown> = {};
    for (const f of SHARED) if (f in own) shared[f] = own[f];
    const at = row.installment_current ?? 1;
    return purchaseOf(row, all)
      .filter((r) => (r.installment_current ?? 1) >= at)
      .map((r) => ({ op: "update" as const, id: r.id, patch: r.id === row.id ? own : shared }));
  }

  return [{ op: "update", id: row.id, patch: fields }];
}
