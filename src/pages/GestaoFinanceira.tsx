import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Plus, X, Landmark, Banknote, Vault, ChevronRight, Wallet, Brain, Calendar, CalendarClock } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getCachedDashboardData, buildDashboardCacheKey } from "@/services/dashboardData";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getAccounts } from "@/services/transactionService";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import AccountsBalanceCard from "@/components/wallet/AccountsBalanceCard";
import AccountCreateSheet from "@/components/wallet/AccountCreateSheet";
import ReserveAndPots from "@/components/wallet/ReserveAndPots";
import { getAccent } from "@/components/wallet/CreditCardTile";
import { fetchGoals, type Goal } from "@/services/goalService";
import AIFinancialWizardModal from "@/components/shared/AIFinancialWizardModal";

import { getCurrency } from "@/lib/currency";
interface Account {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
  current_balance: number;
  initial_balance: number;
  color: string | null;
}

interface InvoiceData {
  credit_card_id: string;
  total_amount: number;
  is_paid: boolean;
  month: number;
  year: number;
  paid_amount?: number;
}

const ACCOUNT_TYPE_LABELS: Record<string, { label: string; icon: typeof Landmark }> = {
  cash: { label: "Dinheiro", icon: Banknote },
  checking: { label: "Conta corrente", icon: Landmark },
  savings: { label: "Poupança", icon: Vault },
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
}

const GOAL_COLORS = [
  "hsl(40 90% 55%)",
  "hsl(150 100% 45%)",
  "hsl(210 80% 55%)",
  "hsl(330 80% 55%)",
  "hsl(270 70% 60%)",
  "hsl(180 70% 50%)",
];

const GestaoFinanceira = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const warmDashboardData = getCachedDashboardData(buildDashboardCacheKey(user?.id, new Date().getMonth(), new Date().getFullYear()));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(() => !warmDashboardData);


  const [searchParams, setSearchParams] = useSearchParams();

  const [showAddAccount, setShowAddAccount] = useState(false);

  // Opened as a shortcut from the dashboard's "Complete sua conta" card —
  // /gestao?abrir=conta opens the account modal right away.
  useEffect(() => {
    const abrir = searchParams.get("abrir");
    if (!abrir) return;
    if (abrir === "conta") setShowAddAccount(true);
    // Cards moved to their own section, so an old link to add one goes there.
    if (abrir === "cartao") navigate("/cartoes?aba=cartoes", { replace: true });
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("abrir");
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Add menu state
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAIWizard, setShowAIWizard] = useState<"meta" | null>(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [accs, goalsData] = await Promise.all([
        getAccounts(),
        fetchGoals(),
      ]);
      setAccounts(accs as unknown as Account[]);
      setGoals(goalsData);
      setLoading(false);

    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
    const onChange = () => fetchData();
    window.addEventListener("finance-data-changed", onChange);

    const channel = supabase
      .channel("gestao-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "credit_cards", filter: `user_id=eq.${user.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: `user_id=eq.${user.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `user_id=eq.${user.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "goals", filter: `user_id=eq.${user.id}` }, () => fetchData())
      .subscribe();

    return () => {
      window.removeEventListener("finance-data-changed", onChange);
      supabase.removeChannel(channel);
    };
  }, [user]);

  // ═══════ Computed values ═══════
  const bankAccounts = accounts.filter(a => a.type !== "investment");

  const saldoDisponivel = bankAccounts.reduce((s, a) => s + Number(a.current_balance), 0);
  const totalMetas = goals.reduce((s, g) => s + g.current_amount, 0);
  const patrimonioTotal = saldoDisponivel + totalMetas;


  return (
    <div className="pt-2 pb-8 space-y-6">
      {/* ═══════ Page Header ═══════ */}
      <div className="pt-1">
        <h1 className="text-[28px] font-extrabold tracking-tight text-white">Carteira</h1>
        <p className="text-[14px] text-white/62">Suas contas, a reserva e os cofrinhos</p>
      </div>

      {/* ═══════ Contas ═══════ */}
      <section>
        <div className={cn("flex items-center justify-between mb-3 px-1", bankAccounts.length > 0 && "hidden sm:flex")}>
          <h2 className="text-[18px] font-bold text-white">Contas</h2>
          <button onClick={() => setShowAddAccount(true)} aria-label="Adicionar conta" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] willo-glass text-white active:scale-95 transition-transform">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 rounded-[22px] willo-glass animate-pulse" />
            ))}
          </div>
        ) : bankAccounts.length === 0 ? (
          <div className="rounded-[22px] willo-glass border border-white/[0.08] p-8 text-center">
            <Landmark className="w-8 h-8 text-white/45 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">Nenhuma conta cadastrada</p>
            <p className="text-xs text-muted-foreground/60 mb-4">Crie sua primeira conta para começar</p>
            <Button
              onClick={() => setShowAddAccount(true)}
              size="sm"
              className="h-10 px-5 willo-pill"
            >
              <Plus className="w-4 h-4 mr-1" /> Criar Conta
            </Button>
          </div>
        ) : (
          <>
            {/* Mobile: total + accounts in one card */}
            <div className="sm:hidden">
              <AccountsBalanceCard
                accounts={bankAccounts}
                onOpen={(id) => navigate(`/conta/${id}`)}
                onAdd={() => setShowAddAccount(true)}
                savedTotal={totalMetas}
              />
            </div>

            {/* Desktop grid */}
            <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {bankAccounts.map((acc, idx) => {
                const typeInfo = ACCOUNT_TYPE_LABELS[acc.type] ?? ACCOUNT_TYPE_LABELS.checking;
                const Icon = typeInfo.icon;
                const balance = Number(acc.current_balance);
                const accent = getAccent(acc.color);

                return (
                  <motion.div
                    key={acc.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    onClick={() => navigate(`/conta/${acc.id}`)}
                    className="relative rounded-[22px] overflow-hidden cursor-pointer group border border-white/[0.08] willo-glass hover:border-white/15 transition-all duration-300 active:scale-[0.98]"
                  >
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", accent.iconBg)}>
                            <Icon className={cn("w-4 h-4", accent.dot.replace("bg-", "text-"))} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground leading-tight">{acc.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{typeInfo.label}</p>
                          </div>
                        </div>
                        {acc.is_default ? (
                          <span className="text-[8px] bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider">
                            Principal
                          </span>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground/25 group-hover:text-primary transition-colors" />
                        )}
                      </div>
                      <div className="h-px bg-border/10" />
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full", balance >= 0 ? "bg-willo-green" : "bg-destructive")} />
                          <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">Saldo disponível</p>
                        </div>
                        <p className={cn("text-2xl font-extrabold tabular-nums tracking-tight", balance >= 0 ? "text-foreground" : "text-destructive")}>
                          {formatCurrency(balance)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <motion.button
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: bankAccounts.length * 0.05 }}
                onClick={() => setShowAddAccount(true)}
                className="rounded-[22px] p-4 min-h-[148px] flex flex-col items-center justify-center gap-2 border border-dashed border-white/15 hover:border-white/30 bg-transparent transition-all duration-300 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs text-white/74 font-medium">Adicionar conta</span>
              </motion.button>
            </div>
          </>
        )}
      </section>

      {/* ═══════ Reserva e cofrinhos ═══════ */}
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[18px] font-bold text-white">Guardado</h2>
          <p className="text-[13px] text-white/62 tabular-nums">{totalMetas.toLocaleString("pt-BR", { style: "currency", currency: getCurrency(), maximumFractionDigits: 0 })}</p>
        </div>
        <ReserveAndPots goals={goals} onCreated={fetchData} />
      </section>


      {/* AI Financial Wizard */}
      <AIFinancialWizardModal
        open={!!showAIWizard}
        onClose={() => setShowAIWizard(null)}
        type="meta"
        onConfirm={async (plan, objective) => {
          if (!user) return;
          try {
            const { createGoal } = await import("@/services/goalService");
            await createGoal({
              name: objective,
              target_amount: plan.monthly_contribution * plan.estimated_months,
              monthly_contribution: plan.monthly_contribution,
            }, user.id);
            toast.success("Meta criada com IA! 🤖🎯");
            fetchData();
          } catch {
            toast.error("Erro ao criar com IA");
          }
        }}
      />
    </div>
  );
};

export default GestaoFinanceira;
