import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarCheck, CalendarClock, Nfc } from "lucide-react";
import { toast } from "sonner";
import BottomSheet from "@/components/shared/BottomSheet";
import { useAuth } from "@/contexts/AuthContext";
import { createCreditCard } from "@/services/transactionService";
import { bankFor, PALETTE } from "@/lib/banks";
import { currencySymbol } from "@/lib/currency";
import { shade, withAlpha } from "@/components/wallet/CardFaceTile";
import { cn } from "@/lib/utils";
import { BankChips, ColorPicker, DayGrid, MoneyField, PillInput, SectionLabel, SheetAction } from "./sheetParts";

const LIMIT_CHIPS = [1000, 2000, 5000, 10000];
/** Most Brazilian cards come due about a week after closing. */
const DUE_GAP = 7;
const addDays = (day: number, n: number) => ((day - 1 + n) % 31) + 1;

/** The card itself, drawn from what's been typed so far. */
function CardPreview({ name, digits, limitCents, closing, due, hex, showDates }: {
  name: string;
  digits: string;
  limitCents: number;
  closing: number;
  due: number;
  hex: string;
  /** The dates only mean something once the second step has been reached. */
  showDates: boolean;
}) {
  return (
    <motion.div
      initial={{ rotateX: 18, y: 12, opacity: 0 }}
      animate={{ rotateX: 0, y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 18 }}
      className="relative mx-auto w-full max-w-[340px] overflow-hidden rounded-[22px] border border-white/[0.10] p-5 text-white"
      style={{
        aspectRatio: "1.586",
        transformPerspective: 900,
        boxShadow: `0 26px 56px -22px ${withAlpha(hex, 0.55)}, 0 10px 30px -16px rgb(0 0 0 / 0.9)`,
      }}
    >
      <motion.div
        className="absolute inset-0"
        animate={{
          background: `radial-gradient(130% 140% at 0% 0%, ${shade(hex, 0.16)} 0%, ${hex} 32%, #141416 78%)`,
        }}
        transition={{ duration: 0.45 }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 9px)" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.16)_0%,transparent_40%)]" />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <p className={cn("truncate text-[17px] font-bold tracking-tight", !name.trim() && "text-white/62")}>
            {name.trim() || "Seu cartão"}
          </p>
          <Nfc className="h-6 w-6 shrink-0 text-white/80" />
        </div>
        <span className="mt-3 h-8 w-11 rounded-[7px] bg-gradient-to-br from-[#e6d4a0] via-[#c9ab62] to-[#9c7c3c] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]" />
        <p className="mt-auto font-mono text-[16px] tracking-[0.2em] text-white/90">
          •••• •••• •••• {digits.padEnd(4, "•")}
        </p>
        <div className="mt-2 flex items-end justify-between text-[11px]">
          <span className="text-white/74">
            {showDates ? `Fecha ${closing} · Vence ${due}` : "Fechamento e vencimento"}
          </span>
          <span className="text-right">
            <span className="block text-white/66">Limite</span>
            <span className="text-[14px] font-bold tabular-nums">
              {limitCents > 0
                ? `${currencySymbol()} ${(limitCents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
                : "—"}
            </span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * "Novo cartão", in two halves.
 *
 * It used to be one long sheet you scrolled through, which asks you to hold the whole
 * form in your head while the card you are drawing scrolls off the top. So it is two
 * steps now: who the card is — bank, name, last four, colour — and then how it bills —
 * limit, closing, due. The card stays on screen through both, because it is the thing
 * being made, and each answer shows up on it immediately.
 */
const CardCreateSheet = ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) => {
  const { user } = useAuth();
  const nameRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const [limitCents, setLimitCents] = useState(0);
  const [closing, setClosing] = useState(10);
  const [due, setDue] = useState(17);
  const [dueTouched, setDueTouched] = useState(false);
  const [editing, setEditing] = useState<"closing" | "due" | null>(null);
  /* Stored as a hex, so a colour chosen by hand survives being named after a bank. */
  const [color, setColor] = useState(PALETTE[0].hex);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setName("");
    setDigits("");
    setLimitCents(0);
    setClosing(10);
    setDue(17);
    setDueTouched(false);
    setEditing(null);
    setColor(PALETTE[0].hex);
    setSaving(false);
  }, [open]);

  /* Changing step leaves the scroll where the last one ended, which lands you
     halfway down a shorter form with the card cut off above. */
  useLayoutEffect(() => {
    const box = bodyRef.current?.closest(".overflow-y-auto") as HTMLElement | null;
    box?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const bank = bankFor(name);
  const hex = color;
  const canAdvance = name.trim().length > 0;
  const canSave = canAdvance && limitCents > 0 && !saving;

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
          color,
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
          active ? "bg-white/[0.08]" : "border-white/[0.07] willo-glass-inset",
        )}
        style={active ? { borderColor: withAlpha(hex, 0.75) } : undefined}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: withAlpha(hex, active ? 0.26 : 0.14) }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: active ? "#fff" : withAlpha(hex, 0.95) }} />
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
      className="[background-color:rgba(17,17,20,0.74)] [backdrop-filter:blur(40px)_saturate(160%)] [-webkit-backdrop-filter:blur(40px)_saturate(160%)]"
      footer={
        step === 1 ? (
          <SheetAction onClick={() => setStep(2)} disabled={!canAdvance}>
            Avançar <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
          </SheetAction>
        ) : (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setStep(1)}
              aria-label="Voltar"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-white active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <SheetAction onClick={save} disabled={!canSave} loading={saving} loadingLabel="Cadastrando…">
              Cadastrar cartão
            </SheetAction>
          </div>
        )
      }
    >
      <div ref={bodyRef} className="relative px-5 pb-4">
        {/* The card's own light washing the sheet, so the panel is never plain grey */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[130%] -translate-x-1/2 rounded-full blur-[70px]"
          style={{ background: hex, opacity: 0.22 }}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[22px] font-bold tracking-tight text-white">Novo cartão</p>
            <p className="text-[14px] leading-snug text-white/62">
              {step === 1
                ? "Qual cartão é esse — banco, nome e os quatro finais."
                : "Com o fechamento e o vencimento, o Willo monta cada fatura sozinho."}
            </p>
          </div>
          {/* Two steps, shown as two marks rather than counted out in words */}
          <div className="mt-2 flex shrink-0 items-center gap-1.5">
            {[1, 2].map((n) => (
              <motion.span
                key={n}
                className="h-1.5 rounded-full"
                animate={{
                  width: step === n ? 20 : 8,
                  backgroundColor: step === n ? hex : "rgba(255,255,255,0.18)",
                }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            ))}
          </div>
        </div>

        <div className="relative mt-5">
          <CardPreview
            name={name}
            digits={digits}
            limitCents={limitCents}
            closing={closing}
            due={due}
            hex={hex}
            showDates={step === 2}
          />
        </div>

        {/* The step is clipped here rather than only at the sheet's edge, so the few
            pixels it travels never widen the scroll box in the first place. The
            negative margin puts this box's edge at the panel's, which is where the
            strip of banks is meant to run out to. */}
        <div className="-mx-5 overflow-hidden px-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: step === 2 ? 18 : -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: step === 2 ? -18 : 18 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {step === 1 ? (
              <>
                <SectionLabel>Banco</SectionLabel>
                <BankChips
                  selectedId={bank?.id ?? null}
                  onPick={(b) => { setName(b.name); setColor(b.hex); }}
                  onOther={() => { setName(""); nameRef.current?.focus(); }}
                />
                <div className="mt-2.5 grid grid-cols-[1fr_112px] gap-2">
                  <PillInput
                    ref={nameRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do cartão"
                    maxLength={40}
                  />
                  <PillInput
                    value={digits}
                    onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    placeholder="Final"
                    aria-label="4 últimos dígitos"
                    className="text-center font-mono tracking-[0.25em] placeholder:font-sans placeholder:tracking-normal"
                  />
                </div>

                <SectionLabel right={
                  bank ? <span className="text-[12px] t-softer">cor do {bank.name}</span> : undefined
                }>
                  Cor
                </SectionLabel>
                <ColorPicker value={color} onChange={setColor} />
                <p className="mt-3 px-1 text-[12px] leading-snug t-soft">
                  A cor aparece no cartão, no gráfico e na barra de limite. Dá para trocar
                  depois a qualquer momento.
                </p>
              </>
            ) : (
              <>
                <SectionLabel>Limite total</SectionLabel>
                <MoneyField cents={limitCents} onChange={setLimitCents} chips={LIMIT_CHIPS} />

                <SectionLabel>Datas da fatura</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  <DayButton kind="closing" label="Fecha" day={closing} icon={CalendarClock} />
                  <DayButton kind="due" label="Vence" day={due} icon={CalendarCheck} />
                </div>
                <AnimatePresence initial={false}>
                  {editing && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 rounded-[22px] border border-white/[0.08] willo-glass p-3">
                        <p className="mb-2 px-1 text-[12px] text-white/62">
                          {editing === "closing" ? "Dia em que a fatura fecha" : "Dia em que a fatura vence"}
                        </p>
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
                <p className="mt-2 px-1 text-[12px] leading-snug t-soft">
                  Compras feitas depois do dia {closing} entram na fatura seguinte. Confira as
                  datas no app do seu banco.
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
        </div>
      </div>
    </BottomSheet>
  );
};

export default CardCreateSheet;
