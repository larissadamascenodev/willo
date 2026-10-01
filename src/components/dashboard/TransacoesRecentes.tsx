import { memo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, CreditCard, Wallet, Receipt } from "lucide-react";
import { motion } from "framer-motion";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { getCategoryIcon, getCategoryHexColor } from "@/lib/categoryUtils";
import type { Transaction } from "@/types/finance";

import { getCurrency } from "@/lib/currency";
interface Props {
  transactions: Transaction[];
  onVerTodas?: () => void;
  onDelete?: () => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
const VISIBLE_COUNT = 5;

function statusLabel(tx: Transaction) {
  const isReceita = tx.type === "receita";
  if (tx.isFatura) return tx.status === "pago" ? "Fatura paga" : "Fatura";
  if (tx.status === "pago") return isReceita ? "Recebido" : "Pago";
  return isReceita ? "A receber" : "Pendente";
}

const TxRow = ({ tx, customCategories }: { tx: Transaction; customCategories: CustomCategory[] }) => {
  const isReceita = tx.type === "receita";
  const isPending = tx.status !== "pago";
  const isInitialBalance = tx.category === "Saldo inicial";

  const Icon = tx.isFatura ? CreditCard : isInitialBalance ? Wallet : getCategoryIcon(tx.category, customCategories);
  const hex = tx.isFatura ? tx.creditCardColor ?? "#A855F7" : isInitialBalance ? "#3B82F6" : getCategoryHexColor(tx.category, customCategories);
  const subtitle = tx.isFatura
    ? `${tx.faturaItemCount} lançamento${tx.faturaItemCount !== 1 ? "s" : ""}`
    : [tx.category, tx.date].filter(Boolean).join(" · ");

  return (
    <div className="flex items-center gap-3 py-3">
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `${hex}1F` }}>
        <Icon className="h-[18px] w-[18px]" style={{ color: hex }} />
        {isPending && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#141414] bg-amber-300" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-white">{tx.name}</p>
        <p className="truncate text-[12px] text-white/56">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-[15px] font-semibold tabular-nums ${isReceita ? "text-willo-green" : "text-white"}`}>
          {isReceita ? "+" : "−"}{fmt(tx.amount)}
        </p>
        <p className={`text-[11px] ${isPending ? "text-amber-300/90" : "text-white/50"}`}>{statusLabel(tx)}</p>
      </div>
    </div>
  );
};

const TransacoesRecentes = memo(({ transactions, onVerTodas }: Props) => {
  const navigate = useNavigate();
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);

  useEffect(() => {
    getCustomCategories().then(setCustomCats).catch(() => {});
  }, []);

  const openAll = onVerTodas ?? (() => navigate("/transacoes"));
  const visible = transactions.slice(0, VISIBLE_COUNT);

  return (
    <div className="rounded-[22px] border border-white/[0.12] willo-glass px-4 pt-4 pb-1">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-white">Transações recentes</h3>
        {transactions.length > 0 && (
          <button onClick={openAll} className="flex items-center gap-0.5 text-[13px] text-white/66 active:opacity-60">
            Ver todas <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06]">
            <Receipt className="h-5 w-5 text-white/56" />
          </span>
          <p className="mt-3 text-[14px] text-white/66">Nenhuma transação neste mês</p>
        </div>
      ) : (
        <div className="mt-1 divide-y divide-white/[0.06]">
          {visible.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <TxRow tx={tx} customCategories={customCats} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
});

TransacoesRecentes.displayName = "TransacoesRecentes";
export default TransacoesRecentes;
