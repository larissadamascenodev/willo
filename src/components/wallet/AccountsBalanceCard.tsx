import { motion } from "framer-motion";
import { Plus } from "lucide-react";

import { getCurrency } from "@/lib/currency";
import { colorFor, initials } from "@/lib/banks";
export interface AccountBalanceItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  current_balance: number | string;
  is_default?: boolean | null;
}

const TYPE_LABEL: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
};

const accountHex = (acc: AccountBalanceItem) => colorFor(acc.name, acc.color);

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/** Total balance across accounts with a proportional color bar and one row per account. */
const AccountsBalanceCard = ({ accounts, onOpen, onAdd, savedTotal = 0 }: {
  accounts: AccountBalanceItem[];
  onOpen: (id: string) => void;
  onAdd: () => void;
  /** Money kept in the reserve and pots, shown as patrimony. */
  savedTotal?: number;
}) => {
  const rows = accounts
    .map((acc) => ({ acc, balance: Number(acc.current_balance), hex: accountHex(acc) }))
    .sort((a, b) => b.balance - a.balance);
  const total = rows.reduce((sum, r) => sum + r.balance, 0);
  const positiveTotal = rows.reduce((sum, r) => sum + Math.max(r.balance, 0), 0);

  return (
    <div className="rounded-[26px] border border-white/[0.12] willo-glass p-4">
      <div className="flex items-center justify-between">
        <p className="text-[15px] text-white/66">Saldo em contas</p>
        <button
          onClick={onAdd}
          aria-label="Adicionar conta"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-white active:scale-95 transition-transform"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className={`mt-1 text-[34px] font-extrabold leading-tight tracking-tight tabular-nums ${total < 0 ? "text-red-400" : "text-white"}`}>
        {fmt(total)}
      </p>
      {savedTotal > 0 && (
        <p className="mt-1 text-[13px] text-white/62">
          Patrimônio <span className="font-semibold text-white tabular-nums">{fmt(total + savedTotal)}</span>
          <span className="text-white/50"> · {fmt(savedTotal)} guardados</span>
        </p>
      )}

      {/* Proportional bar */}
      <div className="mt-4 flex h-2.5 gap-1 overflow-hidden rounded-full bg-white/[0.06]">
        {positiveTotal > 0 &&
          rows
            .filter((r) => r.balance > 0)
            .map((r, i) => (
              <motion.span
                key={r.acc.id}
                className="h-full rounded-full"
                style={{ background: r.hex }}
                initial={{ width: 0 }}
                animate={{ width: `${(r.balance / positiveTotal) * 100}%` }}
                transition={{ delay: i * 0.05, duration: 0.6, ease: "easeOut" }}
              />
            ))}
      </div>

      <div className="mt-2">
        {rows.map(({ acc, balance, hex }) => {
          const pct = positiveTotal > 0 ? Math.round((Math.max(balance, 0) / positiveTotal) * 100) : 0;
          return (
            <button
              key={acc.id}
              onClick={() => onOpen(acc.id)}
              className="flex w-full items-center gap-3.5 py-3 text-left active:opacity-70"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
                style={{ background: hex }}
              >
                {initials(acc.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold text-white">{acc.name}</span>
                <span className="block text-[13px] text-white/62">
                  {TYPE_LABEL[acc.type] ?? "Conta"}
                  {acc.is_default ? " · Principal" : ""}
                </span>
              </span>
              <span className="text-right">
                <span className={`block text-[16px] tabular-nums ${balance < 0 ? "text-red-400" : "text-white"}`}>{fmt(balance)}</span>
                <span className="block text-[13px] text-white/62 tabular-nums">{pct}%</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AccountsBalanceCard;
