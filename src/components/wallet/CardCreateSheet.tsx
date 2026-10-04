import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, CalendarClock, Nfc } from "lucide-react";
import { toast } from "sonner";
import BottomSheet from "@/components/shared/BottomSheet";
import { useAuth } from "@/contexts/AuthContext";
import { createCreditCard } from "@/services/transactionService";
import { bankFor, colorFor } from "@/lib/banks";
import { currencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { BankChips, ColorPicker, DayGrid, MoneyField, PillInput, SectionLabel, SheetAction } from "./sheetParts";

const LIMIT_CHIPS = [1000, 2000, 5000, 10000];
/** Most Brazilian cards come due about a week after closing. */
const DUE_GAP = 7;
const addDays = (day: number, n: number) => ((day - 1 + n) % 31) + 1;

/** The card itself, drawn from what's been typed so far. */
function CardPreview({ name, digits, limitCents, closing, due, hex }: { name: string; digits: string; limitCents: number; closing: number; due: number; hex: string }) {
  return (
    <motion.div
      initial={{ rotateX: 18, y: 12, opacity: 0 }}
      animate={{ rotateX: 0, y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 18 }}
      className="relative mx-auto w-full max-w-[340px] overflow-hidden rounded-[22px] border border-white/[0.08] p-5 text-white shadow-[0_24px_50px_-18px_rgba(0,0,0,0.9)]"
      style={{ aspectRatio: "1.586", transformPerspective: 900 }}
    >
      <motion.div className="absolute inset-0" animate={{ background: `radial-gradient(130% 140% at 0% 0%, ${hex} 0%, ${hex}AA 28%, #161616 72%)` }} transition={{ duration: 0.45 }} />
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 9px)" }} />
      <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.14)_0%,transparent_38%)]" />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <p className={cn("truncate text-[17px] font-bold tracking-tight", !name.trim() && "text-white/62")}>{name.trim() || "Seu cartão"}</p>
          <Nfc className="h-6 w-6 shrink-0 text-white/80" />
        </div>
        <span className="mt-3 h-8 w-11 rounded-[7px] bg-gradient-to-br from-[#e6d4a0] via-[#c9ab62] to-[#9c7c3c] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]" />
        <p className="mt-auto font-mono text-[16px] tracking-[0.2em] text-white/90">
          •••• •••• •••• {digits.padEnd(4, "•")}
        </p>
        <div className="mt-2 flex items-end justify-between text-[11px]">
          <span className="text-white/74">Fecha {closing} · Vence {due}</span>
          <span className="text-right">
            <span className="block text-white/66">Limite</span>
            <span className="text-[14px] font-bold tabular-nums">
              {currencySymbol()} {(limitCents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * "Novo cartão": the card drawn live as it's filled in, common banks one tap
 * away, the limit, and closing/due days on a calendar grid.
 */
const CardCreateSheet = ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) => {
  const { user } = useAuth();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const [limitCents, setLimitCents] = useState(0);
  const [closing, setClosing] = useState(10);
  const [due, setDue] = useState(17);
  const [dueTouched, setDueTouched] = useState(false);
  const [editing, setEditing] = useState<"closing" | "due" | null>(null);
  const [color, setColor] = useState("violet");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDigits("");
    setLimitCents(0);
    setClosing(10);
    setDue(17);
    setDueTouched(false);
    setEditing(null);
    setColor("violet");
    setSaving(false);
  }, [open]);

  const bank = bankFor(name);
  const hex = colorFor(name, color, "#3A3A3F");
  const canSave = name.trim().length > 0 && limitCents > 0 && !saving;

  const pickClosing = (d: number) => {
    setClosing(d);
    if (!dueTouched) setDue(addDays(d, DUE_GAP));
  };

  const save = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      await createCreditCard(
        {
          name: name.trim(),
          limit: limitCents / 100,
          closing_day: closing,
          due_day: due,
          color: bank?.accent ?? color,
          last_four_digits: digits.length === 4 ? digits : null,
        },
        user.id,
      );
      toast.success("Cartão cadastrado!");
      onCreated?.();
      onClose();
    } catch {
      toast.error("Não foi possível cadastrar o cartão");
      setSaving(false);
    }
  };

  const DayButton = ({ kind, label, day, icon: Icon }: { kind: "closing" | "due"; label: string; day: number; icon: typeof CalendarClock }) => {
    const active = editing === kind;
    return (
      <button
        type="button"
        onClick={() => setEditing(active ? null : kind)}
        className={cn(
          "flex items-center gap-3 rounded-[20px] border p-3.5 text-left transition-colors",
          active ? "border-white bg-white/[0.08]" : "border-white/[0.06] willo-glass-inset",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.07]">
          <Icon className="h-[18px] w-[18px] text-white/80" />
        </span>
        <span>
          <span className="block text-[12px] text-white/62">{label}</span>
          <span className="block text-[17px] font-bold text-white">Dia {day}</span>
        </span>
      </button>
    );
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      size="full"
      footer={<SheetAction onClick={save} disabled={!canSave} loading={saving} loadingLabel="Cadastrando…">Cadastrar cartão</SheetAction>}
    >
      <div className="px-5 pb-4">
        <p className="text-[22px] font-bold tracking-tight text-white">Novo cartão</p>
        <p className="text-[14px] leading-snug text-white/62">Com o fechamento e o vencimento, o Willo monta cada fatura sozinho.</p>

        <div className="mt-5">
          <CardPreview name={name} digits={digits} limitCents={limitCents} closing={closing} due={due} hex={hex} />
        </div>

        <SectionLabel>Banco</SectionLabel>
        <BankChips
          selectedId={bank?.id ?? null}
          onPick={(b) => setName(b.name)}
          onOther={() => { setName(""); nameRef.current?.focus(); }}
        />
        <div className="mt-2.5 grid grid-cols-[1fr_112px] gap-2">
          <PillInput ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cartão" maxLength={40} />
          <PillInput
            value={digits}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="Final"
            aria-label="4 últimos dígitos"
            className="text-center font-mono tracking-[0.25em] placeholder:font-sans placeholder:tracking-normal"
          />
        </div>

        <SectionLabel>Limite total</SectionLabel>
        <MoneyField cents={limitCents} onChange={setLimitCents} chips={LIMIT_CHIPS} />

        <SectionLabel>Datas da fatura</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <DayButton kind="closing" label="Fecha" day={closing} icon={CalendarClock} />
          <DayButton kind="due" label="Vence" day={due} icon={CalendarCheck} />
        </div>
        <AnimatePresence initial={false}>
          {editing && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 rounded-[22px] border border-white/[0.08] willo-glass p-3">
                <p className="mb-2 px-1 text-[12px] text-white/62">{editing === "closing" ? "Dia em que a fatura fecha" : "Dia em que a fatura vence"}</p>
                <DayGrid
                  value={editing === "closing" ? closing : due}
                  mark={editing === "closing" ? due : closing}
                  onChange={(d) => {
                    if (editing === "closing") pickClosing(d);
                    else { setDue(d); setDueTouched(true); }
                    setEditing(null);
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mt-2 px-1 text-[12px] leading-snug text-white/50">
          Compras feitas depois do dia {closing} entram na fatura seguinte. Confira as datas no app do seu banco.
        </p>

        {bank ? (
          <p className="mt-6 flex items-center gap-2 px-1 text-[13px] text-white/62">
            <span className="h-3 w-3 rounded-full" style={{ background: bank.hex }} /> Cor do banco aplicada automaticamente
          </p>
        ) : (
          <>
            <SectionLabel>Cor</SectionLabel>
            <ColorPicker value={color} onChange={setColor} />
          </>
        )}
      </div>
    </BottomSheet>
  );
};

export default CardCreateSheet;
