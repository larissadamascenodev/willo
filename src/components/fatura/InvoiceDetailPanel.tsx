import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, CalendarClock, ChevronRight, Layers, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { getInvoiceItems, payInvoice } from "@/services/invoiceService";
import { createTransaction } from "@/services/transactionService";
import { processScanFile } from "@/lib/scanUpload";
import { anchorPurchaseDate, invoiceAnchorDate, planImportRows } from "@/lib/installments";
import { statementCarryLine } from "@/lib/statementCarry";
import InvoiceEntryChooser from "./InvoiceEntryChooser";
import InvoiceScanScreen from "./InvoiceScanScreen";
import InvoiceUploadReviewModal, { type ExtractedItem } from "./InvoiceUploadReviewModal";
import { getAccounts, getTransactionById } from "@/services/transactionService";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { getCategoryIcon, getCategoryColor, getCategoryHexColor } from "@/lib/categoryUtils";
import {
  SpendRing, CategoryRows, GroupCards, ViewToggle, groupCategories,
  type OverviewCategory,
} from "@/components/analytics/CategoryOverviewViews";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { formatCurrency, type EnrichedItem } from "@/pages/FaturaCartao";
import { cardHex, type OverviewCard, type OverviewInvoice } from "@/hooks/useCardsOverview";
import NovaTransacaoModal, { type EditTransactionData } from "@/components/dashboard/NovaTransacaoModal";
import TransactionDetailModal, { type TransactionRow } from "@/components/dashboard/TransactionDetailModal";
import InstallmentPurchaseCard from "@/components/installments/InstallmentPurchaseCard";
import SinglePurchaseCard from "./SinglePurchaseCard";
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

const MONTH_LABELS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

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
  const [catView, setCatView] = useState<"categorias" | "grupos">("categorias");

  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [payAccountId, setPayAccountId] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedItem[]>([]);
  const [extractedMessage, setExtractedMessage] = useState("");
  const [declaredTotal, setDeclaredTotal] = useState<number | null>(null);
  // What the lines should add up to, which is the printed total minus whatever the
  // statement carried in from the month before.
  const [expectedTotal, setExpectedTotal] = useState<number | null>(null);
  const [carriedOver, setCarriedOver] = useState<number | null>(null);
  const [declaredNext, setDeclaredNext] = useState<number | null>(null);
  const [declaredOutstanding, setDeclaredOutstanding] = useState<number | null>(null);
  const [avgConfidence, setAvgConfidence] = useState<number | undefined>(undefined);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanItems, setScanItems] = useState<ExtractedItem[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [detailTx, setDetailTx] = useState<TransactionRow | null>(null);
  const [editTx, setEditTx] = useState<EditTransactionData | null>(null);

  const navigate = useNavigate();
  const { user } = useAuth();
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

  // The shared category views take hex and an icon per row, and cannot plot a refund,
  // so those are listed separately underneath instead of being dropped.
  const overviewCats = useMemo<OverviewCategory[]>(() => {
    const positive = categories.filter((c) => c.total > 0);
    const sum = positive.reduce((acc, c) => acc + c.total, 0);
    return positive.map((c) => ({
      name: c.category,
      amount: c.total,
      percentage: sum > 0 ? Math.round((c.total / sum) * 100) : 0,
      hexColor: getCategoryHexColor(c.category, customCats),
      icon: getCategoryIcon(c.category, customCats),
    }));
  }, [categories, customCats]);

  const refunds = useMemo(() => categories.filter((c) => c.total < 0), [categories]);

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

  // A photo or a PDF of the whole statement, read by the AI and shown for review
  // before anything is written.
  const handleUpload = async (file: File) => {
    setChooserOpen(false);
    setScanItems(null);
    setScanOpen(true);
    try {
      const data = await processScanFile(file, "invoice");
      const items: ExtractedItem[] = (data.items || []).map((item: any) => ({ ...item, selected: true }));
      if (items.length === 0) {
        setScanOpen(false);
        toast.error("Nenhuma compra encontrada nessa fatura.");
        return;
      }
      // What the statement brought in from last month goes in as its own line, so the
      // invoice ends up asking for what the statement asks for.
      const carry = statementCarryLine(data.carried_over, `${year}-${String(month).padStart(2, "0")}-01`);
      if (carry) items.push(carry);
      setExtracted(items);
      setExtractedMessage(data.message || "Lançamentos encontrados!");
      setDeclaredTotal(data.declared_total ?? null);
      setExpectedTotal(data.expected_total ?? null);
      setCarriedOver(data.carried_over ?? null);
      setDeclaredNext(data.declared_next_invoice ?? null);
      setDeclaredOutstanding(data.declared_outstanding ?? null);
      setAvgConfidence(typeof data.avg_confidence === "number" ? data.avg_confidence : undefined);
      setScanItems(items);
    } catch (err: any) {
      setScanOpen(false);
      toast.error(err?.message || "Erro ao processar a fatura");
    }
  };

  const handleImport = async (selected: ExtractedItem[]) => {
    if (!user) return;
    setImporting(true);
    try {
      const invoicePeriod = year * 12 + (month - 1);
      for (const row of planImportRows(selected)) {
        const { item, installments, installmentCurrent, paidInstallments } = row;
        const isParcelado = !!installments && installments > 1;
        const purchaseDate = row.pinToInvoice
          ? invoiceAnchorDate(invoicePeriod)
          : anchorPurchaseDate(
              item,
              invoicePeriod + row.periodOffset,
              paidInstallments,
              card.closingDay,
            );

        await createTransaction(
          {
            name: item.description,
            type: "despesa",
            amount: item.amount,
            category: item.category || "Outros",
            date: purchaseDate,
            status: "pago",
            payment_method: "cartao",
            credit_card_id: card.id,
            recurrence_type: isParcelado ? "parcelado" : "unica",
            installments: isParcelado ? installments : null,
            installment_current: isParcelado ? installmentCurrent : null,
            // The printed date is the instalment's, not the purchase's, so it is not
            // written down as if it were the purchase date.
            observation: paidInstallments > 0 ? `paid_installments:${paidInstallments}` : null,
          },
          user.id,
        );
      }
      toast.success(`${selected.length} lançamento${selected.length > 1 ? "s" : ""} importado${selected.length > 1 ? "s" : ""}! 🎉`);
      setReviewOpen(false);
      setExtracted([]);
      window.dispatchEvent(new CustomEvent("transaction-created"));
      loadItems();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao importar lançamentos");
    } finally {
      setImporting(false);
    }
  };

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

  const openEntry = async (transactionId: string) => {
    try {
      const tx = await getTransactionById(transactionId);
      setDetailTx(tx as unknown as TransactionRow);
    } catch {
      toast.error("Não foi possível abrir esse lançamento");
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
          onClick={() => setChooserOpen(true)}
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
          <button
            type="button"
            onClick={() => setAllCatsOpen(true)}
            className="block w-full rounded-[22px] border border-white/[0.08] willo-glass px-5 pb-4 pt-[18px] text-left transition-transform active:scale-[0.99]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/45">Gastos do cartão</p>
              <p className="flex items-baseline gap-1.5 text-[13px] font-semibold tabular-nums text-white">
                {formatCurrency(invoiceTotal)}
                <ChevronRight className="h-4 w-4 shrink-0 self-center text-white/35" />
              </p>
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
              <span className="mt-4 flex h-10 w-full items-center justify-center rounded-full bg-white/[0.05] text-[13px] font-medium text-white/82">
                Ver as {categories.length} categorias
              </span>
            )}
          </button>

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
            /* One card per purchase rather than rows in a single list: an instalment
               plan carries its own count, its per-instalment and total values and what
               is left, which is more than a row can hold. */
            <div className="space-y-2.5">
              {shown.map((item, i) =>
                (item.total_installments ?? 1) > 1 ? (
                  <InstallmentPurchaseCard
                    key={item.id}
                    index={i}
                    customCats={customCats}
                    card={{ name: card.name, color: card.color }}
                    onOpen={() => openEntry(item.transaction_id)}
                    item={{
                      id: item.transaction_id,
                      name: item.transaction_name,
                      category: item.transaction_category,
                      amount: Number(item.amount),
                      installment_current: item.installment_number,
                      installments: item.total_installments,
                      payment_method: "cartao",
                      date: item.transaction_date,
                      credit_card_id: card.id,
                      isOverdue: false,
                      dueDate: null,
                    }}
                  />
                ) : (
                  <SinglePurchaseCard
                    key={item.id}
                    index={i}
                    customCats={customCats}
                    card={{ name: card.name, color: card.color }}
                    onOpen={() => openEntry(item.transaction_id)}
                    item={{
                      id: item.id,
                      name: item.transaction_name,
                      category: item.transaction_category,
                      amount: Number(item.amount),
                      date: item.transaction_date,
                    }}
                  />
                ),
              )}
            </div>
          )}
        </>
      )}

      {/* The same ring and the same two readings the categories screen uses, over this
          one statement — it is the view people already know, pointed at one card. */}
      <BottomSheet open={allCatsOpen} onClose={() => setAllCatsOpen(false)} size="full" zIndex={65}>
        <div className="px-4 pb-6">
          <p className="px-1 text-[20px] font-bold text-white">Gastos por categoria</p>
          <p className="mt-1 px-1 text-[13px] text-white/55">
            {card.name} · fatura de {MONTH_LABELS[month - 1]}
          </p>

          <div className="mt-5">
            <SpendRing
              segments={overviewCats.map((c) => ({ key: c.name, hex: c.hexColor, amount: c.amount }))}
              total={overviewCats.reduce((acc, c) => acc + c.amount, 0)}
              caption={refunds.length > 0 ? "antes dos estornos" : "nesta fatura"}
            />
          </div>

          <div className="mt-6">
            <ViewToggle<"categorias" | "grupos">
              value={catView}
              onChange={setCatView}
              options={[{ key: "categorias", label: "Categorias" }, { key: "grupos", label: "Grupos" }]}
            />
          </div>

          <div className="mt-4">
            {catView === "categorias" ? (
              <CategoryRows categories={overviewCats} onOpen={() => navigate("/analytics/categorias")} />
            ) : (
              <GroupCards groups={groupCategories(overviewCats)} />
            )}
          </div>

          {refunds.length > 0 && (
            <div className="mt-5 rounded-[22px] border border-white/[0.08] willo-glass px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/45">Estornos</p>
              <div className="mt-2.5 space-y-2">
                {refunds.map((r) => (
                  <div key={r.category} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[14px] text-white/75">{r.category}</span>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums text-willo-green">
                      {formatCurrency(r.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </BottomSheet>

      <InvoiceEntryChooser
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onManual={() => { setChooserOpen(false); setAddOpen(true); }}
        onFile={handleUpload}
      />

      <InvoiceScanScreen
        open={scanOpen}
        items={scanItems}
        onClose={() => { setScanOpen(false); setScanItems(null); }}
        onDone={() => { setScanOpen(false); setScanItems(null); setReviewOpen(true); }}
      />

      <InvoiceUploadReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        items={extracted}
        message={extractedMessage}
        onConfirm={handleImport}
        confirming={importing}
        avgConfidence={avgConfidence}
        declaredTotal={declaredTotal}
        expectedTotal={expectedTotal}
        carriedOver={carriedOver}
        declaredNextInvoice={declaredNext}
        declaredOutstanding={declaredOutstanding}
        invoicePeriod={year * 12 + (month - 1)}
        closingDay={card.closingDay}
      />

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

      <TransactionDetailModal
        open={!!detailTx}
        tx={detailTx}
        accountName={card.name}
        userId={user?.id}
        selectedMonth={month - 1}
        selectedYear={year}
        onClose={() => setDetailTx(null)}
        onRefresh={() => { loadItems(); onChanged(); }}
        onEdit={(tx) => {
          setDetailTx(null);
          setEditTx({
            id: tx.id,
            name: tx.name,
            type: tx.type === "receita" ? "receita" : "despesa",
            amount: Number(tx.amount),
            category: tx.category,
            date: tx.date,
            status: tx.status === "pago" ? "pago" : "pendente",
            payment_method: tx.payment_method === "cartao" ? "cartao" : "conta",
            account_id: tx.account_id,
            credit_card_id: tx.credit_card_id,
            recurrence_type: (tx.recurrence_type as EditTransactionData["recurrence_type"]) ?? "unica",
            installments: tx.installments,
            installment_current: tx.installment_current,
            observation: tx.observation,
          });
        }}
      />

      <NovaTransacaoModal
        open={!!editTx}
        onClose={() => setEditTx(null)}
        onSuccess={() => {
          window.dispatchEvent(new CustomEvent("transaction-created"));
          loadItems();
          onChanged();
        }}
        editTransaction={editTx}
        initialType={editTx?.type ?? "despesa"}
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
