import { memo, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getAccounts } from "@/services/transactionService";
import { supabase } from "@/integrations/supabase/client";
import { colorFor, initials } from "@/lib/banks";
import { getCurrency } from "@/lib/currency";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  color: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  investment: "Investimento",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/**
 * Where the money actually sits. The total alone says nothing about whether it is
 * reachable, so the bar splits it by account at a glance and the rows name each one —
 * a single account holding everything looks very different from four holding a quarter each.
 */
const SaldoContasCard = memo(() => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hidden = useHiddenValues();
  const [accounts, setAccounts] = useState<Account[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = () => getAccounts().then((a) => setAccounts(a as unknown as Account[])).catch(() => setAccounts([]));
    load();
    const onChange = () => load();
    window.addEventListener("finance-data-changed", onChange);
    window.addEventListener("transaction-created", onChange);
    const channel = supabase
      .channel("saldo-contas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => {
      window.removeEventListener("finance-data-changed", onChange);
      window.removeEventListener("transaction-created", onChange);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const rows = useMemo(() => {
    if (!accounts) return [];
    // Only balances that take up room on the bar can be drawn on it; an account in the
    // red still gets its row, so the list stays the whole truth.
    return [...accounts]
      .map((a) => ({ ...a, balance: Number(a.current_balance) || 0, hex: colorFor(a.name, a.color) }))
      .sort((a, b) => b.balance - a.balance);
  }, [accounts]);

  if (!accounts) return <div className="h-[196px] animate-pulse rounded-[22px] border border-white/[0.08] willo-glass" />;
  if (accounts.length === 0) return null;

  const total = rows.reduce((s, a) => s + a.balance, 0);
  const positive = rows.reduce((s, a) => s + Math.max(a.balance, 0), 0);
  const value = (v: number) => (hidden ? "••••" : fmt(v));

  return (
    <button
      onClick={() => navigate("/gestao")}
      className="block w-full rounded-[22px] border border-white/[0.08] willo-glass px-4 pb-4 pt-3.5 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] text-white/66">Saldo em contas</p>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
      </div>

      <p className={cn(
        "mt-1 truncate text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums",
        total < 0 ? "text-red-400" : "text-white",
      )}>
        {value(total)}
      </p>

      {/* One bar split by account: the share each one holds, in its own brand colour. */}
      <div className="mt-3.5 flex h-[7px] gap-[3px] overflow-hidden rounded-full">
        {positive > 0 ? (
          rows.filter((a) => a.balance > 0).map((a, i) => (
            <motion.span
              key={a.id}
              className="h-full rounded-full"
              style={{ background: a.hex }}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: a.balance / positive }}
              transition={{ duration: 0.6, delay: 0.04 * i, ease: "easeOut" }}
            />
          ))
        ) : (
          <span className="h-full flex-1 rounded-full bg-white/[0.08]" />
        )}
      </div>

      <div className="mt-3.5 space-y-3 border-t border-white/[0.06] pt-3.5">
        {rows.map((a) => {
          const share = positive > 0 && a.balance > 0 ? (a.balance / positive) * 100 : 0;
          return (
            <div key={a.id} className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold text-white"
                style={{ background: a.hex }}
              >
                {initials(a.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-white">{a.name}</p>
                <p className="truncate text-[11.5px] text-white/45">{TYPE_LABEL[a.type] ?? "Conta"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn(
                  "text-[14px] font-semibold tabular-nums",
                  a.balance < 0 ? "text-red-400" : "text-white",
                )}>
                  {value(a.balance)}
                </p>
                <p className="text-[11.5px] tabular-nums text-white/45">{Math.round(share)}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </button>
  );
});

SaldoContasCard.displayName = "SaldoContasCard";
export default SaldoContasCard;
