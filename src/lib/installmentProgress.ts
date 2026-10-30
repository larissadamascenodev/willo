export interface InstallmentTransactionRow {
  id: string;
  name: string;
  category: string;
  amount: number;
  installment_current: number | null;
  installments: number | null;
  payment_method: string;
  date: string;
  credit_card_id: string | null;
  parent_transaction_id: string | null;
  status: string;
  type?: string | null;
}

interface InvoiceRow {
  is_paid: boolean;
  month?: number;
  year?: number;
}

interface InvoiceTransactionRow {
  id: string;
  name: string;
  category: string;
  payment_method: string;
  credit_card_id: string | null;
  parent_transaction_id: string | null;
  date: string;
  type?: string | null;
}

export interface InstallmentInvoiceRow {
  transaction_id: string;
  amount: number;
  installment_number: number;
  total_installments: number;
  invoices: InvoiceRow | InvoiceRow[] | null;
  transactions: InvoiceTransactionRow | InvoiceTransactionRow[] | null;
}

export interface ActiveInstallmentItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  installment_current: number;
  installments: number;
  payment_method: string;
  date: string;
  credit_card_id: string | null;
  isOverdue: boolean;
  dueDate: string | null;
}

interface InstallmentGroup {
  id: string;
  name: string;
  category: string;
  amount: number;
  installments: number;
  payment_method: string;
  date: string;
  credit_card_id: string | null;
  unpaidInstallments: Set<number>;
  unpaidInvoiceInstallments: Map<number, string | null>;
  dueDates: Map<number, string>;
}

const pickOne = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const upsertGroup = (map: Map<string, InstallmentGroup>, group: Omit<InstallmentGroup, "unpaidInstallments" | "unpaidInvoiceInstallments" | "dueDates">) => {
  const existing = map.get(group.id);

  if (existing) {
    existing.installments = Math.max(existing.installments, group.installments);
    if (group.date < existing.date) existing.date = group.date;
    return existing;
  }

  const created: InstallmentGroup = {
    ...group,
    unpaidInstallments: new Set<number>(),
    unpaidInvoiceInstallments: new Map<number, string | null>(),
    dueDates: new Map<number, string>(),
  };
  map.set(group.id, created);
  return created;
};

export const buildActiveInstallmentItems = ({
  transactions,
  invoiceItems,
  creditCardDueDays,
}: {
  transactions: InstallmentTransactionRow[];
  invoiceItems: InstallmentInvoiceRow[];
  creditCardDueDays?: Record<string, number>;
}): ActiveInstallmentItem[] => {
  const groups = new Map<string, InstallmentGroup>();

  transactions.forEach((tx) => {
    if (tx.type && tx.type !== "despesa") return;
    if (!tx.installments || tx.installments <= 1) return;
    if (tx.payment_method === "cartao" && tx.credit_card_id) return;

    const installmentNumber = tx.installment_current ?? 1;
    const groupId = tx.parent_transaction_id ?? tx.id;
    const group = upsertGroup(groups, {
      id: groupId,
      name: tx.name,
      category: tx.category,
      amount: tx.amount,
      installments: tx.installments,
      payment_method: tx.payment_method,
      date: tx.date,
      credit_card_id: tx.credit_card_id,
    });

    if (tx.status !== "pago") {
      group.unpaidInstallments.add(installmentNumber);
    }
  });

  invoiceItems.forEach((item) => {
    const tx = pickOne(item.transactions);
    const invoice = pickOne(item.invoices);

    if (!tx || !invoice) return;
    if (tx.type && tx.type !== "despesa") return;
    if (item.total_installments <= 1) return;

    const groupId = tx.parent_transaction_id ?? item.transaction_id;
    const group = upsertGroup(groups, {
      id: groupId,
      name: tx.name,
      category: tx.category,
      amount: item.amount,
      installments: item.total_installments,
      payment_method: tx.payment_method,
      date: tx.date,
      credit_card_id: tx.credit_card_id,
    });

    if (
      tx.credit_card_id &&
      creditCardDueDays?.[tx.credit_card_id] &&
      invoice.month &&
      invoice.year
    ) {
      const dueDay = creditCardDueDays[tx.credit_card_id];
      const dueDate = new Date(invoice.year, invoice.month - 1, dueDay, 12, 0, 0);
      group.dueDates.set(item.installment_number, dueDate.toISOString());
    }

    if (!invoice.is_paid) {
      group.unpaidInvoiceInstallments.set(
        item.installment_number,
        group.dueDates.get(item.installment_number) ?? null,
      );
    }
  });

  return Array.from(groups.values())
    .map((group) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const cardOpenInstallments = Array.from(group.unpaidInvoiceInstallments.keys()).sort((a, b) => a - b);
      const accountOpenInstallments = Array.from(group.unpaidInstallments).sort((a, b) => a - b);

      const currentInstallment = group.payment_method === "cartao"
        ? cardOpenInstallments[0]
        : accountOpenInstallments[0];

      if (!currentInstallment) return null;

      const dueDate = group.payment_method === "cartao"
        ? group.unpaidInvoiceInstallments.get(currentInstallment) ?? null
        : null;

      const paidInstallments = currentInstallment - 1;

      return {
        id: group.id,
        name: group.name,
        category: group.category,
        amount: group.amount,
        installment_current: currentInstallment,
        installments: group.installments,
        payment_method: group.payment_method,
        date: group.date,
        credit_card_id: group.credit_card_id,
        isOverdue: dueDate ? (() => {
          const parsed = new Date(dueDate);
          parsed.setHours(0, 0, 0, 0);
          return parsed < today;
        })() : (() => {
          const baseDate = new Date(`${group.date.slice(0, 10)}T12:00:00`);
          const expectedDate = new Date(baseDate);
          expectedDate.setMonth(expectedDate.getMonth() + paidInstallments);
          expectedDate.setHours(0, 0, 0, 0);
          return expectedDate < today;
        })(),
        dueDate,
      } satisfies ActiveInstallmentItem;
    })
    .filter((item): item is ActiveInstallmentItem => item !== null)
    .sort((a, b) => b.amount - a.amount);
};