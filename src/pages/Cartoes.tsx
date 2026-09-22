import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ChevronLeft, Clock, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import BottomSheet from "@/components/shared/BottomSheet";
import { getCategoryIcon, getCategoryHexColor } from "@/lib/categoryUtils";
import {
  useCardsOverview, cardHex, invoiceDueDate, monthKey,
  type OverviewCard, type OverviewInstallment, type OverviewInvoice,
} from "@/hooks/useCardsOverview";

import { getCurrency } from "@/lib/currency";
type Tab = "faturas" | "parcelas" | "limites";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

interface MonthSlot { key: number; year: number; month: number; label: string }

function monthSlots(fromOffset: number, count: number): MonthSlot[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + fromOffset + i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return { key: monthKey(year, month), year, month, label: `${SHORT[month - 1]}${year !== now.getFullYear() ? `/${String(year).slice(2)}` : ""}` };
  });
}

const keyLabel = (key: number) => {
  const year = Math.floor(key / 12);
  const month = key % 12;
  return `${SHORT[month].charAt(0)}${SHORT[month].slice(1).toLowerCase()}/${String(year).slice(2)}`;
};

// ── Month bar strip (faturas) ────────────────────────────
function MonthBars({ slots, values, selected, onSelect }: {
  slots: MonthSlot[];
  values: number[];
  selected: number;
  onSelect: (key: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const max = Math.max(...values, 1);
  const HEIGHT = 150;

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-key="${selected}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selected]);

  return (
    <div ref={ref} className="-mx-4 overflow-x-auto px-4 scrollbar-hide">
      <div className="flex items-end gap-2" style={{ minWidth: slots.length * 60 }}>
        {slots.map((slot, i) => {
          const value = values[i];
          const isSelected = slot.key === selected;
          return (
            <button key={slot.key} data-key={slot.key} onClick={() => onSelect(slot.key)} className="flex w-[54px] shrink-0 flex-col items-center">
              <div className="flex items-end justify-center" style={{ height: HEIGHT }}>
                {value > 0 ? (
                  <motion.span
                    className={cn("block w-9 rounded-full", isSelected ? "bg-white" : "bg-white/25")}
                    initial={{ height: 0 }}
                    animate={{ height: Math.max((value / max) * HEIGHT, 36) }}
                    transition={{ delay: i * 0.02, duration: 0.45, ease: "easeOut" }}
                  />
                ) : (
                  <span className={cn("block h-8 w-8 rounded-full border border-dashed", isSelected ? "border-white/70" : "border-white/25")} />
                )}
              </div>
              <span className={cn("mt-3 text-[12px] tabular-nums", isSelected ? "font-semibold text-white" : "text-white/45")}>{slot.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex items-center gap-3 rounded-[20px] bg-[#141414] px-4 py-4 text-[15px] text-white/45">
    <Clock className="h-5 w-5 shrink-0" />
    {text}
  </div>
);

// ── Page ─────────────────────────────────────────────────
const Cartoes = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("aba") as Tab) || "faturas";
  const setTab = (t: Tab) => setParams({ aba: t }, { replace: true });

  const { cards, invoices, installments, loading } = useCardsOverview();
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const now = new Date();
  const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);
  const [selectedKey, setSelectedKey] = useState(currentKey);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const visibleCards = cardFilter ? cards.filter((c) => c.id === cardFilter) : cards;
  const filteredInvoices = cardFilter ? invoices.filter((i) => i.cardId === cardFilter) : invoices;
  const filteredInstallments = cardFilter ? installments.filter((i) => i.cardId === cardFilter) : installments;

  const invoiceSlots = useMemo(() => monthSlots(-3, 15), []);
  const selectedSlot = invoiceSlots.find((s) => s.key === selectedKey) ?? invoiceSlots.find((s) => s.key === currentKey)!;
  const invoiceValues = invoiceSlots.map((s) =>
    filteredInvoices.filter((i) => monthKey(i.year, i.month) === s.key).reduce((sum, i) => sum + i.total, 0),
  );
  const monthInvoices = filteredInvoices
    .filter((i) => monthKey(i.year, i.month) === selectedSlot.key && i.total > 0)
    .sort((a, b) => b.total - a.total);

  const filterLabel = cardFilter ? cardById.get(cardFilter)?.name ?? "Cartão" : "Todos os cartões";

  return (
    <div className="mx-auto max-w-lg pb-28">
      {/* Nav */}
      <div className="flex h-11 items-center">
        <button onClick={() => navigate(-1)} aria-label="Voltar" className="-ml-2 flex h-10 items-center text-white/70 active:opacity-60">
          <ChevronLeft className="h-7 w-7" strokeWidth={2.25} />
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-2 grid grid-cols-3 isolate rounded-full border border-white/[0.07] bg-[#141414] p-1">
        {([["faturas", "Faturas"], ["parcelas", "Parcelas"], ["limites", "Limites"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setSelectedKey(currentKey); }} className="relative h-11 rounded-full text-[15px] font-medium">
            {tab === key && <motion.span layoutId="cards-tab" className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className={cn("relative z-10 transform-gpu transform-gpu", tab === key ? "text-[#0B0B0B]" : "text-white")}>{label}</span>
          </button>
        ))}
      </div>

      {/* Card filter */}
      {cards.length > 1 && (
        <button
          onClick={() => setPickerOpen(true)}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-medium text-[#0B0B0B]"
        >
          <CreditCard className="h-4 w-4" /> {filterLabel}
        </button>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="h-64 animate-pulse rounded-[22px] bg-[#141414]" />
        ) : cards.length === 0 ? (
          <EmptyState text="Nenhum cartão cadastrado" />
        ) : tab === "limites" ? (
          <LimitsList cards={visibleCards} />
        ) : tab === "parcelas" ? (
          <InstallmentsOverview installments={filteredInstallments} cardById={cardById} currentKey={currentKey} />
        ) : (
          <>
            <p className="text-[15px] text-white/50">Total em faturas em {MONTHS[selectedSlot.month - 1]}</p>
            <p className="text-[38px] font-extrabold leading-tight tracking-tight text-white tabular-nums">
              {fmt(invoiceValues[invoiceSlots.findIndex((s) => s.key === selectedSlot.key)] ?? 0)}
            </p>
            <div className="mt-6">
              <MonthBars slots={invoiceSlots} values={invoiceValues} selected={selectedSlot.key} onSelect={setSelectedKey} />
            </div>
            <div className="mt-6">
              {monthInvoices.length === 0 ? (
                <EmptyState text="Nenhuma fatura encontrada" />
              ) : (
                <InvoiceList invoices={monthInvoices} cardById={cardById} onOpen={(id) => navigate(`/fatura/${id}`)} />
              )}
            </div>
          </>
        )}
      </div>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <div className="px-5 pb-2">
          <p className="text-[20px] font-bold text-white">Filtrar por cartão</p>
          <div className="mt-3 divide-y divide-white/[0.06]">
            {[{ id: null as string | null, name: "Todos os cartões", color: null as string | null }, ...cards].map((c) => (
              <button
                key={c.id ?? "all"}
                onClick={() => { setCardFilter(c.id); setPickerOpen(false); }}
                className="flex w-full items-center gap-3 py-3.5 text-left"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: c.id ? `${cardHex(c.color)}26` : "rgba(255,255,255,0.08)" }}>
                  <CreditCard className="h-4 w-4" style={{ color: c.id ? cardHex(c.color) : "#fff" }} />
                </span>
                <span className="flex-1 text-[16px] text-white">{c.name}</span>
                {cardFilter === c.id && <Check className="h-5 w-5 text-white" />}
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

function InvoiceList({ invoices, cardById, onOpen }: {
  invoices: OverviewInvoice[];
  cardById: Map<string, OverviewCard>;
  onOpen: (cardId: string) => void;
}) {
  return (
    <div className="divide-y divide-white/[0.06] rounded-[22px] border border-white/[0.07] bg-[#141414] px-4">
      {invoices.map((inv) => {
        const card = cardById.get(inv.cardId);
        if (!card) return null;
        const due = invoiceDueDate(card, inv.year, inv.month);
        return (
          <button key={inv.id} onClick={() => onOpen(card.id)} className="flex w-full items-center gap-3 py-3.5 text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `${cardHex(card.color)}26` }}>
              <CreditCard className="h-[18px] w-[18px]" style={{ color: cardHex(card.color) }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-white">{card.name}</span>
              <span className={cn("block text-[12px]", inv.isPaid ? "text-white/40" : "text-amber-300/90")}>
                {inv.isPaid ? "Paga" : `Vence ${due.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`}
              </span>
            </span>
            <span className={cn("text-[15px] font-semibold tabular-nums", inv.isPaid ? "text-white/45" : "text-white")}>{fmt(inv.total)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Parcelas: every active installment purchase across the cards ──
interface InstallmentPurchase {
  groupId: string;
  name: string;
  category: string;
  cardId: string;
  amount: number;
  total: number;
  current: number;
  remaining: number;
  lastKey: number;
}

function InstallmentsOverview({ installments, cardById, currentKey }: {
  installments: OverviewInstallment[];
  cardById: Map<string, OverviewCard>;
  currentKey: number;
}) {
  const purchases = useMemo(() => {
    const groups = new Map<string, OverviewInstallment[]>();
    for (const it of installments) groups.set(it.groupId, [...(groups.get(it.groupId) ?? []), it]);

    const list: InstallmentPurchase[] = [];
    groups.forEach((items, groupId) => {
      const upcoming = items.filter((i) => monthKey(i.year, i.month) >= currentKey);
      if (upcoming.length === 0) return;
      const first = items[0];
      const thisMonth = items.find((i) => monthKey(i.year, i.month) === currentKey) ?? upcoming.sort((a, b) => a.number - b.number)[0];
      const lastKey = Math.max(...items.map((i) => monthKey(i.year, i.month)));
      list.push({
        groupId,
        name: first.name,
        category: first.category,
        cardId: first.cardId,
        amount: thisMonth.amount,
        total: first.total,
        current: thisMonth.number,
        remaining: first.total - thisMonth.number + 1,
        lastKey,
      });
    });
    return list.sort((a, b) => b.amount * b.remaining - a.amount * a.remaining);
  }, [installments, currentKey]);

  const monthly = purchases.reduce((s, p) => s + p.amount, 0);
  const remainingTotal = purchases.reduce((s, p) => s + p.amount * p.remaining, 0);
  const freeKey = purchases.length ? Math.max(...purchases.map((p) => p.lastKey)) : null;

  if (purchases.length === 0) return <EmptyState text="Nenhuma parcela em andamento" />;

  return (
    <div>
      <p className="text-[15px] text-white/50">Parcelado no cartão a pagar</p>
      <p className="text-[38px] font-extrabold leading-tight tracking-tight text-white tabular-nums">{fmt(remainingTotal)}</p>
      <p className="text-[15px] text-white/50">
        {purchases.length} {purchases.length === 1 ? "compra parcelada" : "compras parceladas"}
      </p>

      <div className="mt-5 grid grid-cols-2 rounded-[22px] border border-white/[0.07] bg-[#141414] py-3.5">
        <div className="px-4">
          <p className="text-[12px] text-white/45">Por mês</p>
          <p className="text-[18px] font-bold text-white tabular-nums">{fmt(monthly)}</p>
        </div>
        <div className="border-l border-white/[0.08] px-4">
          <p className="text-[12px] text-white/45">Livre das parcelas</p>
          <p className="text-[18px] font-bold text-white">{freeKey !== null ? keyLabel(freeKey + 1) : "—"}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {purchases.map((p, i) => {
          const Icon = getCategoryIcon(p.category);
          const hex = getCategoryHexColor(p.category);
          const card = cardById.get(p.cardId);
          const paidPct = ((p.current - 1) / p.total) * 100;
          return (
            <motion.div
              key={p.groupId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-[22px] border border-white/[0.07] bg-[#141414] p-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `${hex}1F` }}>
                  <Icon className="h-[18px] w-[18px]" style={{ color: hex }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-white">{p.name}</p>
                  <p className="flex items-center gap-1.5 truncate text-[12px] text-white/40">
                    {card && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cardHex(card.color) }} />}
                    {card?.name ?? "Cartão"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-semibold text-white tabular-nums">{fmt(p.amount)}</p>
                  <p className="text-[11px] text-white/40">por mês</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="h-full rounded-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${paidPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[12px] text-white/45 tabular-nums">
                <span>Parcela {p.current} de {p.total}</span>
                <span>Faltam {fmt(p.amount * p.remaining)} · até {keyLabel(p.lastKey)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function LimitsList({ cards }: { cards: OverviewCard[] }) {
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0);
  const totalUsed = cards.reduce((s, c) => s + c.used, 0);
  if (cards.length === 0) return <EmptyState text="Nenhum limite de cartão encontrado" />;

  return (
    <div>
      <p className="text-[15px] text-white/50">Limite disponível</p>
      <p className="text-[38px] font-extrabold leading-tight tracking-tight text-white tabular-nums">{fmt(Math.max(totalLimit - totalUsed, 0))}</p>
      <p className="text-[15px] text-white/50 tabular-nums">de {fmt(totalLimit)}</p>

      <div className="mt-6 space-y-2.5">
        {cards.map((c) => {
          const pct = c.limit > 0 ? Math.min((c.used / c.limit) * 100, 100) : 0;
          const hex = cardHex(c.color);
          return (
            <div key={c.id} className="rounded-[22px] border border-white/[0.07] bg-[#141414] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `${hex}26` }}>
                  <CreditCard className="h-4 w-4" style={{ color: hex }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-white">{c.name}</p>
                  {c.lastFour && <p className="text-[12px] text-white/40 tabular-nums">•••• {c.lastFour}</p>}
                </div>
                <p className="text-right">
                  <span className="block text-[15px] font-semibold text-white tabular-nums">{fmt(Math.max(c.limit - c.used, 0))}</span>
                  <span className="block text-[11px] text-white/40">disponível</span>
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className={cn("h-full rounded-full", pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-300" : "bg-white")}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[12px] text-white/45 tabular-nums">
                <span>{fmt(c.used)} usado</span>
                <span>Limite {fmt(c.limit)}</span>
              </div>
              <p className="mt-2 text-[12px] text-white/35">Fecha dia {c.closingDay} · vence dia {c.dueDay}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Cartoes;
