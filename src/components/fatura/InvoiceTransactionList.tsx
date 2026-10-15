import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FastForward, Receipt, Trash2, Undo2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDateOnly } from "@/lib/dateOnly";
import { readInvoice, type LineKind } from "@/lib/invoice/readModel";
import { getCategoryIcon, getCategoryHexColor } from "@/lib/categoryUtils";
import { chipFill, chipInk } from "@/lib/chipColor";
import { formatCurrency, type EnrichedItem } from "@/pages/FaturaCartao";
import type { InvoicePayment } from "@/services/invoiceService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CardEntryModal from "./CardEntryModal";
import RecurrenceActionModal, { type RecurrenceScope } from "./RecurrenceActionModal";

interface Props {
  items: EnrichedItem[];
  cardName?: string;
  invoiceMonth: number;
  invoiceYear: number;
  payments?: InvoicePayment[];
  isPaid?: boolean;
  /** Which lines to show. "parcelados" keeps instalments only. */
  filter?: "todos" | "parcelados";
  onEditItem?: (transactionId: string, updates?: { name?: string; amount?: number; category?: string }, scope?: RecurrenceScope) => Promise<void>;
  onDeleteItem?: (transactionId: string, scope?: RecurrenceScope) => Promise<void>;
}

/**
 * The lines of an invoice, read the way Transações reads a month.
 *
 * Same row, same day headings, same gestures — because they are the same thing, and a
 * person who has learned one list should not have to learn another. What a card line
 * can be that an ordinary expense cannot is said on the row itself: an instalment
 * carries its number and how far along the plan is, money coming back is green with a
 * plus, and an instalment charged early is named.
 */

/** What marks each kind. Only the two unusual ones get a colour of their own. */
const KIND: Record<LineKind, { tag: string | null; hex: string | null; Icon?: typeof Undo2 }> = {
  avista: { tag: null, hex: null },
  parcelado: { tag: null, hex: null },
  estorno: { tag: "Estorno", hex: "#C8F36D", Icon: Undo2 },
  antecipacao: { tag: "Antecipada", hex: "#7DD3FC", Icon: FastForward },
};

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "Hoje", "Ontem", or the weekday — people read recency, not calendars. */
function dayLabel(iso: string): string {
  const { year, month, day } = parseDateOnly(iso);
  const that = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  const written = `${WEEKDAYS[that.getDay()]}, ${day} de ${MONTHS_SHORT[month]}`;
  if (diff === 0) return `Hoje · ${written}`;
  if (diff === 1) return `Ontem · ${written}`;
  return written;
}

/** How far along a plan is, as one quiet rule under the row. */
export function InstallmentBar({ current, total, className }: { current: number; total: number; className?: string }) {
  if (total <= 1) return null;
  const done = ((current - 1) / total) * 100;
  return (
    <div className={cn("h-[3px] overflow-hidden rounded-full bg-white/[0.09]", className)}>
      <motion.span
        className="block h-full rounded-full bg-white/70"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(done, 2)}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

/** One line of the invoice, in the shape Transações uses for a transaction. */
export function InvoiceLineRow({ line, index, onOpen }: {
  line: ReturnType<typeof readInvoice>["lines"][number];
  index: number;
  onOpen?: () => void;
}) {
  const look = KIND[line.kind];
  const hex = look.hex ?? getCategoryHexColor(line.category);
  const Icon = look.Icon ?? getCategoryIcon(line.category);
  const isRefund = line.amount < 0;
  const planTotal = line.installment ? Math.abs(line.amount) * line.installment.total : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onOpen}
      className="cursor-pointer px-4 py-3.5 transition-colors active:bg-white/[0.04]"
    >
      <div className="flex items-center gap-3.5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: chipFill(hex) }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: chipInk(hex) }} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[15px] font-medium text-white">{line.name}</p>
            {look.tag && (
              <span
                className="shrink-0 rounded-full px-1.5 py-[1px] text-[10px] font-bold"
                style={{ background: chipFill(hex), color: chipInk(hex) }}
              >
                {look.tag}
              </span>
            )}
          </div>
          {/* The card is not named: you are already inside it. */}
          <p className="truncate text-[12px] t-soft">
            {line.category}
            {line.installment ? ` · ${line.installment.current}/${line.installment.total}x` : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className={cn(
            "text-[15px] font-semibold tabular-nums",
            isRefund ? "text-willo-green-ink" : "text-white",
          )}>
            {isRefund ? "+" : "−"}{formatCurrency(Math.abs(line.amount))}
          </p>
          <p className="text-[11px] t-soft tabular-nums">
            {planTotal !== null ? `de ${formatCurrency(planTotal)}` : isRefund ? "estorno" : "à vista"}
          </p>
        </div>
      </div>

      {line.installment && (
        <InstallmentBar
          current={line.installment.current}
          total={line.installment.total}
          className="ml-[58px] mt-2"
        />
      )}
    </motion.div>
  );
}

export default function InvoiceTransactionList({
  items, cardName, invoiceMonth, invoiceYear,
  payments = [], isPaid = false, filter = "todos", onEditItem, onDeleteItem,
}: Props) {
  /* What the invoice contains, decided in one place. The rows that come back are
     already ordered newest first and already know what they are; this only dresses
     them. The original rows are kept by id, because editing works on those. */
  const { lines } = useMemo(() => readInvoice(items), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const shown = useMemo(
    () => (filter === "parcelados" ? lines.filter((l) => l.kind === "parcelado") : lines),
    [lines, filter],
  );

  /** Grouped by the day the money moved, newest day first — how a statement is read. */
  const days = useMemo(() => {
    const groups = new Map<string, typeof shown>();
    for (const line of shown) {
      const list = groups.get(line.date);
      if (list) list.push(line);
      else groups.set(line.date, [line]);
    }
    return [...groups.entries()];
  }, [shown]);

  const [selectedItem, setSelectedItem] = useState<EnrichedItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Recurrence scope state
  const [recurrenceAction, setRecurrenceAction] = useState<"edit" | "delete" | null>(null);
  const [recurrenceTarget, setRecurrenceTarget] = useState<EnrichedItem | null>(null);

  const isFixa = (item: EnrichedItem) => item.transaction_recurrence_type === "fixa";

  const handleDeleteRequest = (item: EnrichedItem) => {
    if (isFixa(item)) {
      setRecurrenceTarget(item);
      setRecurrenceAction("delete");
    } else {
      // Parcelado or unica — direct delete (all installments)
      setDeleteTarget(item);
    }
  };

  const handleRecurrenceSelect = async (scope: RecurrenceScope) => {
    if (!recurrenceTarget) return;
    const action = recurrenceAction;
    const target = recurrenceTarget;
    setRecurrenceAction(null);
    setRecurrenceTarget(null);

    if (action === "delete") {
      if (scope === "current") {
        if (onDeleteItem) {
          setDeleting(true);
          try {
            await onDeleteItem(target.transaction_id, "current");
            setSelectedItem(null);
          } finally {
            setDeleting(false);
          }
        }
      } else {
        setDeleteTarget(target);
      }
    } else if (action === "edit" && onEditItem) {
      await onEditItem(target.transaction_id, undefined, scope);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteItem || !deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteItem(deleteTarget.transaction_id, "current_and_future");
      setSelectedItem(null);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleEditFromDetail = (txId: string) => {
    const item = items.find((i) => i.transaction_id === txId);
    if (item && isFixa(item)) {
      setSelectedItem(null);
      setRecurrenceTarget(item);
      setRecurrenceAction("edit");
    } else {
      setSelectedItem(null);
      if (onEditItem) onEditItem(txId);
    }
  };

  const handleDeleteFromDetail = (txId: string) => {
    const target = items.find((i) => i.transaction_id === txId);
    if (target) {
      setSelectedItem(null);
      handleDeleteRequest(target);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Payments already made against this invoice, before the spending. */}
        {!isPaid && payments.length > 0 && (
          <div className="overflow-hidden rounded-[22px] border border-willo-green/20 divide-y divide-white/[0.055]">
            {payments.map((payment, pIdx) => (
              <motion.div
                key={payment.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: pIdx * 0.03 }}
                className="flex items-center gap-3.5 bg-willo-green/[0.05] px-4 py-3.5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-willo-green/15">
                  <Wallet className="h-[18px] w-[18px] text-willo-green-ink" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-white">Pagamento</p>
                  <p className="truncate text-[12px] t-soft">
                    {new Date(payment.paid_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </p>
                </div>
                <p className="shrink-0 text-[15px] font-semibold tabular-nums text-willo-green-ink">
                  +{formatCurrency(Number(payment.amount))}
                </p>
              </motion.div>
            ))}
          </div>
        )}

        {shown.length === 0 && (
          <div className="rounded-[22px] border border-dashed border-white/[0.09] px-4 py-10 text-center">
            <Receipt className="mx-auto mb-2 h-6 w-6 t-faint" />
            <p className="text-[13.5px] t-soft">
              {filter === "parcelados"
                ? "Nenhuma compra parcelada nesta fatura"
                : "Nenhum lançamento nesta fatura"}
            </p>
          </div>
        )}

        {days.map(([day, dayLines]) => {
          const net = dayLines.reduce((s, l) => s + l.amount, 0);
          return (
            <div key={day}>
              <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.13em] t-softer">
                  {dayLabel(day)}
                </span>
                {net !== 0 && (
                  <span className={cn(
                    "shrink-0 text-[12px] font-semibold tabular-nums",
                    net < 0 ? "text-willo-green-ink" : "t-softer",
                  )}>
                    {net < 0 ? "+" : "−"}{formatCurrency(Math.abs(net))}
                  </span>
                )}
              </div>

              <div className="overflow-hidden rounded-[22px] border border-white/[0.08] willo-glass divide-y divide-white/[0.055]">
                {dayLines.map((line, idx) => (
                  <InvoiceLineRow
                    key={line.id}
                    line={line}
                    index={idx}
                    onOpen={() => {
                      const item = byId.get(line.id);
                      if (item) setSelectedItem(item);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* The same card Transações opens, because it is the same kind of thing. */}
      <CardEntryModal
        entry={selectedItem && {
          transactionId: selectedItem.transaction_id,
          name: selectedItem.transaction_name,
          category: selectedItem.transaction_category,
          amount: Number(selectedItem.amount),
          date: selectedItem.transaction_date,
          installmentNumber: selectedItem.installment_number,
          totalInstallments: selectedItem.total_installments,
        }}
        cardName={cardName}
        onClose={() => setSelectedItem(null)}
        onEdit={handleEditFromDetail}
        onDelete={handleDeleteFromDetail}
      />

      {/* Recurrence scope modal */}
      <RecurrenceActionModal
        open={!!recurrenceAction && !!recurrenceTarget}
        action={recurrenceAction || "delete"}
        itemName={recurrenceTarget?.transaction_name || ""}
        onSelect={handleRecurrenceSelect}
        onClose={() => { setRecurrenceAction(null); setRecurrenceTarget(null); }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm gap-4 rounded-[28px] border border-white/[0.08] willo-glass-strong p-5">
          <AlertDialogHeader className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[16px] border border-red-400/20 bg-red-400/[0.10]">
              <Trash2 className="h-5 w-5 text-red-400" />
            </div>
            <AlertDialogTitle className="text-center text-[16px] font-bold text-white">
              Excluir lançamento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-[13px] leading-relaxed t-soft">
              Tem certeza que deseja excluir{" "}
              <span className="font-semibold text-white">{deleteTarget?.transaction_name}</span>?
              {deleteTarget && deleteTarget.total_installments > 1 && (
                <span className="mt-1 block font-medium text-red-400">
                  Isso removerá todas as {deleteTarget.total_installments} parcelas desta compra.
                </span>
              )}
              {deleteTarget && isFixa(deleteTarget) && (
                <span className="mt-1 block font-medium text-red-400">
                  Isso removerá esta assinatura deste mês e de todos os futuros.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2.5 sm:flex-row">
            <AlertDialogCancel
              disabled={deleting}
              className="h-12 flex-1 rounded-full border border-white/[0.08] bg-white/[0.04] text-[14px] font-semibold text-white"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="h-12 flex-1 rounded-full bg-red-500 text-[14px] font-bold text-white"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
