import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, ChevronRight, Landmark, ArrowRightLeft, Vault } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getAccounts } from "@/services/transactionService";
import { fetchGoals } from "@/services/goalService";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import { getCurrency } from "@/lib/currency";
interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  color: string | null;
}


function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
}

const WalletSummaryCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [totalMetas, setTotalMetas] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = () => Promise.all([getAccounts(), fetchGoals()]).then(([accs, goals]) => {
      setAccounts(accs as unknown as Account[]);
      setTotalMetas(goals.reduce((s, g) => s + g.current_amount, 0));
    });
    load();
    const onChange = () => load();
    window.addEventListener("finance-data-changed", onChange);

    const channel = supabase
      .channel("wallet-summary-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "goals", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "goal_transactions", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();

    return () => {
      window.removeEventListener("finance-data-changed", onChange);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance), 0);
  const totalReservado = totalMetas;
  const patrimonio = totalBalance + totalReservado;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="relative overflow-hidden rounded-2xl border border-primary/10 bg-primary/[0.04] backdrop-blur-xl p-4 md:p-5 space-y-3 md:space-y-4 group cursor-pointer"
      onClick={() => navigate("/gestao")}
    >
      {/* Glassmorphism decorative elements */}
      <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-primary/[0.06] blur-xl" />
      <div className="absolute -left-4 -bottom-4 w-16 h-16 rounded-full bg-primary/[0.04] blur-lg" />

      {/* Header + Patrimônio inline on mobile */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-primary/15 flex items-center justify-center backdrop-blur-sm">
            <Wallet className="w-4.5 h-4.5 md:w-5 md:h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold font-display text-primary leading-none">Minha Carteira</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 md:hidden">Patrimônio Total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className={cn("text-lg font-bold tabular-nums md:hidden", patrimonio >= 0 ? "text-willo-green" : "text-destructive")}>
            {formatCurrency(patrimonio)}
          </p>
          <ChevronRight className="w-4 h-4 text-primary/30 group-hover:text-primary transition-colors" />
        </div>
      </div>

      {/* Patrimônio total - desktop only */}
      <div className="relative text-center py-2 hidden md:block">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Patrimônio Total</p>
        <p className={cn("text-xl font-bold tabular-nums", patrimonio >= 0 ? "text-willo-green" : "text-destructive")}>
          {formatCurrency(patrimonio)}
        </p>
      </div>

      {/* Stats row */}
      <div className="relative grid grid-cols-2 gap-2">
        <div className="bg-background/40 backdrop-blur-sm rounded-xl p-3 text-center border border-border/10">
          <Landmark className="w-4 h-4 text-primary/60 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground leading-tight">Contas</p>
          <p className={cn("text-xs md:text-sm font-bold tabular-nums mt-1", totalBalance >= 0 ? "text-willo-green" : "text-destructive")}>
            {formatCurrency(totalBalance)}
          </p>
        </div>
        <div className="bg-background/40 backdrop-blur-sm rounded-xl p-3 text-center border border-border/10">
          <Vault className="w-4 h-4 text-primary/60 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground leading-tight">Reservado</p>
          <p className={cn("text-xs md:text-sm font-bold tabular-nums mt-1", totalReservado > 0 ? "text-foreground" : "text-muted-foreground")}>
            {totalReservado > 0 ? formatCurrency(totalReservado) : formatCurrency(0)}
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="relative flex items-center justify-center gap-4 pt-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate("/gestao");
          }}
          className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Transferir</span>
        </button>
        <span className="w-px h-4 bg-primary/10" />
        <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
          Gerenciar carteira
        </span>
      </div>
    </motion.div>
  );
};

export default WalletSummaryCard;
