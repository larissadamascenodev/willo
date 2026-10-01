import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X, Pencil, Trash2, Check, Clock, Calendar, Wallet, CreditCard, Tag,
  Repeat, Layers, FileText, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { updateTransactionStatus, updateTransaction, deleteTransaction } from "@/services/transactionService";
import { excludeRecurringForMonth, excludeRecurringFromMonthOnward } from "@/services/recurringService";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { getCategoryHexColor } from "@/lib/categoryUtils";
import { getDefaultCategoryIcon } from "@/lib/categoryIcons";
import { getIconComponent } from "@/components/dashboard/CategoryCreateModal";
import BottomSheet from "@/components/shared/BottomSheet";
import { Row, RowGroup, AmountHero } from "@/components/transactions/TransactionSheetParts";
import { cn } from "@/lib/utils";

export interface TransactionRow {
  id: string;
  name: string;
  category: string;
  date: string;
  time?: string | null;
  amount: number;
  type: string;
  status: string;
  payment_method: string;
  recurrence_type: string;
  installment_current: number | null;
  installments: number | null;
  observation: string | null;
  account_id: string | null;
  credit_card_id: string | null;
}

interface Props {
  open: boolean;
  tx: TransactionRow | null;
  accountName: string;
  onClose: () => void;
  onRefresh: () => void;
  userId?: string;
  selectedMonth: number;
  selectedYear: number;
  /** Opens the same form used to create a transaction. */
  onEdit?: (tx: TransactionRow) => void;
}

const MONTHS_FULL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const longDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MONTHS_FULL[m - 1]} de ${y}`;
};

const RECURRENCE_LABEL: Record<string, string> = {
  unica: "Única",
  fixa: "Todo mês",
  parcelado: "Parcelada",
};

const TransactionDetailModal = ({
  open, tx, accountName, onClose, onRefresh, userId, selectedMonth, selectedYear, onEdit,
}: Props) => {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      getCustomCategories().then(setCustomCategories).catch(() => {});
      setConfirmingDelete(false);
    }
  }, [open]);

  if (!tx) return null;

  const isReceita = tx.type === "receita";
  const isPaid = tx.status === "pago";
  const isCard = tx.payment_method === "cartao";
  const isRecurring = tx.recurrence_type === "fixa";
  const isInstallment = !!(tx.installments && tx.installments > 1);

  const custom = customCategories.find((c) => c.name === tx.category);
  const CatIcon = custom ? getIconComponent(custom.icon) : getDefaultCategoryIcon(tx.category);
  const catHex = getCategoryHexColor(tx.category, customCategories);

  const close = () => { setConfirmingDelete(false); onClose(); };

  const run = async (fn: () => Promise<void>, ok: string) => {
    setLoading(true);
    try {
      await fn();
      toast.success(ok);
      onRefresh();
      close();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível concluir");
    } finally {
      setLoading(false);
    }
  };

  const togglePaid = () =>
    run(
      () => updateTransactionStatus(tx.id, isPaid ? "pendente" : "pago").then(() => undefined),
      isPaid ? "Marcada como pendente" : isReceita ? "Marcada como recebida" : "Marcada como paga",
    );

  const isOriginalMonth = (() => {
    const [y, m] = tx.date.split("-").map(Number);
    return m - 1 === selectedMonth && y === selectedYear;
  })();

  const deleteThisMonth = () =>
    run(async () => {
      if (!userId) throw new Error("Sessão expirada");
      if (isOriginalMonth) {
        // Move the base transaction forward so the balance trigger reverses its impact
        const orig = new Date(`${tx.date}T12:00:00`);
        const next = new Date(orig.getFullYear(), orig.getMonth() + 1, Math.min(orig.getDate(), 28));
        const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
        await updateTransaction(tx.id, { date: iso, status: "pendente" });
      } else {
        await excludeRecurringForMonth(tx.id, selectedMonth, selectedYear, userId);
      }
    }, "Removida deste mês");

  const deleteAll = () =>
    run(async () => {
      if (isRecurring && userId) {
        const [origY, origM] = tx.date.split("-").map(Number);
        const origIndex = origY * 12 + (origM - 1);
        if (origIndex >= selectedYear * 12 + selectedMonth) {
          await deleteTransaction(tx.id);
        } else {
          await excludeRecurringFromMonthOnward(tx.id, selectedMonth, selectedYear, userId);
        }
        return;
      }
      await deleteTransaction(tx.id);
    }, "Transação excluída");

  const statusChip = isPaid
    ? { label: isReceita ? "Recebido" : "Pago", cls: "bg-willo-green/12 text-willo-green", Icon: Check }
    : { label: "Pendente", cls: "bg-amber-300/12 text-amber-300", Icon: Clock };

  return (
    <BottomSheet open={open} onClose={close} size="full" zIndex={70}>
      <div className="px-5 pb-2">
        {/* Identity */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]"
              style={{ background: `${catHex}1F` }}
            >
              <CatIcon className="h-5 w-5" style={{ color: catHex }} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[18px] font-bold tracking-tight text-white">{tx.name}</p>
              <p className="flex items-center gap-1.5 truncate text-[12.5px] text-white/45">
                {isCard ? <CreditCard className="h-3.5 w-3.5 shrink-0" /> : <Wallet className="h-3.5 w-3.5 shrink-0" />}
                {accountName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/60 active:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <AmountHero cents={Math.round(tx.amount * 100)} isExpense={!isReceita} />

        <div className="mt-4 flex justify-center">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold", statusChip.cls)}>
            <statusChip.Icon className="h-3.5 w-3.5" strokeWidth={3} /> {statusChip.label}
          </span>
        </div>

        <RowGroup className="mt-6">
          <Row icon={Calendar} label="Data">
            <span className="truncate text-[15px] text-white">{longDate(tx.date)}</span>
          </Row>
          {tx.time && (
            <Row icon={Clock} label="Horário">
              <span className="text-[15px] text-white">{tx.time}</span>
            </Row>
          )}
          <Row icon={Tag} label="Categoria">
            <CatIcon className="h-4 w-4 shrink-0" style={{ color: catHex }} />
            <span className="truncate text-[15px] text-white">{tx.category}</span>
          </Row>
          <Row icon={isCard ? CreditCard : Wallet} label={isCard ? "Cartão" : "Conta"}>
            <span className="truncate text-[15px] text-white">{accountName}</span>
          </Row>
          {isInstallment && (
            <Row icon={Layers} label="Parcela">
              <span className="text-[15px] text-white tabular-nums">
                {tx.installment_current ?? 1} de {tx.installments}
              </span>
            </Row>
          )}
          {tx.recurrence_type && tx.recurrence_type !== "unica" && (
            <Row icon={Repeat} label="Repetição">
              <span className="text-[15px] text-white">{RECURRENCE_LABEL[tx.recurrence_type] ?? tx.recurrence_type}</span>
            </Row>
          )}
          {tx.observation && (
            <Row icon={FileText} label="Observação">
              <span className="truncate text-[15px] text-white/80">{tx.observation}</span>
            </Row>
          )}
        </RowGroup>

        {/* Actions */}
        {!confirmingDelete ? (
          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={togglePaid}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-bold text-[#0B0B0B] disabled:opacity-40"
            >
              {isPaid ? <Clock className="h-4 w-4" /> : <Check className="h-4 w-4" strokeWidth={3} />}
              {isPaid ? "Marcar como pendente" : isReceita ? "Marcar como recebida" : "Marcar como paga"}
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => { onEdit?.(tx); close(); }}
                className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] text-[14px] font-semibold text-white active:opacity-70"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex h-12 items-center justify-center gap-2 rounded-full border border-red-400/20 bg-red-400/[0.08] text-[14px] font-semibold text-red-400 active:opacity-70"
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
            </div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            <div className="flex items-start gap-3 rounded-[22px] border border-red-400/20 bg-red-400/[0.06] px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-[13px] leading-snug text-white/70">
                {isRecurring
                  ? "Essa transação se repete todo mês. Quer tirar só deste mês ou dela em diante?"
                  : isInstallment
                    ? `Isso remove a compra inteira, com as ${tx.installments} parcelas.`
                    : "Essa transação será excluída."}
              </p>
            </div>
            <div className="mt-3 space-y-2.5">
              {isRecurring && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={deleteThisMonth}
                  className="h-12 w-full rounded-full border border-white/[0.12] bg-white/[0.04] text-[14px] font-semibold text-white disabled:opacity-40"
                >
                  Só deste mês
                </button>
              )}
              <button
                type="button"
                disabled={loading}
                onClick={deleteAll}
                className="h-12 w-full rounded-full bg-red-500 text-[14px] font-bold text-white disabled:opacity-40"
              >
                {isRecurring ? "Deste mês em diante" : "Excluir"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="h-11 w-full rounded-full text-[14px] text-white/55"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </BottomSheet>
  );
};

export default TransactionDetailModal;
