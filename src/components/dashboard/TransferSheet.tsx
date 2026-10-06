import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownUp, CalendarDays, Check, ChevronRight, Wallet } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getAccounts } from "@/services/transactionService";
import { supabase } from "@/integrations/supabase/client";
import { colorFor, initials } from "@/lib/banks";
import { currencySymbol, getCurrency } from "@/lib/currency";
import BottomSheet from "@/components/shared/BottomSheet";
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

function Avatar({ account, size = 38 }: { account: Account; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ background: colorFor(account.name, account.color), width: size, height: size, fontSize: size * 0.33 }}
    >
      {initials(account.name)}
    </span>
  );
}

/**
 * The transfer, as one movement rather than two form fields: origin above,
 * destination below, and the swap sitting on the rule between them the way the
 * arrow would. Picking an account opens the same list for both ends, so there is
 * one thing to learn instead of two.
 */
export default function TransferBody({ onClose, onSuccess }: {
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
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getAccounts(true)
      .then((a) => {
        const list = a as unknown as Account[];
        setAccounts(list);
        // The account the money usually leaves is the one holding the most; start there
        // so the common transfer is two taps instead of four.
        const richest = [...list].sort((x, y) => Number(y.current_balance) - Number(x.current_balance))[0];
        if (richest) setFromId((prev) => prev || richest.id);
      })
      .catch(() => undefined);
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

  const swap = () => {
    setFromId(toId);
    setToId(fromId);
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

  const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  const End = ({ side, label, account }: { side: "from" | "to"; label: string; account?: Account }) => (
    <button
      type="button"
      onClick={() => setPicking(side)}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-white/[0.03]"
    >
      {account ? (
        <Avatar account={account} />
      ) : (
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
          <Wallet className="h-4 w-4 text-white/60" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/40">{label}</span>
        <span className={cn("mt-0.5 block truncate text-[15px]", account ? "font-medium text-white" : "text-white/45")}>
          {account?.name ?? "Escolher conta"}
        </span>
      </span>
      {account && (
        <span className="shrink-0 text-right text-[12.5px] tabular-nums text-white/45">
          {money(Number(account.current_balance))}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
    </button>
  );

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-none px-4 pb-6">
        <div className="flex flex-col items-center pb-7 pt-6" onClick={() => amountRef.current?.focus()}>
          <span className="flex items-center gap-1.5 text-[14px] text-white/66">
            <ArrowDownUp className="h-4 w-4 text-sky-400" />
            Valor da transferência
          </span>
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

        {/* One object, two ends, with the swap on the rule between them */}
        <div className="relative rounded-[22px] border border-white/[0.08] willo-glass">
          <End side="from" label="Sai de" account={from} />
          <div className="mx-4 h-px bg-white/[0.07]" />
          <End side="to" label="Entra em" account={to} />

          <button
            type="button"
            onClick={swap}
            aria-label="Inverter contas"
            className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.10] bg-[#1A1B1E] active:scale-90 transition-transform"
          >
            <ArrowDownUp className="h-4 w-4 text-white/80" strokeWidth={2.2} />
          </button>
        </div>

        <div className="mt-3 rounded-[22px] border border-white/[0.08] willo-glass">
          <label className="flex min-h-[56px] cursor-pointer items-center gap-3 px-4 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
              <CalendarDays className="h-4 w-4 text-white/82" />
            </span>
            <span className="shrink-0 text-[15px] text-white">Data</span>
            <span className="relative flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
              <span className="text-[15px] text-white">{isToday ? "Hoje" : format(date, "dd/MM/yyyy")}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
              <input
                type="date"
                value={format(date, "yyyy-MM-dd")}
                onChange={(e) => e.target.value && setDate(new Date(`${e.target.value}T12:00:00`))}
                aria-label="Data da transferência"
                className="absolute inset-0 w-full opacity-0"
              />
            </span>
          </label>
        </div>

        {insufficient && from && (
          <p className="mt-3 px-1 text-[12.5px] text-red-400">
            {from.name} tem {money(Number(from.current_balance))} — menos do que você está transferindo.
          </p>
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

      <BottomSheet open={picking !== null} onClose={() => setPicking(null)} zIndex={70}>
        <div className="px-4 pb-2">
          <h3 className="text-[17px] font-bold text-white">
            {picking === "from" ? "De qual conta sai?" : "Para qual conta vai?"}
          </h3>
          <div className="mt-3 divide-y divide-white/[0.06]">
            {accounts.map((a) => {
              const taken = picking === "from" ? a.id === toId : a.id === fromId;
              const chosen = picking === "from" ? a.id === fromId : a.id === toId;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={taken}
                  onClick={() => {
                    if (picking === "from") setFromId(a.id);
                    else setToId(a.id);
                    setPicking(null);
                  }}
                  className={cn("flex w-full items-center gap-3 py-3 text-left", taken && "opacity-30")}
                >
                  <Avatar account={a} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-white">{a.name}</span>
                    <span className="block truncate text-[12.5px] tabular-nums text-white/45">
                      {money(Number(a.current_balance))}
                      {taken ? " · já escolhida do outro lado" : ""}
                    </span>
                  </span>
                  {chosen && <Check className="h-4 w-4 shrink-0 text-sky-400" strokeWidth={2.6} />}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
