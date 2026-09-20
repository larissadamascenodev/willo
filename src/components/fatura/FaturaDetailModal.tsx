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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-4 mb-20 sm:mb-0 rounded-2xl bg-card border border-border/20 shadow-2xl overflow-hidden"
          >
            {/* Header with card color accent */}
            <div className="relative p-5 pb-4">
              <div
                className="absolute inset-0 opacity-[0.08] pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at 30% -20%, ${cardColor} 0%, transparent 60%)`,
                }}
              />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-9 h-6 rounded-md shadow-lg" style={{ backgroundColor: cardColor }} />
                      <div className="absolute inset-0 rounded-md bg-gradient-to-br from-white/20 to-transparent" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-foreground">{card.cardName}</h2>
                      {card.lastFourDigits && (
                        <span className="text-[10px] text-muted-foreground tracking-wider">•••• {card.lastFourDigits}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-center space-y-1 pb-1">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Fatura de {MONTH_NAMES[month]}
                  </p>
                  <p className="text-2xl font-extrabold text-foreground tracking-tight">
                    {fmt(resolvedTotalAmount)}
                  </p>
                  {resolvedIsPaid ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {dueText}
                    </span>
                  ) : (
                    <span className={cn(
                      "text-[10px] font-semibold",
                      dueUrgent ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {dueText}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Dates row */}
            <div className="px-5 pb-4 flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/20 px-3 py-2 rounded-lg flex-1 justify-center">
                <CalendarClock className="w-3.5 h-3.5 text-primary/60" />
                <span>Fecha dia <span className="font-semibold text-foreground">{card.closingDay}</span></span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/20 px-3 py-2 rounded-lg flex-1 justify-center">
                <CalendarCheck className="w-3.5 h-3.5 text-primary/60" />
                <span>Vence dia <span className="font-semibold text-foreground">{card.dueDay}</span></span>
              </div>
            </div>

            {/* Recent transactions */}
            <div className="px-5 pb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Lançamentos recentes
              </p>
              {loadingItems ? (
                <div className="py-4 text-center">
                  <span className="text-xs text-muted-foreground animate-pulse">Carregando...</span>
                </div>
              ) : recentItems.length === 0 ? (
                <div className="py-4 text-center">
                  <span className="text-xs text-muted-foreground">Nenhum lançamento neste mês</span>
                </div>
              ) : (
                <div className="space-y-1">
                   {/* Individual payment entries — at top */}
                  {!resolvedIsPaid && invoicePayments.map((payment) => (
                    <div key={payment.id} className="flex items-center gap-2.5 py-2 border-b border-border/10 mb-1 pb-3">
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                        <Wallet className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-foreground">Pagamento parcial</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(payment.paid_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                      <span className="text-[12px] font-bold text-primary shrink-0">
                        +{fmt(Number(payment.amount))}
                      </span>
                    </div>
                  ))}
                  {recentItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2.5 py-2">
                      <div className="w-7 h-7 rounded-full bg-muted/20 flex items-center justify-center">
                        <CreditCard className="w-3.5 h-3.5 text-muted-foreground/50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-foreground truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.category}
                          {item.installment && (
                            <span className="ml-1 text-primary font-bold">{item.installment}</span>
                          )}
                        </p>
                      </div>
                      <span className="text-[12px] font-bold text-destructive shrink-0">
                        −{fmt(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="px-5 pb-5 pt-2 space-y-2">
              {!resolvedIsPaid && resolvedTotalAmount > 0 && (
                <button
                  onClick={() => setShowPayModal(true)}
                  className="w-full h-11 rounded-xl text-xs font-bold gap-1.5 inline-flex items-center justify-center bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors backdrop-blur-sm"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Pagar fatura
                </button>
              )}
              <button
                onClick={handleViewFull}
                className={cn(
                  "w-full h-11 rounded-xl text-xs font-bold gap-1.5 inline-flex items-center justify-center transition-colors backdrop-blur-sm",
                  resolvedIsPaid || resolvedTotalAmount <= 0
                    ? "bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25"
                    : "bg-muted/20 text-muted-foreground border border-border/20 hover:bg-muted/30"
                )}
              >
                Ver fatura completa
                <ChevronRight className="w-3.5 h-3.5" />
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
