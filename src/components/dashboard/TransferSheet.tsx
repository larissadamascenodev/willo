import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, ArrowDown, CalendarDays, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getAccounts } from "@/services/transactionService";
import { supabase } from "@/integrations/supabase/client";
import { colorFor, initials } from "@/lib/banks";
import { currencySymbol, getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  color: string | null;
}

const cents = (c: number) => (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const TRANSFER_MESSAGES = [
  "Movendo dinheiro ou fugindo do limite? 😏",
  "Organizando as contas… agora sim 👀",
  "Dinheiro em trânsito! 🚀",
];
const INVESTMENT_MESSAGES = [
  "Agora sim, dinheiro trabalhando por você 💰",
  "Isso aqui é o começo do jogo virar 😎",
  "Investir é o melhor gasto que existe 🧠",
];

/** One account to pick, drawn the way the accounts card draws them. */
function AccountChip({ account, selected, disabled, onClick }: {
  account: Account;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const hex = colorFor(account.name, account.color);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-[108px] shrink-0 flex-col items-start gap-2 rounded-[18px] border px-3 py-3 text-left transition",
        selected ? "border-white/35 bg-white/[0.10]" : "border-white/[0.08] bg-white/[0.03]",
        disabled && "opacity-30",
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: hex }}>
        {initials(account.name)}
      </span>
      <span className="w-full truncate text-[12.5px] font-medium text-white">{account.name}</span>
      <span className="w-full truncate text-[11px] tabular-nums text-white/45">{money(Number(account.current_balance))}</span>
    </button>
  );
}

/**
 * The transfer, in the same sheet and the same language as the other two entries.
 * Money leaving one account and landing in another is one movement, so the screen
 * reads top to bottom as exactly that: the amount, where it leaves, where it lands.
 */
export default function TransferSheet({ switcher, onClose, onSuccess }: {
  /** The type selector, drawn by the parent so all three entries share one control. */
  switcher?: React.ReactNode;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [date, setDate] = useState(() => new Date());
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getAccounts(true).then((a) => setAccounts(a as unknown as Account[])).catch(() => undefined);
  }, [user]);

  const from = useMemo(() => accounts.find((a) => a.id === fromId), [accounts, fromId]);
  const to = useMemo(() => accounts.find((a) => a.id === toId), [accounts, toId]);
  const isInvestment = to?.type === "investment";
  const real = amountCents / 100;
  const insufficient = from ? real > Number(from.current_balance) : false;
  const ready = !!fromId && !!toId && fromId !== toId && amountCents > 0 && !insufficient;

  const onAmountKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      setAmountCents((p) => Math.floor(p / 10));
    } else if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      setAmountCents((p) => (p * 10 + Number(e.key) > 99999999 ? p : p * 10 + Number(e.key)));
    }
  };

  const submit = async () => {
    if (!user || !ready) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        name: `${isInvestment ? "Investimento" : "Transferência"}: ${from?.name} → ${to?.name}`,
        type: isInvestment ? "investimento" : "transferencia",
        amount: real,
        category: isInvestment ? "Investimentos" : "Transferência",
        date: format(date, "yyyy-MM-dd"),
        status: "pago",
        account_id: fromId,
        to_account_id: toId,
        payment_method: "conta",
        recurrence_type: "unica",
      } as any);
      if (error) throw error;

      const pool = isInvestment ? INVESTMENT_MESSAGES : TRANSFER_MESSAGES;
      toast.success(pool[Math.floor(Math.random() * pool.length)], {
        description: `${currencySymbol()} ${cents(amountCents)} ${isInvestment ? "investido" : "transferido"}`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao realizar transferência");
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date();
  const isToday = format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 34, stiffness: 320 }}
      className="willo-bg fixed inset-0 z-[60] flex flex-col md:inset-auto md:left-1/2 md:top-1/2 md:h-[88vh] md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-hidden md:rounded-[32px] md:border md:border-white/[0.08]"
    >
      <div className="shrink-0 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
        <div className="flex h-11 items-center justify-between">
          <button onClick={onClose} aria-label="Fechar" className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white/82 active:opacity-60">
            <X className="h-6 w-6" />
          </button>
          <span className="text-[16px] font-semibold text-white">Nova transferência</span>
          <span className="w-10" />
        </div>
        {switcher && <div className="pb-1 pt-2">{switcher}</div>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        <div className="flex flex-col items-center pb-7 pt-6" onClick={() => amountRef.current?.focus()}>
          <span className="text-[14px] text-white/66">Valor da transferência</span>
          <div className="relative mt-2 flex items-baseline gap-2">
            <span className="text-[24px] font-bold text-white/56">{currencySymbol()}</span>
            <motion.span
              key={amountCents}
              initial={{ scale: 1.04 }}
              animate={{ scale: 1 }}
              className={cn("text-[52px] font-extrabold leading-none tracking-tight tabular-nums", amountCents === 0 ? "text-white/45" : "text-white")}
            >
              {cents(amountCents)}
            </motion.span>
            <input
              ref={amountRef}
              inputMode="numeric"
              value={cents(amountCents)}
              onKeyDown={onAmountKey}
              onChange={(e) => setAmountCents(Math.min(Number(e.target.value.replace(/\D/g, "").slice(0, 10) || "0"), 99999999))}
              aria-label="Valor da transferência"
              autoFocus
              className="absolute inset-0 w-full cursor-text opacity-0"
            />
          </div>
          <span className="mt-3 h-1 w-10 rounded-full bg-sky-400" />
        </div>

        <section>
          <p className="px-1 text-[11.5px] font-semibold uppercase tracking-[0.13em] text-white/45">Sai de</p>
          <div className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
            {accounts.map((a) => (
              <AccountChip key={a.id} account={a} selected={a.id === fromId} onClick={() => setFromId(a.id)} />
            ))}
          </div>
        </section>

        <div className="my-3 flex justify-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07]">
            <ArrowDown className="h-4 w-4 text-white/70" />
          </span>
        </div>

        <section>
          <p className="px-1 text-[11.5px] font-semibold uppercase tracking-[0.13em] text-white/45">Entra em</p>
          <div className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
            {accounts.map((a) => (
              <AccountChip
                key={a.id}
                account={a}
                selected={a.id === toId}
                disabled={a.id === fromId}
                onClick={() => a.id !== fromId && setToId(a.id)}
              />
            ))}
          </div>
        </section>

        <div className="mt-5 divide-y divide-white/[0.06] rounded-[22px] border border-white/[0.08] willo-glass">
          <label className="flex min-h-[56px] cursor-pointer items-center gap-3 px-4 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
              <CalendarDays className="h-4 w-4 text-white/82" />
            </span>
            <span className="shrink-0 text-[15px] text-white">Data</span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
              <span className="text-[15px] text-white">{isToday ? "Hoje" : format(date, "dd/MM/yyyy")}</span>
              <input
                type="date"
                value={format(date, "yyyy-MM-dd")}
                onChange={(e) => e.target.value && setDate(new Date(`${e.target.value}T12:00:00`))}
                className="w-[22px] bg-transparent text-right text-[15px] text-white/50 focus:outline-none"
              />
            </span>
          </label>
        </div>

        {insufficient && from && (
          <p className="mt-3 px-1 text-[12.5px] text-red-400">
            {from.name} tem {money(Number(from.current_balance))} — menos do que você está transferindo.
          </p>
        )}
        {!!fromId && fromId === toId && (
          <p className="mt-3 px-1 text-[12.5px] text-red-400">Escolha duas contas diferentes.</p>
        )}
        {isInvestment && ready && (
          <p className="mt-3 flex items-center gap-1.5 px-1 text-[12.5px] text-white/50">
            <Check className="h-3.5 w-3.5 text-sky-400" /> Vai entrar como investimento.
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.06] px-4 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}>
        <button
          type="button"
          onClick={submit}
          disabled={!ready || submitting}
          className="h-14 w-full rounded-full bg-white text-[16px] font-bold text-[#0B0B0B] shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-opacity disabled:opacity-35"
        >
          {submitting ? "Transferindo..." : isInvestment ? "Investir" : "Transferir"}
        </button>
      </div>
    </motion.div>
  );
}
