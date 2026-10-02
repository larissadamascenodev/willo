import type { RawTransaction } from "@/lib/financeEngine";

/**
 * What a month is made of. Every figure is a slice of the month's own totals, so the
 * parts always add back up to what the rest of the app shows for that month.
 */
export interface MonthComposition {
  income: {
    /** Salary and anything else that repeats every month. */
    fixas: number;
    /** One-off entries, plus the opening balance of an account created that month. */
    outras: number;
  };
  expense: {
    /** Bills that repeat every month (rent, subscriptions paid from the account). */
    fixas: number;
    /** Instalments paid straight from an account. */
    parcelas: number;
    /** Everything billed on card statements that month. */
    cartao: number;
    /** The part of the card statements that is instalments — included in `cartao`, not on top of it. */
    cartaoParcelas: number;
    /** One-off spending that is neither a repeat nor an instalment. */
    outras: number;
  };
}

export const EMPTY_COMPOSITION: MonthComposition = {
  income: { fixas: 0, outras: 0 },
  expense: { fixas: 0, parcelas: 0, cartao: 0, cartaoParcelas: 0, outras: 0 },
};

type Slice = Pick<RawTransaction, "type" | "amount" | "payment_method" | "recurrence_type"> & {
  parent_transaction_id?: string | null;
};

/** A "fixa", or one of the copies the database spins off from one. */
const repeatsMonthly = (t: Slice) =>
  t.recurrence_type === "fixa" || (t.recurrence_type === "unica" && !!t.parent_transaction_id);

/**
 * Splits a month's transactions into fixed, instalment, card and one-off.
 *
 * `totals` are the month's own figures (what the balance is built from); the "one-off"
 * buckets are whatever is left once the named ones are taken out, which is what keeps the
 * slices summing to the total even when the month also carries an opening balance.
 * Transfers and investments are skipped, exactly as they are in the totals.
 */
export function buildMonthComposition(
  txs: Slice[],
  totals: { income: number; expense: number; cardExpense: number },
): MonthComposition {
  let incomeFixas = 0;
  let expenseFixas = 0;
  let parcelas = 0;
  let cardInstalments = 0;

  for (const t of txs) {
    if (t.type === "transferencia" || t.type === "investimento") continue;
    const amount = Number(t.amount);

    if (t.payment_method === "cartao") {
      // The card's cost is carried by the statement total; only the instalment share is of interest here
      if (t.type === "despesa" && t.recurrence_type === "parcelado") cardInstalments += amount;
      continue;
    }

    if (t.type === "receita") {
      if (repeatsMonthly(t)) incomeFixas += amount;
    } else if (repeatsMonthly(t)) {
      expenseFixas += amount;
    } else if (t.recurrence_type === "parcelado") {
      parcelas += amount;
    }
  }

  const cartao = totals.cardExpense;
  return {
    income: { fixas: incomeFixas, outras: totals.income - incomeFixas },
    expense: {
      fixas: expenseFixas,
      parcelas,
      cartao,
      cartaoParcelas: Math.min(cardInstalments, cartao),
      outras: totals.expense - expenseFixas - parcelas - cartao,
    },
  };
}
