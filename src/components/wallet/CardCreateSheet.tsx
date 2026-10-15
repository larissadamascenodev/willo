import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CalendarCheck, CalendarClock, Loader2, Nfc, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { createCreditCard } from "@/services/transactionService";
import { bankFor, PALETTE } from "@/lib/banks";
import { currencySymbol } from "@/lib/currency";
import { shade, withAlpha } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { BankChips, ColorPicker, DayGrid, PillInput } from "./sheetParts";

const LIMIT_CHIPS = [1000, 2000, 5000, 10000];
/** Most Brazilian cards come due about a week after closing. */
const DUE_GAP = 7;
const addDays = (day: number, n: number) => ((day - 1 + n) % 31) + 1;

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 mt-4 px-1 text-[12.5px] font-semibold text-white/62">{children}</p>
);

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
    <div
      className="relative mx-auto w-full max-w-[262px] overflow-hidden rounded-[20px] border border-white/[0.10] p-4 text-white"
      style={{
        aspectRatio: "1.586",
        boxShadow: `0 22px 48px -22px ${withAlpha(hex, 0.55)}, 0 8px 24px -16px rgb(0 0 0 / 0.9)`,
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
        <div className="flex items-start justify-between gap-2">
          <p className={cn("truncate text-[14px] font-bold tracking-tight", !name.trim() && "text-white/62")}>
            {name.trim() || "Seu cartão"}
          </p>
          <Nfc className="h-5 w-5 shrink-0 text-white/80" />
        </div>
        <span className="mt-2 h-6 w-9 rounded-[6px] bg-gradient-to-br from-[#e6d4a0] via-[#c9ab62] to-[#9c7c3c] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]" />
        <p className="mt-auto font-mono text-[13px] tracking-[0.18em] text-white/90">
          •••• •••• •••• {digits.padEnd(4, "•")}
        </p>
        <div className="mt-1.5 flex items-end justify-between text-[10px]">
          <span className="text-white/74">
            {showDates ? `Fecha ${closing} · Vence ${due}` : "Fechamento e vencimento"}
          </span>
          <span className="text-right">
            <span className="block text-white/66">Limite</span>
            <span className="text-[12px] font-bold tabular-nums">
              {limitCents > 0
                ? `${currencySymbol()} ${(limitCents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
                : "—"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * "Novo cartão", in two halves, on one screen.
 *
 * It fits where it stands: nothing here scrolls, in any direction. A form you have to
 * drag around while the card you are drawing slides out of view is a form filled in
 * half-blind — and a panel taller than the screen is what sat off-centre and could be
 * pulled sideways. So it is two steps that fit, and the only thing that ever moves is
 * one step giving way to the next.
 *
 * The day picker takes the step's place rather than opening below it, for the same
 * reason: thirty-one buttons cannot appear inside a panel that is already full.
 */
const CardCreateSheet = ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) => {
  const { user } = useAuth();
  const nameRef = useRef<HTMLInputElement>(null);
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

  useScrollLock(open);

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

  const DayButton = ({ kind, label, day, icon: Icon }: { kind: "closing" | "due"; label: string; day: number; icon: typeof CalendarClock }) => (
    <button
      type="button"
      onClick={() => setEditing(kind)}
      className="flex items-center gap-2.5 rounded-[18px] border border-white/[0.07] willo-glass-inset p-3 text-left active:scale-[0.99]"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: withAlpha(hex, 0.16) }}
      >
        <Icon className="h-4 w-4" style={{ color: shade(hex, 0.4) }} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11.5px] text-white/62">{label}</span>
        <span className="block text-[15px] font-bold text-white">Dia {day}</span>
      </span>
    </button>
  );

  /** What the body is showing: a step, or the day picker standing in its place. */
  const view = editing ?? `step${step}`;

  const content = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[72] flex items-center justify-center px-4">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[16px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="relative flex w-full max-w-md flex-col overflow-hidden rounded-[30px] border border-white/[0.10]"
            style={{
              maxHeight: "92dvh",
              background: "rgba(18, 18, 21, 0.72)",
              backdropFilter: "blur(38px) saturate(150%)",
              WebkitBackdropFilter: "blur(38px) saturate(150%)",
              boxShadow: "0 40px 90px -30px rgb(0 0 0 / 0.95), inset 0 1px 0 rgb(255 255 255 / 0.10)",
            }}
          >
            {/* The card's own light, inside the glass */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-20 -top-24 h-64 w-[150%] rounded-full blur-[70px]"
              style={{ background: hex, opacity: 0.26 }}
            />

            {/* ── Header ── */}
            <div className="relative flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
              <div className="min-w-0">
                <p className="text-[21px] font-bold tracking-tight text-white">
                  {editing
                    ? editing === "closing" ? "Fecha no dia" : "Vence no dia"
                    : "Novo cartão"}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-white/60">
                  {editing
                    ? editing === "closing"
                      ? "O dia em que a fatura fecha."
                      : "O dia em que a fatura vence."
                    : step === 1
                      ? "Banco, nome e os quatro finais."
                      : "Limite e as datas da fatura."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!editing && (
                  <div className="flex items-center gap-1.5">
                    {[1, 2].map((n) => (
                      <motion.span
                        key={n}
                        className="h-1.5 rounded-full"
                        animate={{
                          width: step === n ? 18 : 7,
                          backgroundColor: step === n ? hex : "rgba(255,255,255,0.18)",
                        }}
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={editing ? () => setEditing(null) : onClose}
                  aria-label={editing ? "Voltar" : "Fechar"}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-white/74 active:opacity-60"
                >
                  {editing ? <ArrowLeft className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* ── The card, except while a day is being picked ── */}
            {!editing && (
              <div className="relative shrink-0 px-5 pt-4">
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
            )}

            {/* ── The step. Clipped on both axes: nothing here is draggable. ── */}
            {/* Sideways is clipped; vertically it only ever moves on a phone small
                enough that the step genuinely cannot fit, which is better than
                cutting the last field off. On a normal screen nothing overflows,
                so nothing scrolls. */}
            <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-1 scrollbar-none">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={view}
                  initial={{ opacity: 0, x: view === "step1" ? -16 : 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {editing ? (
                    <div className="pt-2">
                      <DayGrid
                        value={editing === "closing" ? closing : due}
                        mark={editing === "closing" ? due : closing}
                        onChange={(d) => {
                          if (editing === "closing") pickClosing(d);
                          else { setDue(d); setDueTouched(true); }
                          setEditing(null);
                        }}
                      />
                      <p className="mt-3 px-1 text-[11.5px] leading-snug t-soft">
                        Compras feitas depois do fechamento entram na fatura seguinte.
                      </p>
                    </div>
                  ) : step === 1 ? (
                    <>
                      <Label>Banco</Label>
                      <BankChips
                        selectedId={bank?.id ?? null}
                        onPick={(b) => { setName(b.name); setColor(b.hex); }}
                        onOther={() => { setName(""); nameRef.current?.focus(); }}
                      />
                      <div className="mt-2.5 grid grid-cols-[1fr_104px] gap-2">
                        <PillInput
                          ref={nameRef}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Nome do cartão"
                          maxLength={40}
                          className="h-11"
                        />
                        <PillInput
                          value={digits}
                          onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          inputMode="numeric"
                          placeholder="Final"
                          aria-label="4 últimos dígitos"
                          className="h-11 text-center font-mono tracking-[0.25em] placeholder:font-sans placeholder:tracking-normal"
                        />
                      </div>

                      <Label>Cor</Label>
                      <ColorPicker value={color} onChange={setColor} />
                    </>
                  ) : (
                    <>
                      <Label>Limite total</Label>
                      <div className="rounded-[20px] border border-white/[0.08] willo-glass px-4 py-3.5">
                        <label className="relative mx-auto flex w-fit items-baseline gap-1.5">
                          <span className="text-[16px] font-bold t-soft">{currencySymbol()}</span>
                          <span className={cn(
                            "text-[32px] font-extrabold leading-none tracking-tight tabular-nums",
                            limitCents === 0 ? "t-softer" : "text-white",
                          )}>
                            {(limitCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <input
                            inputMode="numeric"
                            value={limitCents === 0 ? "" : String(limitCents)}
                            onChange={(e) =>
                              setLimitCents(Math.min(Number(e.target.value.replace(/\D/g, "").slice(0, 10) || "0"), 9999999999))
                            }
                            aria-label="Limite"
                            className="absolute inset-0 w-full cursor-text opacity-0"
                          />
                        </label>
                        <div className="mt-3 flex justify-center gap-2">
                          {LIMIT_CHIPS.map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setLimitCents(v * 100)}
                              className={cn(
                                "rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                                limitCents === v * 100 ? "willo-invert" : "bg-white/[0.06] text-white/74",
                              )}
                            >
                              {v / 1000} mil
                            </button>
                          ))}
                        </div>
                      </div>

                      <Label>Datas da fatura</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <DayButton kind="closing" label="Fecha" day={closing} icon={CalendarClock} />
                        <DayButton kind="due" label="Vence" day={due} icon={CalendarCheck} />
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Action ── */}
            {!editing && (
              <div
                className="relative shrink-0 px-5 pt-3"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
              >
                <div className="flex gap-2.5">
                  {step === 2 && (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      aria-label="Voltar"
                      className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-white active:scale-95"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={step === 1 ? () => setStep(2) : save}
                    disabled={step === 1 ? !canAdvance : !canSave}
                    className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-white text-[15.5px] font-bold text-[#0B0B0B] transition-opacity active:scale-[0.99] disabled:opacity-40"
                  >
                    {step === 1 ? (
                      <>Avançar <ArrowRight className="h-4 w-4" strokeWidth={2.6} /></>
                    ) : saving ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Cadastrando…</>
                    ) : (
                      "Cadastrar cartão"
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
};

export default CardCreateSheet;
