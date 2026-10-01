import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarClock, CalendarCheck, CreditCard, ChevronRight, Wallet, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getInvoices, getInvoiceItems, getInvoicePayments, payInvoice, type InvoicePayment } from "@/services/invoiceService";
import { getAccounts } from "@/services/transactionService";
import { cn } from "@/lib/utils";
import InvoicePayModal, { type PaymentDetails } from "@/components/fatura/InvoicePayModal";

import { getCurrency } from "@/lib/currency";
interface FaturaCardInfo {
  cardId: string;
  cardName: string;
  closingDay: number;
  dueDay: number;
  color: string | null;
  lastFourDigits: string | null;
}

interface AccountInfo {
  id: string;
  name: string;
  is_default: boolean;
  current_balance: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  card: FaturaCardInfo | null;
  month: number;
  year: number;
  totalAmount: number;
  isPaid: boolean;
  onPaid?: () => void;
}

interface RecentItem {
  id: string;
  name: string;
  amount: number;
  category: string;
  installment?: string;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function FaturaDetailModal({ open, onClose, card, month, year, totalAmount, isPaid, onPaid }: Props) {
  const navigate = useNavigate();
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [payAccountId, setPayAccountId] = useState("");
  const [paying, setPaying] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  const [paidAmount, setPaidAmount] = useState(0);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([]);
  const [resolvedTotalAmount, setResolvedTotalAmount] = useState(totalAmount);
  const [resolvedIsPaid, setResolvedIsPaid] = useState(isPaid);

  useEffect(() => {
    if (!open || !card) return;
    setLoadingItems(true);
    setResolvedTotalAmount(totalAmount);
    setResolvedIsPaid(isPaid);
    (async () => {
      try {
        const invoices = await getInvoices(card.cardId, month + 1, year);
        if (invoices.length > 0) {
          const inv = invoices[0];
          const invoiceTotal = Number(inv.total_amount ?? 0);
          const invoicePaid = Number(inv.paid_amount ?? 0);
          const outstanding = Math.max(0, invoiceTotal - invoicePaid);
          setInvoiceId(inv.id);
          setPaidAmount(invoicePaid);
          setResolvedTotalAmount(outstanding > 0 ? outstanding : invoiceTotal);
          setResolvedIsPaid(Boolean(inv.is_paid) && outstanding <= 0);
          const [items, pmts] = await Promise.all([
            getInvoiceItems(inv.id),
            getInvoicePayments(inv.id),
          ]);
          setInvoicePayments(pmts);
          const mapped = items.slice(0, 5).map((item: any) => ({
            id: item.id,
            name: item.transaction_name || "Transação",
            amount: Number(item.amount),
            category: item.transaction_category || "Outros",
            installment: item.total_installments > 1
              ? `${item.installment_number}/${item.total_installments}`
              : undefined,
          }));
          setRecentItems(mapped);
        } else {
          setRecentItems([]);
          setInvoiceId(null);
          setPaidAmount(0);
          setInvoicePayments([]);
          setResolvedTotalAmount(totalAmount);
          setResolvedIsPaid(isPaid);
        }
      } catch {
        setRecentItems([]);
      } finally {
        setLoadingItems(false);
      }
    })();
  }, [open, card, month, year, totalAmount, isPaid]);

  // Load accounts when pay modal opens
  useEffect(() => {
    if (!showPayModal) return;
    getAccounts().then((accs) => {
      const typed = accs as unknown as AccountInfo[];
      setAccounts(typed);
      const defaultAcc = typed.find((a) => a.is_default);
      if (defaultAcc) setPayAccountId(defaultAcc.id);
    });
  }, [showPayModal]);

  if (!open || !card) return null;

  const cardColor = card.color || "hsl(260 60% 55%)";

  const dueDate = new Date(year, month, card.dueDay);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let dueText = "";
  let dueUrgent = false;
  if (resolvedIsPaid) {
    dueText = "Fatura paga";
  } else if (diffDays < 0) {
    dueText = `Venceu há ${Math.abs(diffDays)} dias`;
    dueUrgent = true;
  } else if (diffDays === 0) {
    dueText = "Vence hoje!";
    dueUrgent = true;
  } else {
    dueText = `Vence em ${diffDays} dias`;
  }

  const handleViewFull = () => {
    onClose();
    navigate(`/fatura/${card.cardId}?month=${month + 1}&year=${year}`);
  };

  const handlePayConfirm = async (details: PaymentDetails) => {
    if (!invoiceId || !payAccountId) return;
    setPaying(true);
    try {
      await payInvoice(invoiceId, payAccountId, {
        mode: details.mode,
        amount_paid: details.amountPaid,
        installments: details.installments,
        entry_amount: details.entryAmount,
      });
      const modeLabel = details.mode === "total" ? "integralmente" : details.mode === "minimo" ? "parcialmente" : "parcelada";
      toast.success(`Fatura paga ${modeLabel}! ✅`);
      setShowPayModal(false);
      onPaid?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao pagar fatura");
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center px-5"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-white/[0.12] willo-glass shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
          >
            <span
              className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full blur-[70px]"
              style={{ background: cardColor, opacity: 0.28 }}
            />

            <div className="relative px-5 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px]"
                    style={{ background: `${cardColor}26` }}
                  >
                    <CreditCard className="h-5 w-5" style={{ color: cardColor }} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-bold tracking-tight text-white">{card.cardName}</p>
                    {card.lastFourDigits && (
                      <p className="text-[12px] tabular-nums text-white/56">•••• {card.lastFourDigits}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fechar"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/74 active:opacity-60"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="relative mt-5 text-[12px] text-white/62">Fatura de {MONTH_NAMES[month]}</p>
              <p className="text-[34px] font-extrabold leading-none tracking-tighter text-white tabular-nums">
                {fmt(resolvedTotalAmount)}
              </p>
              <p
                className={cn(
                  "mt-1.5 flex items-center gap-1.5 text-[13px]",
                  resolvedIsPaid ? "font-medium text-willo-green" : dueUrgent ? "text-red-400" : "text-white/62",
                )}
              >
                {resolvedIsPaid && <CheckCircle2 className="h-3.5 w-3.5" />}
                {dueText}
              </p>

              <div className="mt-4 flex items-center gap-4 border-t border-white/[0.06] pt-4">
                <span className="flex items-center gap-2 text-[12.5px] text-white/66">
                  <CalendarClock className="h-4 w-4 shrink-0 text-white/50" />
                  Fecha dia <span className="font-semibold text-white">{card.closingDay}</span>
                </span>
                <span className="h-3 w-px bg-white/10" />
                <span className="flex items-center gap-2 text-[12.5px] text-white/66">
                  <CalendarCheck className="h-4 w-4 shrink-0 text-white/50" />
                  Vence dia <span className="font-semibold text-white">{card.dueDay}</span>
                </span>
              </div>
            </div>

            <div className="relative mt-4 px-5">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-white/50">Lançamentos recentes</p>
              {loadingItems ? (
                <p className="py-5 text-center text-[13px] text-white/50">Carregando…</p>
              ) : recentItems.length === 0 && invoicePayments.length === 0 ? (
                <p className="py-5 text-center text-[13px] text-white/50">Nenhum lançamento neste mês</p>
              ) : (
                <div className="mt-2.5 divide-y divide-white/[0.05] rounded-[18px] border border-white/[0.06] bg-white/[0.02]">
                  {!resolvedIsPaid && invoicePayments.map((payment) => (
                    <div key={payment.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-willo-green/12">
                        <Wallet className="h-4 w-4 text-willo-green" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] text-white">Pagamento</span>
                        <span className="block text-[11.5px] text-white/56">
                          {new Date(payment.paid_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13.5px] font-semibold text-willo-green tabular-nums">
                        +{fmt(Number(payment.amount))}
                      </span>
                    </div>
                  ))}
                  {recentItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                        <CreditCard className="h-4 w-4 text-white/62" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] text-white">{item.name}</span>
                        <span className="block truncate text-[11.5px] text-white/56">
                          {item.category}
                          {item.installment && <span className="ml-1.5 text-white/74">{item.installment}</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13.5px] font-semibold text-white tabular-nums">
                        {fmt(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative space-y-2.5 p-5">
              {!resolvedIsPaid && resolvedTotalAmount > 0 && (
                <button
                  onClick={() => setShowPayModal(true)}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-[#0B0B0B] active:opacity-80"
                >
                  <Wallet className="h-4 w-4" />
                  Pagar fatura
                </button>
              )}
              <button
                onClick={handleViewFull}
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] text-[14px] font-semibold text-white active:opacity-70"
              >
                Ver fatura completa
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Pay Modal */}
      <InvoicePayModal
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        total={resolvedTotalAmount}
        accounts={accounts}
        payAccountId={payAccountId}
        setPayAccountId={setPayAccountId}
        onConfirm={handlePayConfirm}
        paying={paying}
      />
    </>
  );
}
