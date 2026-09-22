import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronDown, CalendarClock, Check, Wallet, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryUtils";
import { buildActiveInstallmentItems, type ActiveInstallmentItem, type InstallmentInvoiceRow, type InstallmentTransactionRow } from "@/lib/installmentProgress";
import type { CustomCategory } from "@/services/categoryService";
import { useSwipeBack } from "@/hooks/useSwipeBack";

import { getCurrency } from "@/lib/currency";
const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });


const SCHEDULE_PREVIEW = 4;

const CARD_HEX: Record<string, string> = {
  violet: "#8B5CF6", emerald: "#10B981", sky: "#0EA5E9", amber: "#F59E0B", rose: "#F43F5E",
  cyan: "#06B6D4", fuchsia: "#D946EF", lime: "#84CC16", purple: "#8A05BE", orange: "#F97316",
};

const monthLabel = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "").replace(" de ", "/");

/** One installment purchase: segmented installment track, key numbers, and expandable schedule. */
function PurchaseCard({ item, index, customCats, card }: {
  item: ActiveInstallmentItem;
  index: number;
  customCats: CustomCategory[];
  card?: { name: string; color: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const paidCount = item.installment_current - 1;
  const remaining = item.installments - paidCount;
  const total = item.amount * item.installments;
  const IconComp = getCategoryIcon(item.category, customCats);
  const catColor = getCategoryColor(item.category, customCats);
  const isCard = item.payment_method === "cartao";
  const start = new Date(`${item.date.slice(0, 10)}T12:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + (item.installments - 1));
  const next = item.dueDate ? new Date(`${item.dueDate.slice(0, 10)}T12:00:00`) : null;
  const denseTrack = item.installments > 24;

  const schedule = Array.from({ length: item.installments }, (_, n) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + n);
    return { n: n + 1, date: d, status: n < paidCount ? "paga" : n === paidCount ? "atual" : "futura" };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`overflow-hidden rounded-[20px] border bg-[#141414] ${item.isOverdue ? "border-red-400/30" : "border-white/[0.07]"}`}
    >
      <button type="button" onClick={() => setOpen((v) => !v)} className="block w-full px-3.5 py-3 text-left">
        {/* Header */}
        <div className="flex items-center gap-3">
          {/* Icon wrapped by a ring that fills as installments are paid */}
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
              <motion.circle
                cx="24" cy="24" r="22" fill="none" stroke={`hsl(${catColor})`} strokeWidth="2.5" strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${2 * Math.PI * 22}` }}
                animate={{ strokeDasharray: `${Math.max(item.installment_current / item.installments, 0.04) * 2 * Math.PI * 22} ${2 * Math.PI * 22}` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </svg>
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#1E1E1E]">
              {IconComp && <IconComp className="h-[18px] w-[18px]" style={{ color: `hsl(${catColor})` }} />}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-white">{item.name}</p>
            <p className={`flex items-center gap-1.5 truncate text-[12px] ${item.isOverdue ? "text-red-400" : "text-white/45"}`}>
              {item.isOverdue ? (
                <AlertTriangle className="h-3 w-3 shrink-0" />
              ) : isCard ? (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CARD_HEX[card?.color ?? ""] ?? "#8B5CF6" }} />
              ) : (
                <Wallet className="h-3 w-3 shrink-0" />
              )}
              {item.isOverdue ? "Em atraso · " : ""}
              {isCard ? card?.name ?? "Cartão" : "Conta"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[15px] font-bold text-white tabular-nums">{formatCurrency(item.amount)}</p>
            <p className="text-[11px] text-white/40 tabular-nums">de {formatCurrency(total)}</p>
          </div>
        </div>

        {/* Installment track */}
        <div className="mt-2.5 flex items-baseline justify-between">
          <p className="text-[12px] text-white/55">
            Parcela <span className="font-semibold text-white">{item.installment_current}</span> de {item.installments}
          </p>
          <p className="text-[11px] text-white/40">
            {remaining} {remaining === 1 ? "restante" : "restantes"}
          </p>
        </div>
        {denseTrack ? (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-white" style={{ width: `${(paidCount / item.installments) * 100}%` }} />
          </div>
        ) : (
          <div className="mt-1.5 flex gap-[3px]">
            {schedule.map((s) => (
              <span
                key={s.n}
                className={`h-1.5 flex-1 rounded-full ${
                  s.status === "paga" ? "bg-white" : s.status === "atual" ? (item.isOverdue ? "bg-red-400" : "bg-willo-green") : "bg-white/[0.1]"
                }`}
              />
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between text-[11px] text-white/45 tabular-nums">
          <span>
            Falta {formatCurrency(item.amount * remaining)} · {next ? `próxima ${next.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : `até ${monthLabel(end)}`}
          </span>
          <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Schedule */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] px-3.5 pb-3 pt-3">
              <div className="relative">
                {/* Timeline rail */}
                <span className="absolute bottom-3 left-[9px] top-3 w-px bg-white/[0.08]" />
                {(showAll ? schedule : schedule.slice(paidCount, paidCount + SCHEDULE_PREVIEW)).map((s) => {
                  const isCurrent = s.status === "atual";
                  const isPaid = s.status === "paga";
                  const month = s.date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
                  return (
                    <div
                      key={s.n}
                      className={`relative flex items-center gap-3 rounded-[14px] py-2 pl-0 pr-2 ${isCurrent ? "bg-white/[0.05]" : ""}`}
                    >
                      <span
                        className={`relative z-10 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full ${
                          isPaid ? "bg-white text-[#0B0B0B]" : isCurrent ? (item.isOverdue ? "bg-red-400" : "bg-willo-green") : "border border-white/20 bg-[#141414]"
                        }`}
                      >
                        {isPaid && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className={`w-9 shrink-0 text-[12px] tabular-nums ${isPaid ? "text-white/35" : "text-white/55"}`}>{s.n}ª</span>
                      <span className={`min-w-0 flex-1 truncate whitespace-nowrap text-[14px] capitalize ${isPaid ? "text-white/40" : "text-white"}`}>
                        {month} {s.date.getFullYear()}
                      </span>
                      {isCurrent && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.isOverdue ? "bg-red-400/15 text-red-400" : "bg-willo-green/15 text-willo-green"}`}>
                          {item.isOverdue ? "Em atraso" : "Este mês"}
                        </span>
                      )}
                      <span className={`shrink-0 text-right text-[14px] tabular-nums ${isPaid ? "text-white/35 line-through" : "font-medium text-white"}`}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {schedule.length > SCHEDULE_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-2 flex h-9 w-full items-center justify-center gap-1 rounded-full bg-white/[0.05] text-[12px] font-medium text-white/70 active:opacity-70"
                >
                  {showAll ? "Mostrar menos" : `Ver todas as ${schedule.length} parcelas`}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const ParcelamentosDetalhe = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  useSwipeBack(true);
  const [items, setItems] = useState<ActiveInstallmentItem[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardsById, setCardsById] = useState<Record<string, { name: string; color: string | null }>>({});

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [transactionsRes, invoiceItemsRes, categoriesRes, creditCardsRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, name, category, amount, installment_current, installments, payment_method, date, credit_card_id, parent_transaction_id, status, type")
        .eq("user_id", user.id)
        .eq("recurrence_type", "parcelado")
        .eq("type", "despesa")
        .not("installments", "is", null),
      supabase
        .from("invoice_items")
        .select("transaction_id, amount, installment_number, total_installments, invoices!inner(is_paid, user_id, month, year), transactions!inner(id, name, category, payment_method, credit_card_id, parent_transaction_id, date, type)")
        .eq("invoices.user_id", user.id),
      supabase
        .from("custom_categories")
        .select("*")
        .eq("user_id", user.id),
      supabase
        .from("credit_cards")
        .select("id, due_day, name, color")
        .eq("user_id", user.id),
    ]);

    if (!transactionsRes.error && !invoiceItemsRes.error) {
      const creditCardDueDays = Object.fromEntries((creditCardsRes.data ?? []).map((card) => [card.id, card.due_day]));
      setCardsById(Object.fromEntries((creditCardsRes.data ?? []).map((card) => [card.id, { name: card.name, color: card.color }])));
      setItems(
        buildActiveInstallmentItems({
          transactions: (transactionsRes.data ?? []) as InstallmentTransactionRow[],
          invoiceItems: (invoiceItemsRes.data ?? []) as InstallmentInvoiceRow[],
          creditCardDueDays,
        })
      );
    }
    if (categoriesRes.data) setCustomCats(categoriesRes.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchData();
    const handler = () => { void fetchData(); };
    window.addEventListener("finance-data-changed", handler);
    return () => window.removeEventListener("finance-data-changed", handler);
  }, [user, fetchData]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // ── Computed stats ──
  const stats = useMemo(() => {
    if (items.length === 0) return null;

    let totalMensal = 0;
    let totalRestante = 0;
    let totalJaPago = 0;
    let totalGeral = 0;
    let lastEndDate = new Date();
    let cardCount = 0;
    let accountCount = 0;

    items.forEach((item) => {
      const paidCount = item.installment_current - 1;
      const unpaidCount = item.installments - paidCount;

      totalGeral += item.amount * item.installments;
      totalJaPago += item.amount * paidCount;

      if (unpaidCount > 0) {
        totalMensal += item.amount;
        totalRestante += item.amount * unpaidCount;
      }

      const baseDate = new Date(item.date);
      const endDate = new Date(baseDate);
      endDate.setMonth(baseDate.getMonth() + (item.installments - 1));
      if (endDate > lastEndDate) lastEndDate = endDate;

      if (item.payment_method === "cartao") cardCount++;
      else accountCount++;
    });

    const monthsUntilFree = (lastEndDate.getFullYear() - currentYear) * 12 + (lastEndDate.getMonth() - currentMonth);

    return {
      totalMensal, totalRestante, totalJaPago, totalGeral,
      monthsUntilFree: Math.max(monthsUntilFree, 0),
      lastEndDate, cardCount, accountCount,
    };
  }, [items, currentMonth, currentYear]);

  // ── Monthly projection chart data ──
  const projectionData = useMemo(() => {
    if (items.length === 0) return [];

    const months: {
      key: string;
      month: string;
      fullLabel: string;
      value: number;
      parts: { id: string; name: string; amount: number; color: string; number: number; total: number }[];
    }[] = [];

    for (let offset = 0; offset <= (stats?.monthsUntilFree ?? 12); offset++) {
      let m = currentMonth + offset;
      let y = currentYear;
      while (m > 11) { m -= 12; y++; }

      const parts: (typeof months)[number]["parts"] = [];
      items.forEach((item) => {
        const baseDate = new Date(item.date);
        const paidCount = item.installment_current - 1;
        const itemStartMonth = baseDate.getMonth() + paidCount;
        const itemStartYear = baseDate.getFullYear() + Math.floor(itemStartMonth / 12);
        const normalizedStartMonth = itemStartMonth % 12;
        const monthsDiff = (y - itemStartYear) * 12 + (m - normalizedStartMonth);
        const remainingInstallments = item.installments - paidCount;
        if (monthsDiff >= 0 && monthsDiff < remainingInstallments) {
          parts.push({
            id: item.id,
            name: item.name,
            amount: item.amount,
            color: `hsl(${getCategoryColor(item.category, customCats)})`,
            number: item.installment_current + monthsDiff,
            total: item.installments,
          });
        }
      });

      const date = new Date(y, m);
      months.push({
        key: `${y}-${m}`,
        month: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        fullLabel: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        value: parts.reduce((sum, part) => sum + part.amount, 0),
        parts: parts.sort((pa, pb) => pb.amount - pa.amount),
      });
    }

    return months;
  }, [items, stats, currentMonth, currentYear, customCats]);

  // ── Category breakdown ──
  const categoryData = useMemo(() => {
    if (items.length === 0) return [];

    const catMap = new Map<string, number>();
    items.forEach((item) => {
      catMap.set(item.category, (catMap.get(item.category) ?? 0) + item.amount);
    });

    return Array.from(catMap.entries())
      .map(([cat, amount]) => ({ category: cat, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [items]);

  const [methodFilter, setMethodFilter] = useState<"todos" | "cartao" | "conta">("todos");
  const visibleItems = useMemo(
    () => (methodFilter === "todos" ? items : items.filter((i) => (methodFilter === "cartao" ? i.payment_method === "cartao" : i.payment_method !== "cartao"))),
    [items, methodFilter],
  );
  const maxProjection = Math.max(...projectionData.map((p) => p.value), 1);

  const BackButton = (
    <button onClick={() => navigate(-1)} aria-label="Voltar" className="-ml-2 flex h-10 items-center text-white/70 active:opacity-60">
      <ChevronLeft className="h-7 w-7" strokeWidth={2.25} />
    </button>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-28">
        {BackButton}
        <div className="h-40 animate-pulse rounded-[24px] bg-[#141414]" />
        <div className="h-56 animate-pulse rounded-[24px] bg-[#141414]" />
      </div>
    );
  }

  if (items.length === 0 || !stats) {
    return (
      <div className="mx-auto max-w-lg pb-28">
        {BackButton}
        <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-white">Parcelamentos</h1>
        <div className="mt-8 flex flex-col items-center px-8 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05]">
            <CalendarClock className="h-8 w-8 text-white/40" />
          </span>
          <p className="mt-5 text-[18px] font-bold text-white">Nenhum parcelamento ativo</p>
          <p className="mt-1 text-[14px] text-white/45">Compras parceladas aparecem aqui com o progresso de cada uma.</p>
        </div>
      </div>
    );
  }

  const paidPct = stats.totalGeral > 0 ? (stats.totalJaPago / stats.totalGeral) * 100 : 0;

  return (
    <div className="mx-auto max-w-lg select-none pb-28">
      {BackButton}

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
        <h1 className="text-[28px] font-extrabold tracking-tight text-white">Parcelamentos</h1>
        <p className="text-[14px] text-white/45">
          {items.length} {items.length === 1 ? "compra parcelada" : "compras parceladas"} · cartão e conta
        </p>

        <p className="mt-6 text-[15px] text-white/50">Comprometido por mês</p>
        <p className="text-[38px] font-extrabold leading-tight tracking-tight text-white tabular-nums">{formatCurrency(stats.totalMensal)}</p>
        <p className="text-[14px] text-white/50">
          {stats.monthsUntilFree > 0
            ? `Livre em ${stats.monthsUntilFree} ${stats.monthsUntilFree === 1 ? "mês" : "meses"} · ${stats.lastEndDate.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}`
            : "Última parcela este mês"}
        </p>
      </motion.div>

      {/* Paid vs remaining */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-6 rounded-[24px] border border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4"
      >
        <div className="flex items-baseline justify-between">
          <p className="text-[14px] text-white/60">Progresso geral</p>
          <p className="text-[14px] font-semibold text-white tabular-nums">{Math.round(paidPct)}% pago</p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="h-full rounded-full bg-white"
            initial={{ width: 0 }}
            animate={{ width: `${paidPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 border-t border-white/[0.08] pt-3.5">
          <div className="pr-3">
            <p className="text-[12px] text-white/45">Já pago</p>
            <p className="text-[17px] font-bold text-white tabular-nums">{formatCurrency(stats.totalJaPago)}</p>
          </div>
          <div className="border-l border-white/[0.08] pl-4">
            <p className="text-[12px] text-white/45">Falta pagar</p>
            <p className="text-[17px] font-bold text-white tabular-nums">{formatCurrency(stats.totalRestante)}</p>
          </div>
        </div>
      </motion.div>

      {/* Monthly commitment */}
      {projectionData.length > 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-3 rounded-[24px] border border-white/[0.07] bg-[#141414] p-4">
          <p className="text-[16px] font-semibold text-white">Próximos meses</p>
          <p className="text-[12px] text-white/40">O valor cai conforme as parcelas terminam</p>
          <div className="-mx-4 mt-4 overflow-x-auto px-4 scrollbar-hide">
            <div className="flex items-end gap-2.5" style={{ minWidth: projectionData.length * 52 }}>
              {projectionData.map((p, i) => (
                <div key={p.key} className="flex w-[44px] shrink-0 flex-col items-center">
                  <span className={`mb-1.5 text-[10px] tabular-nums ${i === 0 ? "text-white" : "text-white/40"}`}>
                    {p.value >= 1000 ? `${(p.value / 1000).toFixed(1)}k` : p.value.toFixed(0)}
                  </span>
                  <div className="flex h-[110px] items-end">
                    <motion.span
                      className={`block w-8 rounded-full ${i === 0 ? "bg-white" : "bg-white/25"}`}
                      initial={{ height: 0 }}
                      animate={{ height: Math.max((p.value / maxProjection) * 110, p.value > 0 ? 8 : 3) }}
                      transition={{ delay: i * 0.03, duration: 0.45, ease: "easeOut" }}
                    />
                  </div>
                  <span className={`mt-2 text-[12px] capitalize ${i === 0 ? "font-semibold text-white" : "text-white/45"}`}>{p.month}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Category breakdown */}
      {categoryData.length > 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-3 rounded-[24px] border border-white/[0.07] bg-[#141414] p-4">
          <p className="text-[16px] font-semibold text-white">Por categoria</p>
          <div className="mt-3 flex h-2.5 gap-1 overflow-hidden rounded-full">
            {categoryData.map((cat) => (
              <span
                key={cat.category}
                className="h-full rounded-full"
                style={{ width: `${(cat.amount / stats.totalMensal) * 100}%`, background: `hsl(${getCategoryColor(cat.category, customCats)})` }}
              />
            ))}
          </div>
          <div className="mt-3 space-y-2.5">
            {categoryData.map((cat) => {
              const IconComp = getCategoryIcon(cat.category, customCats);
              const catColor = getCategoryColor(cat.category, customCats);
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `hsl(${catColor} / 0.14)` }}>
                    {IconComp && <IconComp className="h-4 w-4" style={{ color: `hsl(${catColor})` }} />}
                  </span>
                  <span className="flex-1 truncate text-[14px] text-white">{cat.category}</span>
                  <span className="text-[13px] text-white/45 tabular-nums">{Math.round((cat.amount / stats.totalMensal) * 100)}%</span>
                  <span className="w-[92px] text-right text-[14px] font-semibold text-white tabular-nums">{formatCurrency(cat.amount)}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* List */}
      <div className="mt-7 flex items-center justify-between px-1">
        <p className="text-[18px] font-bold text-white">Compras</p>
        <div className="flex rounded-full border border-white/[0.07] bg-[#141414] p-0.5">
          {([["todos", "Todos"], ["cartao", "Cartão"], ["conta", "Conta"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setMethodFilter(key)} className="relative h-8 rounded-full px-3 text-[12px] font-semibold">
              {methodFilter === key && (
                <motion.span layoutId="parcelas-filter" className="absolute inset-0 z-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <span className={`relative z-10 ${methodFilter === key ? "text-[#0B0B0B]" : "text-white/55"}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {visibleItems.length === 0 && <p className="py-6 text-center text-[14px] text-white/40">Nenhuma compra neste filtro</p>}
        {visibleItems.map((item, i) => (
          <PurchaseCard
            key={item.id}
            item={item}
            index={i}
            customCats={customCats}
            card={item.credit_card_id ? cardsById[item.credit_card_id] : undefined}
          />
        ))}
      </div>
    </div>
  );
};

export default ParcelamentosDetalhe;
