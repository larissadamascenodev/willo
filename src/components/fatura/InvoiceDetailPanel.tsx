import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, CalendarClock, Layers, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { getInvoiceItems, payInvoice } from "@/services/invoiceService";
import { getAccounts } from "@/services/transactionService";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryUtils";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { formatCurrency, type EnrichedItem } from "@/pages/FaturaCartao";
import { cardHex, type OverviewCard, type OverviewInvoice } from "@/hooks/useCardsOverview";
import NovaTransacaoModal from "@/components/dashboard/NovaTransacaoModal";
import InvoicePayModal from "./InvoicePayModal";
import BottomSheet from "@/components/shared/BottomSheet";
import { cn } from "@/lib/utils";

interface AccountInfo {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  is_default: boolean;
}

interface CategoryRow {
  category: string;
  total: number;
  count: number;
  share: number;
}

const PREVIEW = 5;

/**
 * Everything a single card's statement had on a page of its own, folded into the tab
 * that already lists the statements. Two screens were showing the same month from the
 * same data; this is the one that survives, so switching cards re-reads the whole
 * thing rather than pushing another route.
 */
export default function InvoiceDetailPanel({ card, invoice, month, year, onChanged }: {
  card: OverviewCard;
  invoice: OverviewInvoice | null;
  month: number;
  year: number;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"geral" | "parcelado">("geral");
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [allCatsOpen, setAllCatsOpen] = useState(false);

  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [payAccountId, setPayAccountId] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const hex = cardHex(card.color);

  const loadItems = useCallback(() => {
    if (!invoice) {
      setItems([]);
      return;
    }
    setLoading(true);
    getInvoiceItems(invoice.id)
      .then((data) => setItems(data as EnrichedItem[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [invoice]);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { getCustomCategories().then(setCustomCats).catch(() => undefined); }, []);

  useEffect(() => {
    getAccounts()
      .then((a) => {
        const list = (a as unknown as AccountInfo[]).filter((x) => x.type !== "investment");
        setAccounts(list);
        setPayAccountId((prev) => prev || (list.find((x) => x.is_default) ?? list[0])?.id || "");
      })
      .catch(() => undefined);
  }, []);

  const invoiceTotal = items.reduce((s, i) => s + Number(i.amount), 0);

  // Only this card, only this month: the breakdown is of the statement in front of
  // you, never of everything you spent.
  const categories = useMemo<CategoryRow[]>(() => {
    const byCat = new Map<string, { total: number; count: number }>();
    for (const i of items) {
      const key = i.transaction_category || "Outros";
      const prev = byCat.get(key) ?? { total: 0, count: 0 };
      byCat.set(key, { total: prev.total + Number(i.amount), count: prev.count + 1 });
    }
    // Refunds land as negative rows; they belong in the list but cannot take up room
    // on a bar, so the shares are of what actually went out.
    const positive = [...byCat.values()].reduce((s, v) => s + Math.max(v.total, 0), 0);
    return [...byCat.entries()]
      .map(([category, v]) => ({
        category,
        total: v.total,
        count: v.count,
        share: positive > 0 ? (Math.max(v.total, 0) / positive) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  // Newest at the top: a statement is read backwards from the last thing you bought.
  const sorted = useMemo(
    () => [...items].sort((a, b) => (b.transaction_date ?? "").localeCompare(a.transaction_date ?? "")),
    [items],
  );
  const parceladas = sorted.filter((i) => (i.total_installments ?? 1) > 1);
  const shown = view === "geral" ? sorted : parceladas;

  const used = card.used;
  const limit = card.limit;
  const available = limit - used;
  const usedPct = limit > 0 ? (used / limit) * 100 : 0;
  const over = usedPct >= 100;

  const paidAmount = invoice?.paid ?? 0;
  const outstanding = Math.max((invoice?.total ?? 0) - paidAmount, 0);

  const handlePay = async (details: import("./InvoicePayModal").PaymentDetails) => {
    if (!invoice || !payAccountId) return;
    setPaying(true);
    try {
      await payInvoice(invoice.id, payAccountId, {
        mode: details.mode,
        amount_paid: details.amountPaid,
        installments: details.installments,
        entry_amount: details.entryAmount,
      });
      toast.success(
        `Fatura paga ${details.mode === "total" ? "integralmente" : details.mode === "minimo" ? "parcialmente" : "parcelada"}! ✅`,
      );
      setPayOpen(false);
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
      onChanged();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao pagar fatura");
    } finally {
      setPaying(false);
    }
  };

  const CatRow = ({ row, index }: { row: CategoryRow; index: number }) => {
    const color = getCategoryColor(row.category, customCats);
    const Icon = getCategoryIcon(row.category, customCats);
    return (
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `hsl(${color} / 0.15)` }}>
          <Icon className="h-4 w-4" style={{ color: `hsl(${color})` }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[14px] text-white">{row.category}</p>
            <p className={cn("shrink-0 text-[14px] font-semibold tabular-nums", row.total < 0 ? "text-willo-green" : "text-white")}>
              {formatCurrency(row.total)}
            </p>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.span
                className="block h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${row.share}%` }}
                transition={{ delay: 0.08 + Math.min(index, 8) * 0.04, duration: 0.5, ease: "easeOut" }}
                style={{ background: `hsl(${color})` }}
              />
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-white/45">
              {row.share.toFixed(0)}% · {row.count} {row.count === 1 ? "compra" : "compras"}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-5 space-y-3">
      {/* ── Limit: used, left, total, and the two dates that govern the card ── */}
      <section className="rounded-[22px] border border-white/[0.08] willo-glass px-5 pb-4 pt-[18px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/45">Limite usado</span>
          <span className={cn("text-[12.5px] font-semibold tabular-nums", over ? "text-red-400" : "text-white/82")}>
            {usedPct.toFixed(0)}%
          </span>
        </div>

        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: over ? "#F87171" : hex }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(usedPct, 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[11.5px] text-white/50">Usado</p>
            <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-white">{formatCurrency(used)}</p>
          </div>
          <div className="border-x border-white/[0.06]">
            <p className="text-[11.5px] text-white/50">Disponível</p>
            <p className={cn("mt-0.5 text-[14px] font-semibold tabular-nums", available < 0 ? "text-red-400" : "text-willo-green")}>
              {formatCurrency(available)}
            </p>
          </div>
          <div>
            <p className="text-[11.5px] text-white/50">Total</p>
            <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-white">{formatCurrency(limit)}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 border-t border-white/[0.06] pt-3.5">
          <span className="flex items-center gap-2 text-[12.5px] text-white/60">
            <CalendarClock className="h-4 w-4 shrink-0 text-white/40" />
            Fecha dia <span className="font-semibold text-white">{card.closingDay}</span>
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="flex items-center gap-2 text-[12.5px] text-white/60">
            <CalendarCheck className="h-4 w-4 shrink-0 text-white/40" />
            Vence dia <span className="font-semibold text-white">{card.dueDay}</span>
          </span>
        </div>
      </section>

      {/* ── The two things you came here to do ── */}
      <div className="flex gap-2.5">
        {invoice && outstanding > 0 && (
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-[#0B0B0B] active:scale-[0.99]"
          >
            <Wallet className="h-4 w-4" /> Pagar fatura
          </button>
        )}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className={cn(
            "flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-white/[0.14] willo-glass-control text-[15px] font-semibold text-white active:opacity-75",
            invoice && outstanding > 0 ? "w-[52px] shrink-0" : "flex-1",
          )}
          aria-label="Adicionar lançamento"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
          {!(invoice && outstanding > 0) && "Adicionar lançamento"}
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div className="h-48 animate-pulse rounded-[22px] border border-white/[0.08] willo-glass" />
      ) : items.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/[0.10] px-5 py-8 text-center">
          <p className="text-[14px] text-white/55">Nada lançado nessa fatura.</p>
        </div>
      ) : (
        <>
          {/* ── Where this card's month went ── */}
          <section className="rounded-[22px] border border-white/[0.08] willo-glass px-5 pb-4 pt-[18px]">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/45">Gastos do cartão</p>
              <p className="text-[13px] font-semibold tabular-nums text-white">{formatCurrency(invoiceTotal)}</p>
            </div>

            <div className="mt-3 flex h-2 w-full gap-[2px] overflow-hidden rounded-full">
              {categories.filter((c) => c.share > 0).map((c) => (
                <span
                  key={c.category}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${Math.max(c.share, 1)}%`, background: `hsl(${getCategoryColor(c.category, customCats)})` }}
                />
              ))}
            </div>

            {categories[0] && (
              <p className="mt-2.5 text-[12.5px] text-white/60">
                <span className="font-semibold text-white">{categories[0].category}</span> lidera com {categories[0].share.toFixed(0)}% da fatura
              </p>
            )}

            <div className="mt-4 space-y-3">
              {categories.slice(0, PREVIEW).map((row, i) => (
                <CatRow key={row.category} row={row} index={i} />
              ))}
            </div>

            {categories.length > PREVIEW && (
              <button
                type="button"
                onClick={() => setAllCatsOpen(true)}
                className="mt-4 flex h-10 w-full items-center justify-center rounded-full bg-white/[0.05] text-[13px] font-medium text-white/82 active:opacity-70"
              >
                Ver as {categories.length} categorias
              </button>
            )}
          </section>

          {/* ── The entries themselves, newest first ── */}
          <div className="flex items-center justify-between gap-3 px-1 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/45">Lançamentos</p>
            <div className="flex rounded-full bg-white/[0.07] p-0.5 [isolation:isolate]">
              {([["geral", "Geral", sorted.length], ["parcelado", "Parcelado", parceladas.length]] as const).map(([key, label, n]) => (
                <button key={key} onClick={() => setView(key)} className="relative h-7 rounded-full px-3 text-[11.5px] font-semibold">
                  {view === key && (
                    <motion.span
                      layoutId="invoice-items-view"
                      className="pointer-events-none absolute inset-0 rounded-full bg-white"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className={cn("relative transform-gpu transition-colors", view === key ? "text-[#0B0B0B]" : "text-white/66")}>
                    {label} {n}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="flex items-center gap-3 rounded-[22px] border border-white/[0.08] willo-glass px-4 py-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                <Layers className="h-4 w-4 text-white/60" />
              </span>
              <p className="text-[13.5px] text-white/60">Nenhuma compra parcelada nessa fatura.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.055] rounded-[22px] border border-white/[0.08] willo-glass px-4">
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((item, i) => {
                  const color = getCategoryColor(item.transaction_category, customCats);
                  const Icon = getCategoryIcon(item.transaction_category, customCats);
                  const total = item.total_installments ?? 1;
                  const current = item.installment_number ?? 1;
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.02 }}
                      className="flex items-center gap-3 py-3.5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `hsl(${color} / 0.15)` }}>
                        <Icon className="h-[17px] w-[17px]" style={{ color: `hsl(${color})` }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[14.5px] font-medium text-white">{item.transaction_name}</p>
                          <p className={cn(
                            "shrink-0 text-[14.5px] font-semibold tabular-nums",
                            Number(item.amount) < 0 ? "text-willo-green" : "text-white",
                          )}>
                            {formatCurrency(Number(item.amount))}
                          </p>
                        </div>
                        <div className="mt-0.5 flex items-baseline justify-between gap-2">
                          <p className="truncate text-[12px] text-white/45">{item.transaction_category || "Outros"}</p>
                          {total > 1 && (
                            <p className="shrink-0 text-[12px] tabular-nums text-white/45">{current} de {total}</p>
                          )}
                        </div>
                        {total > 1 && (
                          <div className="mt-2 flex gap-[3px]">
                            {Array.from({ length: Math.min(total, 24) }, (_, k) => (
                              <span
                                key={k}
                                className={cn("h-[3px] flex-1 rounded-full", k < current ? "bg-white/70" : "bg-white/[0.12]")}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* Every category with its own numbers, rather than a list that just gets longer */}
      <BottomSheet open={allCatsOpen} onClose={() => setAllCatsOpen(false)} size="full" zIndex={65}>
        <div className="px-5 pb-4">
          <p className="text-[20px] font-bold text-white">Gastos por categoria</p>
          <p className="mt-1 text-[13px] text-white/55">
            {card.name} · fatura de {String(month).padStart(2, "0")}/{year} · {formatCurrency(invoiceTotal)}
          </p>
          <div className="mt-5 space-y-3.5">
            {categories.map((row, i) => (
              <CatRow key={row.category} row={row} index={i} />
            ))}
          </div>
        </div>
      </BottomSheet>

      <InvoicePayModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        total={outstanding}
        accounts={accounts}
        payAccountId={payAccountId}
        setPayAccountId={setPayAccountId}
        onConfirm={handlePay}
        paying={paying}
      />

      <NovaTransacaoModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => {
          window.dispatchEvent(new CustomEvent("transaction-created"));
          loadItems();
          onChanged();
        }}
        initialType="despesa"
        initialPaymentMethod="cartao"
        initialCreditCardId={card.id}
      />
    </div>
  );
}
