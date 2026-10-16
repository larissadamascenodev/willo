import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Banknote, Landmark, Loader2, PiggyBank, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import { createAccount } from "@/services/transactionService";
import { bankFor, initials, PALETTE } from "@/lib/banks";
import { currencySymbol } from "@/lib/currency";
import { shade, withAlpha } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { BankChips, ColorPicker, PillInput } from "./sheetParts";

type AccountType = "checking" | "savings" | "cash";

const TYPES: { value: AccountType; label: string; icon: typeof Landmark }[] = [
  { value: "checking", label: "Corrente", icon: Landmark },
  { value: "savings", label: "Poupança", icon: PiggyBank },
  { value: "cash", label: "Dinheiro", icon: Banknote },
];

const plain = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 mt-4 px-1 text-[12.5px] font-semibold text-white/62">{children}</p>
);

/**
 * "Nova conta", built like "Novo cartão": two steps that fit the screen, nothing
 * scrolling in any direction, the thing being made drawn above the form so every
 * answer lands on it as you type.
 *
 * First who the account is — bank, name, type, colour — then what is in it, which is
 * the one number that has to be right on the day it is created.
 */
const AccountCreateSheet = ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) => {
  const { user } = useAuth();
  const nameRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [cents, setCents] = useState(0);
  const [negative, setNegative] = useState(false);
  /* Stored as a hex, so a colour chosen by hand survives being named after a bank. */
  const [color, setColor] = useState(PALETTE[0].hex);
  const [saving, setSaving] = useState(false);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setName("");
    setType("checking");
    setCents(0);
    setNegative(false);
    setColor(PALETTE[0].hex);
    setSaving(false);
  }, [open]);

  const bank = bankFor(name);
  const hex = color;
  const typeInfo = TYPES.find((t) => t.value === type)!;
  const TypeIcon = typeInfo.icon;
  const canAdvance = name.trim().length > 0;
  const canSave = canAdvance && !saving;

  const pickType = (t: AccountType) => {
    setType(t);
    if (t === "cash" && !name.trim()) setName("Carteira");
  };

  const save = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      await createAccount(user.id, {
        name: name.trim(),
        type,
        initial_balance: (negative ? -cents : cents) / 100,
        color,
      });
      toast.success("Conta criada!");
      onCreated?.();
      onClose();
    } catch {
      toast.error("Não foi possível criar a conta");
      setSaving(false);
    }
  };

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
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-12 top-0 z-10 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)" }}
            />
            {/* The account's own light, inside the glass */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-20 -top-28 h-56 w-[150%] rounded-full blur-[72px]"
              style={{ background: hex, opacity: 0.17 }}
            />

            {/* ── Header ── */}
            <div className="relative flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
              <div className="min-w-0">
                <p className="text-[21px] font-bold tracking-tight text-white">Nova conta</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-white/60">
                  {step === 1 ? "Banco, nome e tipo da conta." : "Quanto tem nela hoje."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="flex h-1.5 w-[34px] overflow-hidden rounded-full bg-white/[0.14]">
                  <motion.span
                    className="h-full rounded-full"
                    style={{ background: shade(hex, 0.3) }}
                    animate={{ width: step === 1 ? "50%" : "100%" }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-white/74 active:opacity-60"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── The account, drawn as it is filled in ── */}
            <div className="relative shrink-0 px-5 pt-4">
              <div className="relative overflow-hidden rounded-[22px] border border-white/[0.09] bg-white/[0.045] p-4">
                <motion.span
                  className="pointer-events-none absolute -left-14 -top-20 h-44 w-44 rounded-full blur-[56px]"
                  animate={{ background: hex, opacity: 0.32 }}
                  transition={{ duration: 0.4 }}
                />
                <div className="relative flex items-center gap-3.5">
                  <motion.span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[14px] font-extrabold text-white"
                    animate={{ background: hex }}
                    transition={{ duration: 0.3 }}
                    style={{ boxShadow: `0 10px 22px -12px ${hex}` }}
                  >
                    {name.trim() ? initials(bank?.name ?? name) : <TypeIcon className="h-5 w-5" />}
                  </motion.span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[16px] font-bold", name.trim() ? "text-white" : "t-softer")}>
                      {name.trim() || "Nome da conta"}
                    </p>
                    <p className="truncate text-[12px] t-softer">{typeInfo.label}</p>
                  </div>
                </div>
                <p className={cn(
                  "relative mt-3.5 text-[26px] font-extrabold leading-none tracking-[-0.03em] tabular-nums",
                  negative && cents > 0 ? "text-red-400" : cents > 0 ? "text-white" : "t-softer",
                )}>
                  {negative && cents > 0 ? "−" : ""}{currencySymbol()} {plain(cents)}
                </p>
              </div>
            </div>

            {/* ── The step. Clipped sideways: nothing here is draggable. ── */}
            <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-1 scrollbar-none">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: step === 1 ? -16 : 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {step === 1 ? (
                    <>
                      <Label>Banco</Label>
                      <BankChips
                        selectedId={bank?.id ?? null}
                        onPick={(b) => { setName(b.name); setColor(b.hex); }}
                        onOther={() => { setName(""); nameRef.current?.focus(); }}
                      />
                      <PillInput
                        ref={nameRef}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nome da conta"
                        maxLength={40}
                        className="mt-2.5 h-11"
                      />

                      <Label>Tipo</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {TYPES.map(({ value, label, icon: Icon }) => {
                          const selected = type === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => pickType(value)}
                              className={cn(
                                "flex flex-col items-center gap-1.5 rounded-[18px] border px-2 py-2.5 transition-colors",
                                selected ? "bg-white/[0.08]" : "border-white/[0.07] willo-glass-inset",
                              )}
                              style={selected ? { borderColor: withAlpha(hex, 0.8) } : undefined}
                            >
                              <Icon
                                className="h-[18px] w-[18px]"
                                style={{ color: selected ? shade(hex, 0.45) : "rgb(255 255 255 / 0.6)" }}
                              />
                              <span className={cn("text-[12px]", selected ? "text-white" : "text-white/74")}>
                                {label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <Label>Cor</Label>
                      <ColorPicker value={color} onChange={setColor} />
                    </>
                  ) : (
                    <>
                      <Label>Saldo de hoje</Label>
                      <div className="rounded-[20px] border border-white/[0.08] willo-glass px-4 py-3.5">
                        <label className="relative mx-auto flex w-fit items-baseline gap-1.5">
                          <span className="text-[16px] font-bold t-soft">
                            {negative ? `−${currencySymbol()}` : currencySymbol()}
                          </span>
                          <span className={cn(
                            "text-[32px] font-extrabold leading-none tracking-tight tabular-nums",
                            cents === 0 ? "t-softer" : negative ? "text-red-400" : "text-white",
                          )}>
                            {plain(cents)}
                          </span>
                          <input
                            inputMode="numeric"
                            value={cents === 0 ? "" : String(cents)}
                            onChange={(e) =>
                              setCents(Math.min(Number(e.target.value.replace(/\D/g, "").slice(0, 10) || "0"), 9999999999))
                            }
                            aria-label="Saldo"
                            className="absolute inset-0 w-full cursor-text opacity-0"
                          />
                        </label>

                        <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
                          <span className="text-[12.5px] text-white/66">Está no negativo</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={negative}
                            onClick={() => setNegative((v) => !v)}
                            className={cn(
                              "relative h-7 w-12 rounded-full transition-colors",
                              negative ? "bg-red-400" : "bg-white/15",
                            )}
                          >
                            <motion.span
                              className="absolute top-1 h-5 w-5 rounded-full bg-white"
                              animate={{ left: negative ? 24 : 4 }}
                              transition={{ type: "spring", stiffness: 500, damping: 32 }}
                            />
                          </button>
                        </div>
                      </div>

                      <p className="mt-3 px-1 text-[11.5px] leading-snug t-soft">
                        Use o saldo que aparece no app do banco agora. A partir daqui, o Willo acompanha.
                      </p>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Action ── */}
            <div
              className="relative mt-4 shrink-0 border-t border-white/[0.07] px-5 pt-4"
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
                    <><Loader2 className="h-4 w-4 animate-spin" /> Criando…</>
                  ) : (
                    "Criar conta"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
};

export default AccountCreateSheet;
