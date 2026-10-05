import { useState } from "react";
import { motion } from "framer-motion";
import { Receipt, Layers, Trash2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
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
  onEditItem?: (transactionId: string, updates?: { name?: string; amount?: number; category?: string }, scope?: RecurrenceScope) => Promise<void>;
  onDeleteItem?: (transactionId: string, scope?: RecurrenceScope) => Promise<void>;
}

function InstallmentBar({ current, total }: { current: number; total: number }) {
  if (total <= 1) return null;
  return (
    <div className="flex gap-[4px] w-full">
      {Array.from({ length: total }, (_, i) => {
        const installmentNum = i + 1;
        const isPaid = installmentNum < current;
        const isCurrent = installmentNum === current;
        return (
          <div
            key={i}
            className={cn(
              "h-[4px] rounded-[1.5px] flex-1",
              isPaid
                ? "bg-primary"
                : isCurrent
                  ? "bg-white/80"
                  : "bg-white/15"
            )}
          />
        );
      })}
    </div>
  );
}

export default function InvoiceTransactionList({ items, hideHeader = false, installmentCount = 0, cardName, invoiceMonth, invoiceYear, payments = [], isPaid = false, onEditItem, onDeleteItem }: Props) {
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

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-2"
      >
        {/* Section header */}
        <div className={cn("flex items-center justify-between", hideHeader && "hidden")}>
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-primary" />
            <h2 className="text-sm font-bold text-foreground">Lançamentos</h2>
          </div>
          {installmentCount > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Layers className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">{installmentCount}</span>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-border/15 bg-card/60 backdrop-blur-xl p-8 text-center">
            <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Não houve lançamentos</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Individual payment entries — newest first (on top) */}
            {!isPaid && payments.map((payment, pIdx) => (
              <motion.div
                key={payment.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: pIdx * 0.03 }}
                className="rounded-xl border border-primary/20 bg-primary/[0.06] backdrop-blur-xl border-l-[3px] border-l-primary px-3 py-2.5"
                style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.25)" }}
              >
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 self-start mt-0.5">
                    <Wallet className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-bold text-primary leading-tight">
                          Pagamento parcial
                        </p>
                        <p className="text-[11px] text-muted-foreground/50">
                          {new Date(payment.paid_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                      <p className="text-[13px] font-bold text-primary tabular-nums leading-tight shrink-0">
                        +{formatCurrency(Number(payment.amount))}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {items.map((item, idx) => {
              const isInstallment = item.total_installments > 1;
              const totalValue = isInstallment ? Number(item.amount) * item.total_installments : null;
              const offset = payments.length;
              const isSubscription = item.transaction_recurrence_type === "fixa";

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (idx + offset) * 0.03 }}
                  onClick={() => setSelectedItem(item)}
                  className="rounded-xl border border-border/15 bg-card/60 backdrop-blur-xl border-l-[3px] border-l-primary/40 px-3 py-2.5 cursor-pointer active:scale-[0.98] transition-transform select-none"
                  style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.25)" }}
                >
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted/20 border border-border/10 flex items-center justify-center shrink-0 self-start mt-0.5">
                      <Layers className="w-4 h-4 text-muted-foreground/60" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-bold text-foreground leading-tight truncate">
                          {item.transaction_name}
                        </p>
                        <div className="text-right shrink-0">
                          <p className="text-[13px] font-bold text-foreground tabular-nums leading-tight">
                            {formatCurrency(Number(item.amount))}
                          </p>
                          {totalValue && (
                            <p className="text-[10px] text-muted-foreground/60 tabular-nums leading-tight mt-0.5">
                              Total: {formatCurrency(totalValue)}
                            </p>
                          )}
                        </div>
                      </div>
                      {isInstallment && (
                        <InstallmentBar current={item.installment_number} total={item.total_installments} />
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground/50">{item.transaction_category}</span>
                        {isInstallment ? (
                          <span className="text-[11px] tabular-nums">
                            <span className="font-bold text-primary">{item.installment_number}</span>
                            <span className="text-muted-foreground/50"> de {item.total_installments} parcelas</span>
                          </span>
                        ) : isSubscription ? (
                          <span className="text-[10px] text-primary/70 font-semibold">Assinatura</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40">Pagamento único</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
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
