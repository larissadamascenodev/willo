import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Banknote, CalendarClock, Check, CheckCircle2, ChevronRight, Wallet } from "lucide-react";
import { formatCurrency, type AccountInfo } from "@/pages/FaturaCartao";
import { colorFor, initials } from "@/lib/banks";
import BottomSheet from "@/components/shared/BottomSheet";
import { currencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";

export type PaymentMode = "total" | "minimo" | "parcelado";

export interface PaymentDetails {
  mode: PaymentMode;
  amountPaid?: number;
  installments?: number;
  entryAmount?: number;
  installmentAmount?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  total: number;
  accounts: AccountInfo[];
  payAccountId: string;
  setPayAccountId: (id: string) => void;
  onConfirm: (details: PaymentDetails) => void;
  paying: boolean;
}

const MODES: { value: PaymentMode; label: string; hint: string; icon: typeof CheckCircle2 }[] = [
  { value: "total", label: "Valor total", hint: "Zera a fatura", icon: CheckCircle2 },
  { value: "minimo", label: "Parcial", hint: "O resto vai pra próxima", icon: Banknote },
  { value: "parcelado", label: "Parcelado", hint: "Com entrada e juros", icon: CalendarClock },
];

function parseAmount(val: string): number {
  // "1.234,56" → 1234.56
  return parseFloat(val.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

/** A field that takes money, in the sheet's own language rather than a browser input. */
const MoneyField = ({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => (
  <label className="flex min-h-[56px] items-center gap-3 px-[18px] py-2.5">
    <span className="shrink-0 text-[15px] text-white">{label}</span>
    <span className="flex min-w-0 flex-1 items-baseline justify-end gap-1.5">
      <span className="shrink-0 text-[13px] text-white/40">{currencySymbol()}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "0,00"}
        className="w-full min-w-0 bg-transparent text-right text-[16px] font-semibold tabular-nums text-white placeholder:font-normal placeholder:text-white/30 focus:outline-none"
      />
    </span>
  </label>
);

/**
 * Paying a statement, in the same language as every other sheet: the figure first,
 * then where it comes out of, then how. The three ways to pay carry what they mean
 * rather than only what they are called, because "parcial" and "parcelado" are a
 * letter apart and do very different things to next month.
 */
export default function InvoicePayModal({
  open, onClose, total, accounts, payAccountId, setPayAccountId, onConfirm, paying,
}: Props) {
  const [mode, setMode] = useState<PaymentMode>("total");
  const [minAmount, setMinAmount] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [installments, setInstallments] = useState("2");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [pickingAccount, setPickingAccount] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("total");
      setMinAmount("");
      setEntryAmount("");
      setInstallments("2");
      setInstallmentAmount("");
      setPickingAccount(false);
    }
  }, [open]);

  const parsedMinAmount = parseAmount(minAmount);
  const parsedEntryAmount = parseAmount(entryAmount);
  const parsedInstallments = parseInt(installments) || 2;
  const parsedInstallmentAmount = parseAmount(installmentAmount);

  const remainder = mode === "minimo" ? Math.max(0, total - parsedMinAmount) : 0;

  // Interest is whatever the plan costs beyond the statement itself.
  const installmentCalc = useMemo(() => {
    if (mode !== "parcelado") return null;
    if (parsedInstallments < 2 || parsedInstallmentAmount <= 0) return null;
    const totalPaid = parsedEntryAmount + parsedInstallmentAmount * parsedInstallments;
    return { totalPaid, interest: Math.max(0, totalPaid - total) };
  }, [mode, total, parsedEntryAmount, parsedInstallments, parsedInstallmentAmount]);

  const account = accounts.find((a) => a.id === payAccountId);
  const paysNow = mode === "total" ? total : mode === "minimo" ? parsedMinAmount : parsedEntryAmount;
  const short = account ? paysNow > Number(account.current_balance) : false;

  const canConfirm = (() => {
    if (!payAccountId) return false;
    if (mode === "minimo") return parsedMinAmount > 0 && parsedMinAmount < total;
    if (mode === "parcelado") return parsedInstallments >= 2 && parsedInstallmentAmount > 0;
    return true;
  })();

  const handleConfirm = () => {
    if (mode === "total") onConfirm({ mode: "total" });
    else if (mode === "minimo") onConfirm({ mode: "minimo", amountPaid: parsedMinAmount });
    else onConfirm({
      mode: "parcelado",
      entryAmount: parsedEntryAmount,
      installments: parsedInstallments,
      installmentAmount: parsedInstallmentAmount,
    });
  };

  return (
    <>
      <BottomSheet
        open={open && !pickingAccount}
        onClose={onClose}
        size="full"
        zIndex={70}
        footer={
          <button
            type="button"
            disabled={!canConfirm || paying}
            onClick={handleConfirm}
            className="h-14 w-full rounded-full bg-white text-[16px] font-bold text-[#0B0B0B] shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-opacity disabled:opacity-35"
          >
            {paying ? "Pagando..." : paysNow > 0 ? `Pagar ${formatCurrency(paysNow)}` : "Pagar fatura"}
          </button>
        }
      >
        <div className="px-4 pb-2">
          {/* What is owed, as the headline rather than a line in a form */}
          <div className="relative flex flex-col items-center pb-7 pt-2">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 left-1/2 h-[260px] w-[150vw] -translate-x-1/2"
              style={{ background: "radial-gradient(50% 44% at 50% 50%, #A78BFA 0%, transparent 72%)", opacity: 0.2 }}
            />
            <span className="relative text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
              Saldo em aberto
            </span>
            <p className="relative mt-3 text-[44px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-white">
              {formatCurrency(total)}
            </p>
          </div>

          {/* Where it comes out of */}
          <p className="mb-2.5 px-1 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-white/45">
            Debitar da conta
          </p>
          <button
            type="button"
            onClick={() => setPickingAccount(true)}
            className="flex w-full items-center gap-3.5 rounded-[24px] border border-white/[0.07] willo-glass px-[18px] py-3.5 text-left active:bg-white/[0.03]"
          >
            {account ? (
              <span
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold text-white"
                style={{ background: colorFor(account.name, (account as { color?: string | null }).color ?? null) }}
              >
                {initials(account.name)}
              </span>
            ) : (
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                <Wallet className="h-4 w-4 text-white/60" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-white">
                {account?.name ?? "Escolher conta"}
              </span>
              {account && (
                <span className={cn("block truncate text-[12.5px] tabular-nums", short ? "text-red-400" : "text-white/45")}>
                  {formatCurrency(Number(account.current_balance))}
                  {short ? " · menos do que o pagamento" : " disponíveis"}
                </span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
          </button>

          {/* How */}
          <p className="mb-2.5 mt-7 px-1 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-white/45">
            Como pagar
          </p>
          <div className="space-y-2">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={cn(
                    "flex w-full items-center gap-3.5 rounded-[20px] border px-4 py-3.5 text-left transition-colors",
                    active ? "border-white/35 bg-white/[0.10]" : "border-white/[0.07] willo-glass",
                  )}
                >
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-white/40")} strokeWidth={2.1} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-white">{m.label}</span>
                    <span className="block truncate text-[12.5px] text-white/45">{m.hint}</span>
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      active ? "border-white bg-white" : "border-white/20",
                    )}
                  >
                    {active && <Check className="h-3 w-3 text-[#0B0B0B]" strokeWidth={3.4} />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* What the chosen way needs to know */}
          {mode === "minimo" && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
              <div className="rounded-[24px] border border-white/[0.07] willo-glass">
                <MoneyField label="Pagar agora" value={minAmount} onChange={setMinAmount} />
              </div>
              {parsedMinAmount > 0 && (
                <p className="mt-2.5 px-1 text-[12.5px] text-white/55">
                  {parsedMinAmount >= total
                    ? "Isso cobre a fatura inteira. Use “Valor total”."
                    : <>Ficam <b className="font-semibold text-white">{formatCurrency(remainder)}</b> para a próxima fatura.</>}
                </p>
              )}
            </motion.div>
          )}

          {mode === "parcelado" && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
              <div className="divide-y divide-white/[0.055] rounded-[24px] border border-white/[0.07] willo-glass">
                <MoneyField label="Entrada" value={entryAmount} onChange={setEntryAmount} />
                <label className="flex min-h-[56px] items-center gap-3 px-[18px] py-2.5">
                  <span className="shrink-0 text-[15px] text-white">Parcelas</span>
                  <input
                    inputMode="numeric"
                    value={installments}
                    onChange={(e) => setInstallments(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="w-full min-w-0 bg-transparent text-right text-[16px] font-semibold tabular-nums text-white focus:outline-none"
                  />
                  <span className="shrink-0 text-[13px] text-white/40">x</span>
                </label>
                <MoneyField label="Valor da parcela" value={installmentAmount} onChange={setInstallmentAmount} />
              </div>

              {installmentCalc && (
                <div className="mt-2.5 rounded-[20px] border border-white/[0.07] willo-glass px-4 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-white/55">Vai pagar no total</span>
                    <span className="text-[14px] font-semibold tabular-nums text-white">
                      {formatCurrency(installmentCalc.totalPaid)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-white/55">Juros</span>
                    <span className={cn(
                      "text-[14px] font-semibold tabular-nums",
                      installmentCalc.interest > 0 ? "text-amber-300" : "text-willo-green",
                    )}>
                      {installmentCalc.interest > 0 ? formatCurrency(installmentCalc.interest) : "sem juros"}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {short && canConfirm && (
            <p className="mt-4 px-1 text-[12.5px] text-red-400">
              {account?.name} tem menos do que esse pagamento. A conta vai ficar negativa.
            </p>
          )}
        </div>
      </BottomSheet>

      <BottomSheet open={pickingAccount} onClose={() => setPickingAccount(false)} zIndex={75}>
        <div className="px-4 pb-2">
          <h3 className="px-1 text-[17px] font-bold text-white">Debitar de qual conta?</h3>
          <div className="mt-3 divide-y divide-white/[0.06]">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => { setPayAccountId(a.id); setPickingAccount(false); }}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold text-white"
                  style={{ background: colorFor(a.name, (a as { color?: string | null }).color ?? null) }}
                >
                  {initials(a.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-white">{a.name}</span>
                  <span className="block truncate text-[12.5px] tabular-nums text-white/45">
                    {formatCurrency(Number(a.current_balance))}
                  </span>
                </span>
                {a.id === payAccountId && <Check className="h-4 w-4 shrink-0 text-white" strokeWidth={2.6} />}
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
