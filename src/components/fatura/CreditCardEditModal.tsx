import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CalendarCheck, CalendarClock, Check, Loader2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { currencySymbol } from "@/lib/currency";
import { ColorPicker, DayGrid, MoneyField, PillInput, SectionLabel, SheetAction } from "@/components/wallet/sheetParts";

interface Props {
  open: boolean;
  onClose: () => void;
  card: {
    id: string;
    name: string;
    closing_day: number;
    due_day: number;
    limit: number;
    color: string | null;
    last_four_digits: string | null;
  };
  onUpdated: () => void;
  onDeleted: () => void;
  /** Open on the delete confirmation, for when the hold menu already asked for Excluir. */
  startDeleting?: boolean;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DEFAULT_HEX = "#8B5CF6";

/** The card itself, redrawn as you type, so the edit shows what it is changing. */
function CardFace({ name, digits, limitCents, closing, due, hex }: {
  name: string;
  digits: string | null;
  limitCents: number;
  closing: number;
  due: number;
  hex: string;
}) {
  return (
    <div
      className="relative mx-auto aspect-[1.6/1] w-full max-w-[300px] overflow-hidden rounded-[22px] border border-white/[0.08] p-4 text-white shadow-[0_24px_50px_-18px_rgba(0,0,0,0.9)]"
      style={{ background: `linear-gradient(145deg, ${hex} 0%, rgba(10,10,12,0.92) 78%)` }}
    >
      <span className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/[0.14] blur-[40px]" />
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/25" />
      <div className="relative flex h-full flex-col">
        <p className={cn("truncate text-[16px] font-bold tracking-tight", !name.trim() && "text-white/62")}>
          {name.trim() || "Seu cartão"}
        </p>
        <span className="mt-2.5 h-7 w-10 rounded-[6px] bg-gradient-to-br from-[#e6d4a0] via-[#c9ab62] to-[#9c7c3c] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]" />
        <p className="mt-auto font-mono text-[14px] tracking-[0.2em] text-white/90">
          •••• •••• •••• {digits || "••••"}
        </p>
        <div className="mt-2 flex items-end justify-between text-[10.5px]">
          <span className="text-white/70">Fecha {closing} · Vence {due}</span>
          <span className="text-right">
            <span className="block text-white/70">Limite</span>
            <span className="text-[13px] font-bold tabular-nums">
              {currencySymbol()} {fmt(limitCents / 100)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CreditCardEditModal({ open, onClose, card, onUpdated, onDeleted, startDeleting = false }: Props) {
  const [name, setName] = useState(card.name);
  const [closingDay, setClosingDay] = useState(card.closing_day);
  const [dueDay, setDueDay] = useState(card.due_day);
  const [limitCents, setLimitCents] = useState(Math.round(card.limit * 100));
  const [color, setColor] = useState(card.color ?? DEFAULT_HEX);
  const [editingDay, setEditingDay] = useState<"closing" | "due" | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(startDeleting);
  const [deleting, setDeleting] = useState(false);
  /** How much of the limit is committed. The floor for any decrease. */
  const [usedLimit, setUsedLimit] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(card.name);
    setClosingDay(card.closing_day);
    setDueDay(card.due_day);
    setLimitCents(Math.round(card.limit * 100));
    setColor(card.color ?? DEFAULT_HEX);
    setEditingDay(null);
    setShowDeleteConfirm(startDeleting);
  }, [open, card, startDeleting]);

  // Read the used limit up front rather than at save time, so the rule can be shown while
  // the number is being chosen instead of refusing it afterwards.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("credit_cards")
        .select("used_limit")
        .eq("id", card.id)
        .single();
      if (alive) setUsedLimit(Number((data as any)?.used_limit ?? 0));
    })();
    return () => { alive = false; };
  }, [open, card.id]);

  const limit = limitCents / 100;
  const floor = usedLimit ?? 0;
  const belowUsed = usedLimit !== null && limit < floor;
  const delta = Math.round((limit - card.limit) * 100) / 100;
  const dirty =
    name.trim() !== card.name ||
    closingDay !== card.closing_day ||
    dueDay !== card.due_day ||
    Math.abs(delta) > 0.004 ||
    color !== (card.color ?? DEFAULT_HEX);

  const chips = useMemo(() => {
    const base = [1000, 2000, 5000, 10000];
    const here = Math.round(card.limit);
    return here > 0 && !base.includes(here) ? [here, ...base].sort((a, b) => a - b).slice(0, 5) : base;
  }, [card.limit]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("O cartão precisa de um nome"); return; }
    if (belowUsed) {
      toast.error(
        `Você já usou ${currencySymbol()} ${fmt(floor)} deste cartão. Pague as faturas em aberto para liberar limite antes de diminuir.`,
      );
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("credit_cards")
        .update({
          name: name.trim(),
          closing_day: closingDay,
          due_day: dueDay,
          limit,
          color,
        } as any)
        .eq("id", card.id);

      if (error) throw error;

      const parts = ["Cartão atualizado."];
      if (closingDay !== card.closing_day || dueDay !== card.due_day) {
        parts.push("As datas novas valem a partir da próxima fatura.");
      }
      toast.success(parts.join(" "));
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível salvar o cartão");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("id")
        .eq("credit_card_id", card.id) as any;

      if (invoicesData && invoicesData.length > 0) {
        const invoiceIds = invoicesData.map((i: any) => i.id);
        await supabase.from("invoice_items").delete().in("invoice_id", invoiceIds) as any;
        await supabase.from("invoices").delete().eq("credit_card_id", card.id) as any;
      }

      await supabase.from("transactions").delete().eq("credit_card_id", card.id);

      const { error } = await supabase.from("credit_cards").delete().eq("id", card.id);
      if (error) throw error;

      toast.success("Cartão excluído.");
      onDeleted();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível excluir o cartão");
    } finally {
      setDeleting(false);
    }
  };

  const DayCard = ({ kind, label, day, icon: Icon }: {
    kind: "closing" | "due";
    label: string;
    day: number;
    icon: typeof CalendarClock;
  }) => {
    const active = editingDay === kind;
    return (
      <button
        type="button"
        onClick={() => setEditingDay(active ? null : kind)}
        className={cn(
          "flex items-center gap-3 rounded-[20px] border p-3.5 text-left transition-colors",
          active ? "border-white bg-white/[0.08]" : "border-white/[0.06] willo-glass-inset",
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.07]">
          <Icon className="h-[17px] w-[17px] text-white/80" strokeWidth={2.1} />
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] text-white/62">{label}</span>
          <span className="block text-[17px] font-bold text-white">Dia {day}</span>
        </span>
      </button>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[72] flex items-center justify-center bg-black/66 px-5 backdrop-blur-[20px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[86dvh] w-full max-w-md flex-col overflow-hidden rounded-[30px] border border-white/[0.08] willo-glass-strong shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)]"
          >
            <div className="flex shrink-0 items-center justify-between px-5 pt-5">
              <p className="text-[17px] font-bold text-white">Editar cartão</p>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/70 active:opacity-60"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 scrollbar-none">
              <div className="mt-4">
                <CardFace
                  name={name}
                  digits={card.last_four_digits}
                  limitCents={limitCents}
                  closing={closingDay}
                  due={dueDay}
                  hex={color}
                />
              </div>

              <SectionLabel>Nome</SectionLabel>
              <PillInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nubank" />

              <SectionLabel
                right={
                  usedLimit !== null ? (
                    <span className="text-[12.5px] tabular-nums text-white/50">
                      {currencySymbol()} {fmt(floor)} em uso
                    </span>
                  ) : undefined
                }
              >
                Limite total
              </SectionLabel>
              <MoneyField cents={limitCents} onChange={setLimitCents} chips={chips}>
                {/* Say what the change does while it is being made. Refusing a number only at
                    save time hides the one fact that decides it: what is already used. */}
                <AnimatePresence mode="wait">
                  {belowUsed ? (
                    <motion.div
                      key="below"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 flex items-start gap-2 rounded-[16px] border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2.5"
                    >
                      <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-amber-300" />
                      <span className="text-[12.5px] leading-snug text-white/80">
                        Você já usou {currencySymbol()} {fmt(floor)}. Pague as faturas em aberto para liberar limite antes de diminuir.
                      </span>
                    </motion.div>
                  ) : Math.abs(delta) > 0.004 ? (
                    <motion.p
                      key="delta"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 text-center text-[12.5px] text-white/55"
                    >
                      {delta > 0 ? "Aumento de " : "Redução de "}
                      <span className="font-semibold tabular-nums text-white/80">
                        {currencySymbol()} {fmt(Math.abs(delta))}
                      </span>
                      {usedLimit !== null && (
                        <>
                          {". Disponível fica em "}
                          <span className="font-semibold tabular-nums text-white/80">
                            {currencySymbol()} {fmt(Math.max(limit - floor, 0))}
                          </span>
                        </>
                      )}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </MoneyField>

              <SectionLabel>Datas da fatura</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5">
                <DayCard kind="closing" label="Fecha" day={closingDay} icon={CalendarClock} />
                <DayCard kind="due" label="Vence" day={dueDay} icon={CalendarCheck} />
              </div>
              <AnimatePresence initial={false}>
                {editingDay && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 rounded-[22px] border border-white/[0.08] willo-glass p-3">
                      <p className="mb-2 px-1 text-[12px] text-white/62">
                        {editingDay === "closing" ? "Dia em que a fatura fecha" : "Dia em que a fatura vence"}
                      </p>
                      <DayGrid
                        value={editingDay === "closing" ? closingDay : dueDay}
                        onChange={(d) => (editingDay === "closing" ? setClosingDay(d) : setDueDay(d))}
                        mark={editingDay === "closing" ? dueDay : closingDay}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <p className="mt-2 px-1 text-[12px] leading-snug text-white/50">
                As datas novas valem a partir da próxima fatura. A atual continua como está.
              </p>

              <SectionLabel>Cor</SectionLabel>
              <ColorPicker value={color} onChange={setColor} />

              <AnimatePresence initial={false}>
                {showDeleteConfirm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 rounded-[22px] border border-red-400/20 bg-red-400/[0.07] p-4">
                      <p className="text-[15px] font-bold text-white">Excluir {card.name}?</p>
                      <p className="mt-1.5 text-[13px] leading-snug text-white/65">
                        Saem junto todas as faturas e todos os lançamentos deste cartão. Não dá para desfazer.
                      </p>
                      <div className="mt-3.5 flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="h-12 flex-1 rounded-full border border-white/[0.1] bg-white/[0.04] text-[14.5px] font-semibold text-white/80 active:opacity-70"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-red-400 text-[14.5px] font-bold text-[#0B0B0B] active:opacity-80 disabled:opacity-50"
                        >
                          {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Excluindo</> : "Excluir"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="shrink-0 border-t border-white/[0.06] willo-glass-strong px-5 pb-4 pt-3">
              <SheetAction onClick={handleSave} loading={saving} loadingLabel="Salvando" disabled={!dirty || belowUsed}>
                <Check className="h-[18px] w-[18px]" strokeWidth={2.6} /> Salvar alterações
              </SheetAction>
              {!showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-red-400 active:opacity-60"
                >
                  <Trash2 className="h-[16px] w-[16px]" strokeWidth={2.2} /> Excluir cartão
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
