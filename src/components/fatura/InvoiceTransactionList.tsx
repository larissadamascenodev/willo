import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, FastForward, Layers, Receipt, Trash2, Undo2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDateOnly } from "@/lib/dateOnly";
import { readInvoice, type LineKind } from "@/lib/invoice/readModel";
import { getCategoryColor, getCategoryIcon } from "@/lib/categoryUtils";
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
import InvoiceItemDetailModal from "./InvoiceItemDetailModal";
import InvoiceItemEditModal from "./InvoiceItemEditModal";
import RecurrenceActionModal, { type RecurrenceScope } from "./RecurrenceActionModal";

interface Props {
  items: EnrichedItem[];
  /** Off where the caller already titles the section, so it is not announced twice. */
  hideHeader?: boolean;
  installmentCount?: number;
  cardName?: string;
  invoiceMonth: number;
  invoiceYear: number;
  payments?: InvoicePayment[];
  isPaid?: boolean;
  /** Only the newest N lines, for the card panel's recent block. */
  maxLines?: number;
  /** Which lines to show. "parcelados" keeps instalments only. */
  filter?: "todos" | "parcelados";
  /** Renders the footer that opens the full list. */
  onSeeAll?: () => void;
  onEditItem?: (transactionId: string, updates?: { name?: string; amount?: number; category?: string }, scope?: RecurrenceScope) => Promise<void>;
  onDeleteItem?: (transactionId: string, scope?: RecurrenceScope) => Promise<void>;
}

/**
 * What marks each kind of line.
 *
 * Every line used to be drawn the same, so a refund was a negative number you had to
 * notice and an instalment brought forward was indistinguishable from an ordinary one.
 * The kind itself comes from readInvoice; this is only how it is worn — a word beside
 * the name, and, where money moves the other way, a colour.
 */
const KIND: Record<LineKind, { label: string; chip: string | null; Icon?: typeof Undo2; hex?: string }> = {
  avista: { label: "À vista", chip: null },
  parcelado: { label: "Parcelado", chip: "bg-[#A78BFA]/15 text-[#A78BFA]" },
  estorno: { label: "Estorno", chip: "bg-willo-green/15 text-willo-green-ink", Icon: Undo2, hex: "#C8F36D" },
  antecipacao: { label: "Antecipada", chip: "bg-[#7DD3FC]/15 text-[#7DD3FC]", Icon: FastForward, hex: "#7DD3FC" },
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

/**
 * How far along a plan is. Up to twelve instalments it is drawn one tick each, which
 * can be counted; beyond that the ticks are thinner than the gaps between them, so it
 * becomes one bar that is simply filled.
 */
function InstallmentBar({ current, total }: { current: number; total: number }) {
  if (total <= 1) return null;
  const paidPct = ((current - 1) / total) * 100;

  if (total > 12) {
    return (
      <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/[0.10]">
        <motion.span
          className="block h-full rounded-full bg-[#A78BFA]"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(paidPct, 3)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex w-full gap-[3px]">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        return (
          <span
            key={i}
            className={cn(
              "h-[3px] flex-1 rounded-full",
              n < current ? "bg-[#A78BFA]" : n === current ? "bg-white/85" : "bg-white/[0.14]",
            )}
          />
        );
      })}
    </div>
  );
}

export default function InvoiceTransactionList({
  items, hideHeader = false, installmentCount = 0, cardName, invoiceMonth, invoiceYear,
  payments = [], isPaid = false, maxLines, filter = "todos", onSeeAll, onEditItem, onDeleteItem,
}: Props) {
  /* What the invoice contains, decided in one place. The rows that come back are
     already ordered newest first and already know what they are; this component only
     has to dress them. The original items are kept by id because the detail and edit
     modals still work on the raw row. */
  const { lines } = useMemo(() => readInvoice(items), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const shown = useMemo(() => {
    const picked = filter === "parcelados" ? lines.filter((l) => l.kind === "parcelado") : lines;
    return maxLines ? picked.slice(0, maxLines) : picked;
  }, [lines, filter, maxLines]);

  const hiddenCount = (filter === "parcelados" ? lines.filter((l) => l.kind === "parcelado").length : lines.length) - shown.length;

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
  const [editItem, setEditItem] = useState<EnrichedItem | null>(null);
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
        // Just exclude this month
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
        // Delete all — show final confirm
        setDeleteTarget(target);
      }
    } else if (action === "edit") {
      // For edit, we pass scope to parent
      if (onEditItem) {
        await onEditItem(target.transaction_id, undefined, scope);
      }
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
    const item = items.find(i => i.transaction_id === txId);
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
    const target = items.find(i => i.transaction_id === txId);
    if (target) {
      setSelectedItem(null);
      handleDeleteRequest(target);
    }
  };

  /* A filter can empty the list while a payment still stands above it, so the two are
     decided separately — "nenhuma compra parcelada" under a payment is the truth. */
  const empty = shown.length === 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        {/* Section header */}
        <div className={cn("mb-2.5 flex items-center justify-between", hideHeader && "hidden")}>
          <h2 className="text-[15px] font-bold text-white">Lançamentos</h2>
          {installmentCount > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold t-softer">
              <Layers className="h-3.5 w-3.5" />
              {installmentCount}
            </span>
          )}
        </div>

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
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-willo-green/15">
                      <Wallet className="h-[17px] w-[17px] text-willo-green-ink" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium text-white">Pagamento</p>
                      <p className="mt-0.5 text-[12px] t-softer">
                        {new Date(payment.paid_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                    <p className="shrink-0 text-[14.5px] font-semibold tabular-nums text-willo-green-ink">
                      +{formatCurrency(Number(payment.amount))}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}

            {empty && (
              <div className="rounded-[22px] border border-dashed border-white/[0.09] px-4 py-8 text-center">
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
                    {/* A day's total is only true when the whole day is on screen; the
                        panel shows the newest few, so there it is left unsaid. */}
                    {net !== 0 && !maxLines && (
                      <span className={cn(
                        "shrink-0 text-[12px] font-semibold tabular-nums",
                        net < 0 ? "text-willo-green-ink" : "t-softer",
                      )}>
                        {net < 0 ? "+" : "−"}{formatCurrency(Math.abs(net))}
                      </span>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-[22px] border border-white/[0.08] divide-y divide-white/[0.055]">
                    {dayLines.map((line, idx) => {
                      const look = KIND[line.kind];
                      const item = byId.get(line.id);
                      const Icon = look.Icon ?? getCategoryIcon(line.category);
                      const catColor = getCategoryColor(line.category);
                      const planTotal = line.installment ? line.amount * line.installment.total : null;

                      return (
                        <motion.div
                          key={line.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          onClick={() => item && setSelectedItem(item)}
                          className="cursor-pointer px-4 py-3.5 willo-glass transition-colors active:bg-white/[0.04]"
                        >
                          <div className="flex items-center gap-3.5">
                            <span
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                              style={{
                                background: look.hex ? `${look.hex}26` : `hsl(${catColor} / 0.15)`,
                              }}
                            >
                              <Icon
                                className="h-[17px] w-[17px]"
                                style={{ color: look.hex ?? `hsl(${catColor})` }}
                              />
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-[14.5px] font-medium text-white">{line.name}</p>
                                {look.chip && (
                                  <span className={cn(
                                    "shrink-0 rounded-full px-1.5 py-[1px] text-[10px] font-bold",
                                    look.chip,
                                  )}>
                                    {line.installment
                                      ? `${line.installment.current}/${line.installment.total}`
                                      : look.label}
                                  </span>
                                )}
                              </div>
                              {/* The card is not named: you are already inside it. */}
                              <p className="mt-0.5 truncate text-[12px] t-softer">{line.category}</p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className={cn(
                                "text-[14.5px] font-semibold tabular-nums",
                                line.amount < 0 ? "text-willo-green-ink" : "text-white",
                              )}>
                                {line.amount < 0 ? "+" : ""}{formatCurrency(Math.abs(line.amount))}
                              </p>
                              {/* The instalment is said once, by the chip. What the chip
                                  cannot say is what the whole purchase cost. */}
                              {planTotal !== null && (
                                <p className="mt-0.5 text-[11.5px] tabular-nums t-softer">
                                  de {formatCurrency(planTotal)}
                                </p>
                              )}
                            </div>
                          </div>

                          {line.installment && (
                            <div className="pl-[54px]">
                              <InstallmentBar
                                current={line.installment.current}
                                total={line.installment.total}
                              />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {onSeeAll && (
              <button
                type="button"
                onClick={onSeeAll}
                className="flex h-[50px] w-full items-center justify-center gap-1.5 rounded-[18px] border border-white/[0.08] willo-glass text-[14px] font-semibold text-white/85 active:scale-[0.99]"
              >
                Ver todos os lançamentos
                {hiddenCount > 0 && <span className="t-softer">· +{hiddenCount}</span>}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
        </div>
      </motion.div>

      {/* Detail Modal */}
      {selectedItem && (
        <InvoiceItemDetailModal
          item={selectedItem}
          cardName={cardName}
          invoiceMonth={invoiceMonth}
          invoiceYear={invoiceYear}
          onClose={() => setSelectedItem(null)}
          onEdit={onEditItem ? handleEditFromDetail : undefined}
          onDelete={onDeleteItem ? handleDeleteFromDetail : undefined}
        />
      )}

      {/* Edit Modal */}
      <InvoiceItemEditModal
        item={editItem}
        open={!!editItem}
        onClose={() => setEditItem(null)}
        onSave={async (txId, updates) => {
          if (onEditItem) await onEditItem(txId, updates);
          setEditItem(null);
        }}
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
        <AlertDialogContent className="max-w-sm rounded-2xl bg-card border border-border/30 shadow-2xl p-5 gap-4">
          <AlertDialogHeader className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-destructive/15 border border-destructive/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-sm font-bold text-foreground text-center">
              Excluir lançamento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground text-center leading-relaxed">
              Tem certeza que deseja excluir <span className="font-bold text-foreground">"{deleteTarget?.transaction_name}"</span>?
              {deleteTarget && deleteTarget.total_installments > 1 && (
                <span className="block mt-1 text-destructive font-medium">
                  Isso removerá todas as {deleteTarget.total_installments} parcelas desta compra.
                </span>
              )}
              {deleteTarget && isFixa(deleteTarget) && (
                <span className="block mt-1 text-destructive font-medium">
                  Isso removerá esta assinatura deste mês e de todos os futuros.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:flex-row">
            <AlertDialogCancel
              disabled={deleting}
              className="flex-1 h-11 rounded-xl text-xs font-bold border border-border/30 text-muted-foreground hover:text-foreground bg-transparent"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 h-11 rounded-xl text-xs font-bold bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 shadow-[0_0_12px_-3px_hsl(var(--destructive)/0.4)]"
            >
              {deleting ? "Excluindo..." : "Confirmar exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
