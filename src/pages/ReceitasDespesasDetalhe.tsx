import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Clock, ChevronDown, ChevronUp, CreditCard, TrendingUp, TrendingDown,
  Wallet, Receipt,
} from "lucide-react";
import { useMonth } from "@/contexts/MonthContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryUtils";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import {
  loadMonthlyHistory,
  loadTypeDetail,
  trendBetween,
  type TypeDetailInvoice as InvoiceRow,
  type TypeDetailTransaction as TxRow,
} from "@/services/typeDetail";
import { getTransactionById, getAccounts } from "@/services/transactionService";
import TransactionDetailModal from "@/components/dashboard/TransactionDetailModal";
import NovaTransacaoModal, { type EditTransactionData } from "@/components/dashboard/NovaTransacaoModal";
import { PageHeader, SectionTitle, Surface } from "@/components/shared/MobilePage";
import { cn } from "@/lib/utils";

import { currencySymbol, getCurrency } from "@/lib/currency";
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
const compact = (v: number) => `${currencySymbol()} ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const ReceitasDespesasDetalhe = () => {
  const { tipo } = useParams<{ tipo: string }>();
  const isReceita = tipo === "receitas";
  const typeFilter = isReceita ? "receita" : "despesa";
  const navigate = useNavigate();
  const { selectedMonth, selectedYear } = useMonth();
  const { user } = useAuth();
  const { data, refetch } = useFinanceData(selectedMonth, selectedYear, { includeHistorical: false });
  useSwipeBack();

  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [historyData, setHistoryData] = useState<{ month: string; value: number }[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [detailTx, setDetailTx] = useState<any>(null);
  const [detailAccountName, setDetailAccountName] = useState("");
  const [editingTx, setEditingTx] = useState<EditTransactionData | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      const [detail, cats] = await Promise.all([
        loadTypeDetail({ userId: user.id, month: selectedMonth, year: selectedYear, isReceita }),
        getCustomCategories(),
      ]);
      if (!alive) return;
      setTransactions(detail.transactions);
      setInvoices(detail.invoices);
      setCustomCats(cats);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user, selectedMonth, selectedYear, isReceita]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const months = await loadMonthlyHistory({
        userId: user.id,
        isReceita,
        month: selectedMonth,
        year: selectedYear,
      });
      if (alive) setHistoryData(months.map((m) => ({ month: MONTH_SHORT[m.month], value: m.value })));
    })();
    return () => {
      alive = false;
    };
  }, [user, selectedMonth, selectedYear, isReceita]);

  const total = isReceita ? data.receitas : data.despesas;
  const paid = isReceita ? data.receitasRecebidas : data.despesasPagas;
  const pending = isReceita ? data.receitasPendentes : data.despesasPendentes;
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;

  const trend = useMemo(
    () => trendBetween(historyData, user?.created_at, selectedMonth, selectedYear),
    [historyData, user, selectedMonth, selectedYear],
  );

  type ListItem = { kind: "tx"; tx: TxRow } | { kind: "invoice"; inv: InvoiceRow };

  const allPending = useMemo<ListItem[]>(() => {
    const items: ListItem[] = transactions.filter((t) => t.status !== "pago").map((tx) => ({ kind: "tx" as const, tx }));
    if (!isReceita) invoices.filter((inv) => !inv.is_paid).forEach((inv) => items.push({ kind: "invoice" as const, inv }));
    return items;
  }, [transactions, invoices, isReceita]);

  const allPaid = useMemo<ListItem[]>(() => {
    const items: ListItem[] = transactions.filter((t) => t.status === "pago").map((tx) => ({ kind: "tx" as const, tx }));
    if (!isReceita) invoices.filter((inv) => inv.is_paid).forEach((inv) => items.push({ kind: "invoice" as const, inv }));
    return items;
  }, [transactions, invoices, isReceita]);

  const handleTxClick = useCallback(async (tx: TxRow) => {
    try {
      const [fullTx, accounts] = await Promise.all([getTransactionById(tx.id), getAccounts()]);
      if (fullTx) {
        const acct = (accounts as any[]).find((a: any) => a.id === fullTx.account_id);
        setDetailAccountName(acct?.name || "");
        setDetailTx(fullTx);
        setShowDetail(true);
      }
    } catch {}
  }, []);

  const accentHex = isReceita ? "#C8F36D" : "#F87171";
  const monthLabel = MONTH_NAMES[selectedMonth];
  const displayPending = showAll ? allPending : allPending.slice(0, 5);
  const displayPaid = showAll ? allPaid : allPaid.slice(0, 5);
  const hasMore = allPending.length > 5 || allPaid.length > 5;
  const trendPositive = isReceita ? trend > 0 : trend < 0;
  const HeroIcon = isReceita ? Wallet : Receipt;
  const maxHistory = Math.max(...historyData.map((h) => h.value), 1);

  return (
    <div className="mx-auto max-w-lg pb-28">
      <PageHeader />

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-5 overflow-hidden rounded-[28px] border border-white/[0.08] p-5"
        style={{
          background: `radial-gradient(120% 90% at 100% 0%, ${accentHex}1C 0%, rgba(20,20,20,0.96) 55%, #0E0E0E 100%)`,
        }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `${accentHex}22` }}>
            <HeroIcon className="h-[18px] w-[18px]" style={{ color: accentHex }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-white/70">Total {isReceita ? "de receitas" : "de despesas"}</p>
            <p className="truncate text-[30px] font-extrabold leading-tight tracking-tight tabular-nums text-white">{fmt(total)}</p>
          </div>
          {trend !== 0 && (
            <span className={cn("flex shrink-0 items-center gap-1 rounded-full bg-white/[0.08] px-2.5 py-1.5 text-[12px] font-semibold tabular-nums", trendPositive ? "text-willo-green-ink" : "text-red-400")}>
              {trendPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {trend > 0 ? "+" : ""}{trend}%
            </span>
          )}
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: accentHex }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(paidPct, 100)}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>

        <div className="mt-3 flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[13px] text-white/74">
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: accentHex }} />
            {isReceita ? "Recebido" : "Pago"} <span className="font-semibold text-white tabular-nums">{fmt(paid)}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-white/74">
            <Clock className="h-3.5 w-3.5 text-willo-amber" />
            Pendente <span className="font-semibold text-white tabular-nums">{fmt(pending)}</span>
          </span>
        </div>
      </motion.section>

      {/* Evolution chart */}
      {historyData.length > 0 && (
        <>
          <SectionTitle>Evolução mensal</SectionTitle>
          <Surface className="p-4">
            <div className="flex items-end justify-center gap-3">
              {historyData.map((h, i) => {
                const isCurrent = i === historyData.length - 1;
                const barH = Math.max((h.value / maxHistory) * 84, 6);
                return (
                  <div key={h.month} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className={cn("whitespace-nowrap text-[10px] font-bold tabular-nums", isCurrent ? "text-white" : "t-soft")}>
                      {h.value > 0 ? compact(h.value) : "—"}
                    </span>
                    <motion.div
                      className="w-full max-w-[28px] rounded-[8px]"
                      style={{ background: isCurrent ? accentHex : `${accentHex}44` }}
                      initial={{ height: 0 }}
                      animate={{ height: barH }}
                      transition={{ delay: i * 0.03, duration: 0.5, ease: "easeOut" }}
                    />
                    <span className={cn("text-[11px]", isCurrent ? "font-semibold text-white" : "t-soft")}>{h.month}</span>
                  </div>
                );
              })}
            </div>
          </Surface>
        </>
      )}

      {/* Pending list */}
      {allPending.length > 0 && (
        <>
          <SectionTitle action={<span className="text-[12px] font-bold tabular-nums text-amber-300/70">{allPending.length}</span>}>
            {isReceita ? "A receber" : "Pendentes"}
          </SectionTitle>
          <Surface className="divide-y divide-white/[0.06] px-3">
            <AnimatePresence mode="popLayout">
              {displayPending.map((item, i) =>
                item.kind === "tx" ? (
                  <TxRowItem key={item.tx.id} tx={item.tx} isReceita={isReceita} customCats={customCats} onClick={() => handleTxClick(item.tx)} idx={i} />
                ) : (
                  <InvoiceRowItem key={item.inv.id} inv={item.inv} isPending onClick={() => navigate(`/fatura/${item.inv.credit_card_id}`)} idx={i} />
                )
              )}
            </AnimatePresence>
          </Surface>
        </>
      )}

      {/* Paid list */}
      {allPaid.length > 0 && (
        <>
          <SectionTitle action={<span className="text-[12px] font-bold tabular-nums" style={{ color: `${accentHex}B0` }}>{allPaid.length}</span>}>
            {isReceita ? "Recebidas" : "Pagas"}
          </SectionTitle>
          <Surface className="divide-y divide-white/[0.06] px-3">
            <AnimatePresence mode="popLayout">
              {displayPaid.map((item, i) =>
                item.kind === "tx" ? (
                  <TxRowItem key={item.tx.id} tx={item.tx} isReceita={isReceita} customCats={customCats} onClick={() => handleTxClick(item.tx)} idx={i} />
                ) : (
                  <InvoiceRowItem key={item.inv.id} inv={item.inv} isPending={false} onClick={() => navigate(`/fatura/${item.inv.credit_card_id}`)} idx={i} />
                )
              )}
            </AnimatePresence>
          </Surface>
        </>
      )}

      {hasMore && (
        <button onClick={() => setShowAll(!showAll)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-white/[0.06] py-3 text-[13px] font-semibold text-white active:opacity-70">
          {showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showAll ? "Ver menos" : "Ver todos"}
        </button>
      )}

      {loading && transactions.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <span className="animate-pulse text-[14px] font-medium text-white/66">Carregando...</span>
        </div>
      )}

      <TransactionDetailModal
        open={showDetail} tx={detailTx} accountName={detailAccountName}
        onClose={() => { setShowDetail(false); setDetailTx(null); }}
        onRefresh={() => { setShowDetail(false); setDetailTx(null); refetch(); }}
        userId={user?.id} selectedMonth={selectedMonth} selectedYear={selectedYear}
        onEdit={(t) => setEditingTx({
          id: t.id,
          name: t.name,
          type: t.type as "receita" | "despesa",
          amount: Number(t.amount),
          category: t.category,
          date: t.date,
          status: t.status as "pago" | "pendente",
          payment_method: t.payment_method as "conta" | "cartao",
          account_id: t.account_id,
          credit_card_id: t.credit_card_id,
          recurrence_type: t.recurrence_type as "unica" | "parcelado" | "fixa",
          installments: t.installments,
          installment_current: t.installment_current,
          observation: t.observation,
        })}
      />

      <NovaTransacaoModal
        open={!!editingTx}
        onClose={() => setEditingTx(null)}
        onSuccess={() => { setEditingTx(null); refetch(); }}
        initialType={editingTx?.type ?? "despesa"}
        editTransaction={editingTx}
      />
    </div>
  );
};

/* ─── Transaction Row ─── */
const TxRowItem = ({
  tx, isReceita, customCats, onClick, idx,
}: { tx: TxRow; isReceita: boolean; customCats: CustomCategory[]; onClick: () => void; idx: number }) => {
  const isPending = tx.status !== "pago";
  const color = getCategoryColor(tx.category, customCats);
  const Icon = getCategoryIcon(tx.category, customCats);
  const dateFormatted = new Date(tx.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  const statusColor = isPending ? "#FCD34D" : isReceita ? "#C8F36D" : "#F87171";

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ delay: idx * 0.02, type: "spring", stiffness: 400, damping: 30 }}
      onClick={onClick}
      className="flex w-full items-center gap-3 py-3 text-left active:opacity-70"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `hsl(${color} / 0.15)` }}>
        <Icon className="h-[18px] w-[18px]" style={{ color: `hsl(${color})` }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold text-white">{tx.name}</p>
        <p className="truncate text-[12px] t-soft">{tx.category} · {dateFormatted}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[14px] font-bold tabular-nums" style={{ color: statusColor }}>
          {isReceita ? "+" : "−"}{fmt(tx.amount)}
        </p>
        <span className="block text-[10.5px] font-medium" style={{ color: statusColor, opacity: 0.65 }}>
          {isPending ? (isReceita ? "A receber" : "Pendente") : (isReceita ? "Recebido" : "Pago")}
        </span>
      </div>
    </motion.button>
  );
};

/* ─── Invoice Row ─── */
const InvoiceRowItem = ({
  inv, isPending, onClick, idx,
}: { inv: InvoiceRow; isPending: boolean; onClick: () => void; idx: number }) => {
  const statusColor = isPending ? "#FCD34D" : "#F87171";
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ delay: idx * 0.02, type: "spring", stiffness: 400, damping: 30 }}
      onClick={onClick}
      className="flex w-full items-center gap-3 py-3 text-left active:opacity-70"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: inv.card_color ? `${inv.card_color}22` : "rgba(255,255,255,0.06)" }}>
        <CreditCard className="h-[18px] w-[18px]" style={{ color: inv.card_color || "rgba(255,255,255,0.5)" }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold text-white">Fatura {inv.card_name}</p>
        <p className="truncate text-[12px] t-soft">{MONTH_SHORT[inv.month - 1]}/{inv.year}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[14px] font-bold tabular-nums" style={{ color: statusColor }}>−{fmt(inv.total_amount)}</p>
        <span className="block text-[10.5px] font-medium" style={{ color: statusColor, opacity: 0.65 }}>
          {isPending ? "Pendente" : "Paga"}
        </span>
      </div>
    </motion.button>
  );
};

export default ReceitasDespesasDetalhe;
