import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, ChevronDown, Loader2, Pencil } from "lucide-react";
import { getCategoryHexColor, getCategoryIcon } from "@/lib/categoryUtils";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/categoryIcons";
import { cn } from "@/lib/utils";
import GlowButton from "@/components/shared/GlowButton";

import { currencySymbol, getCurrency } from "@/lib/currency";
export interface ScanResultItem {
  description: string;
  amount: number;
  category: string;
  date?: string | null;
  time?: string | null;
  merchant?: string | null;
  type?: string;
  selected?: boolean;
}

export interface ScanAccount {
  id: string;
  name: string;
  is_default?: boolean;
}

interface Props<T extends ScanResultItem> {
  items: T[];
  accountName?: string | null;
  lowConfidence?: boolean;
  confirming?: boolean;
  onConfirm?: () => void;
  /** Enables editing inside the card. */
  onItemsChange?: (items: T[]) => void;
  accounts?: ScanAccount[];
  accountId?: string | null;
  onAccountChange?: (id: string) => void;
  /** Overrides the confirm label (e.g. "Continuar" in the onboarding demo). */
  confirmLabel?: string;
  /** Overrides the title (e.g. "Fatura de setembro"). */
  title?: string;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
const plain = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(date?: string | null, time?: string | null) {
  if (!date) return time ?? "Hoje";
  const d = new Date(`${date}T12:00:00`);
  const otherYear = d.getFullYear() !== new Date().getFullYear();
  const label = Number.isNaN(d.getTime())
    ? date
    : d
        .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", ...(otherYear ? { year: "numeric" } : {}) })
        .replace(/\./g, "")
        .replace(/ de /g, " ");
  return time ? `${label} · ${time}` : label;
}

/** Receipts from another month land in that month, not in the current one. */
function isOtherMonth(date?: string | null) {
  if (!date) return false;
  const d = new Date(`${date}T12:00:00`);
  const now = new Date();
  return d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear();
}

const inputCls = "w-full min-w-0 bg-transparent text-right text-[16px] font-medium text-white placeholder:text-white/30 focus:outline-none";

/**
 * Bottom card shown over the captured receipt photo: what the AI read, item
 * by item, the total and a confirm action. The
 * pencil switches the same card into edit mode — no second modal.
 */
function ScanResultCard<T extends ScanResultItem>({
  items, accountName, lowConfidence, confirming, onConfirm, onItemsChange, accounts = [], accountId, onAccountChange, confirmLabel,
  title: titleOverride,
}: Props<T>) {
  const [editing, setEditing] = useState(false);
  const [pickingCategory, setPickingCategory] = useState(false);

  const active = items.filter((i) => i.selected !== false);
  const single = items.length === 1 ? items[0] : null;
  const total = active.reduce((s, i) => s + i.amount, 0);
  const isIncome = single?.type === "receita";
  const canEdit = !!onItemsChange;

  const update = (index: number, patch: Partial<ScanResultItem>) =>
    onItemsChange?.(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const merchant = single ? single.merchant || single.description : items.find((i) => i.merchant)?.merchant;
  const title = titleOverride || merchant || `${items.length} lançamentos`;
  const shownAccount = accounts.find((a) => a.id === accountId)?.name ?? accountName;

  const rows: { label: string; value: string; hex?: string }[] = single
    ? [
        ...(single.merchant && single.merchant !== single.description ? [{ label: "Descrição", value: single.description }] : []),
        { label: "Categoria", value: single.category || "Outros", hex: getCategoryHexColor(single.category || "Outros") },
        { label: "Data", value: formatDate(single.date, single.time) },
        ...(shownAccount ? [{ label: "Conta", value: shownAccount }] : []),
      ]
    : [];

  const totalDigits = plain(total).length;
  const totalSize = totalDigits <= 8 ? 48 : 40;

  const categoryOptions = isIncome ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  const statusLabel = editing
    ? "Editando"
    : lowConfidence
      ? "Confira antes de salvar"
      : single
        ? "Identificado pela IA"
        : "Identificado item por item";

  return (
    <div className="px-5 pb-5 pt-6">
      {/* Status + edit */}
      <div className="flex items-center justify-between gap-3">
        {!editing && !lowConfidence ? (
          // Teal lettering: the AI read it
          <motion.p
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em] text-[#5ED8C8]"
          >
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#5ED8C8]">
              <Check className="h-3 w-3 text-[#0B0B0B]" strokeWidth={3.5} />
            </span>
            {statusLabel}
          </motion.p>
        ) : (
          <p className={cn("flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em]", !editing && lowConfidence ? "text-amber-300" : "text-white/80")}>
            {editing ? <Pencil className="h-3.5 w-3.5" /> : <AlertTriangle className="h-4 w-4" />}
            {statusLabel}
          </p>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => { setEditing((v) => !v); setPickingCategory(false); }}
            aria-label={editing ? "Concluir edição" : "Editar"}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95",
              editing ? "bg-white text-[#0B0B0B]" : "bg-white/[0.08] text-white",
            )}
          >
            {editing ? <Check className="h-4 w-4" strokeWidth={3} /> : <Pencil className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Title */}
      {editing && single ? (
        <input
          value={single.merchant || single.description}
          onChange={(e) => update(0, single.merchant ? { merchant: e.target.value } : { description: e.target.value })}
          className="mt-3 w-full bg-transparent text-[22px] font-extrabold uppercase leading-[1.15] tracking-tight text-white focus:outline-none"
          aria-label="Nome"
        />
      ) : (
        <h2 className="mt-3 line-clamp-2 text-[22px] font-extrabold uppercase leading-[1.15] tracking-tight text-white">{title}</h2>
      )}

      {/* ── Details ── */}
      {!editing ? (
        <div className="mt-3 divide-y divide-white/[0.08]">
          {single
            ? rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 py-3.5 text-[16px]">
                  <span className="truncate text-white/60">{row.label}</span>
                  <span className="flex shrink-0 items-center gap-1.5 font-medium text-white">
                    {row.hex && <span className="h-2 w-2 rounded-full" style={{ background: row.hex }} />}
                    {row.value}
                  </span>
                </div>
              ))
            : items.slice(0, 5).map((item, i) => (
                <div key={i} className={cn("flex items-center justify-between gap-4 py-3.5 text-[16px]", item.selected === false && "opacity-40")}>
                  <span className="truncate text-white/60">{item.description}</span>
                  <span className="shrink-0 font-medium tabular-nums text-white">{fmt(item.amount)}</span>
                </div>
              ))}
          {!single && items.length > 5 && <p className="py-2.5 text-[13px] text-white/40">+{items.length - 5} itens</p>}
          {single && isOtherMonth(single.date) && (
            <p className="mt-2.5 flex items-start gap-1.5 rounded-[14px] bg-amber-300/10 px-3 py-2 text-[12px] leading-snug text-amber-200">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              Comprovante de outro mês: ele entra no histórico dessa data e não muda o saldo deste mês. Toque no lápis para alterar a data.
            </p>
          )}
        </div>
      ) : single ? (
        <div className="mt-2 divide-y divide-white/[0.06]">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[16px] text-white/60">Tipo</span>
            <div className="flex rounded-full bg-white/[0.06] p-0.5">
              {(["despesa", "receita"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update(0, { type: t })}
                  className={cn("h-8 rounded-full px-3.5 text-[13px] font-semibold", (isIncome ? "receita" : "despesa") === t ? "bg-white text-[#0B0B0B]" : "text-white/55")}
                >
                  {t === "despesa" ? "Despesa" : "Receita"}
                </button>
              ))}
            </div>
          </div>
          {single.merchant && (
            <label className="flex items-center justify-between gap-4 py-2.5">
              <span className="shrink-0 text-[16px] text-white/60">Descrição</span>
              <input value={single.description} onChange={(e) => update(0, { description: e.target.value })} className={inputCls} />
            </label>
          )}
          <div className="py-2.5">
            <button type="button" onClick={() => setPickingCategory((v) => !v)} className="flex w-full items-center justify-between">
              <span className="text-[16px] text-white/60">Categoria</span>
              <span className="flex items-center gap-1.5 text-[16px] font-medium text-white">
                <span className="h-2 w-2 rounded-full" style={{ background: getCategoryHexColor(single.category || "Outros") }} />
                {single.category || "Escolher"}
                <ChevronDown className={cn("h-4 w-4 text-white/40 transition-transform", pickingCategory && "rotate-180")} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {pickingCategory && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto pb-1">
                    {categoryOptions.map((cat) => {
                      const Icon = getCategoryIcon(cat);
                      const selected = cat === single.category;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => { update(0, { category: cat }); setPickingCategory(false); }}
                          className={cn(
                            "flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px]",
                            selected ? "border-white bg-white text-[#0B0B0B]" : "border-white/[0.08] bg-white/[0.04] text-white/80",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color: selected ? "#0B0B0B" : getCategoryHexColor(cat) }} />
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <label className="flex items-center justify-between gap-4 py-2.5">
            <span className="shrink-0 text-[16px] text-white/60">Data</span>
            <input type="date" value={single.date ?? ""} onChange={(e) => update(0, { date: e.target.value })} className={cn(inputCls, "[color-scheme:dark]")} />
          </label>
          {accounts.length > 0 && (
            <div className="py-2.5">
              <span className="text-[16px] text-white/60">Conta</span>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onAccountChange?.(a.id)}
                    className={cn(
                      "h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium",
                      a.id === accountId ? "border-white bg-white text-[#0B0B0B]" : "border-white/[0.08] bg-white/[0.04] text-white/80",
                    )}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 max-h-[34vh] divide-y divide-white/[0.06] overflow-y-auto">
          {items.map((item, i) => {
            const on = item.selected !== false;
            return (
              <div key={i} className={cn("flex items-center gap-3 py-2.5", !on && "opacity-40")}>
                <button
                  type="button"
                  onClick={() => update(i, { selected: !on })}
                  aria-label={on ? "Remover" : "Incluir"}
                  className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", on ? "border-white bg-white text-[#0B0B0B]" : "border-white/30")}
                >
                  {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </button>
                <input
                  value={item.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-white focus:outline-none"
                />
                <input
                  inputMode="numeric"
                  value={plain(item.amount)}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    update(i, { amount: digits ? Number(digits) / 100 : 0 });
                  }}
                  className="w-24 shrink-0 bg-transparent text-right text-[15px] font-semibold text-white tabular-nums focus:outline-none"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Total ── */}
      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-white/45">
            {single ? (isIncome ? "Receita" : "Despesa") : "Total"}
          </p>
          {editing && single ? (
            <label className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[15px] font-bold uppercase tracking-[0.1em] text-white/50">{currencySymbol()}</span>
              <input
                inputMode="numeric"
                value={plain(single.amount)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  update(0, { amount: digits ? Number(digits) / 100 : 0 });
                }}
                className="w-full min-w-0 bg-transparent text-[48px] font-extrabold leading-none tracking-tight text-white tabular-nums focus:outline-none"
                aria-label="Valor"
              />
            </label>
          ) : (
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[15px] font-bold uppercase tracking-[0.1em] text-white/50">{currencySymbol()}</span>
              <span className="truncate font-extrabold leading-none tracking-tight text-white tabular-nums" style={{ fontSize: totalSize }}>{plain(total)}</span>
            </p>
          )}
        </div>
      </div>

      <GlowButton variant="dark" className="mt-6" onClick={onConfirm} disabled={confirming || active.length === 0 || total <= 0}>
        {confirming && <Loader2 className="h-5 w-5 animate-spin" />}
        {confirmLabel ?? (single ? (isIncome ? "Confirmar receita" : "Confirmar gasto") : `Confirmar ${active.length}`)}
      </GlowButton>
    </div>
  );
}

export default ScanResultCard;
