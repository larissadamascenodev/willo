import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Plus, X, Landmark, Banknote, Vault, ChevronRight, Wallet, Brain, Calendar, CalendarClock } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getCachedDashboardData, buildDashboardCacheKey } from "@/services/dashboardData";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getAccounts, getCreditCards } from "@/services/transactionService";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import AccountsBalanceCard from "@/components/wallet/AccountsBalanceCard";
import AccountCreateSheet from "@/components/wallet/AccountCreateSheet";
import CardCreateSheet from "@/components/wallet/CardCreateSheet";
import ReserveAndPots from "@/components/wallet/ReserveAndPots";
import { CreditCardTile, getAccent, type CreditCardItem, type OpenInvoiceInfo } from "@/components/wallet/CreditCardTile";
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
  const [creditCards, setCreditCards] = useState<CreditCardItem[]>([]);
  const [openInvoices, setOpenInvoices] = useState<Record<string, OpenInvoiceInfo>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(() => !warmDashboardData);


  const [searchParams, setSearchParams] = useSearchParams();

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);

  // Opened as a shortcut from the dashboard's "Complete sua conta" card —
  // /gestao?abrir=conta|cartao opens the matching modal right away.
  useEffect(() => {
    const abrir = searchParams.get("abrir");
    if (!abrir) return;
    if (abrir === "conta") setShowAddAccount(true);
    if (abrir === "cartao") setShowAddCard(true);
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
      const [accs, cards, goalsData] = await Promise.all([
        getAccounts(),
        getCreditCards(),
        fetchGoals(),
      ]);
      setAccounts(accs as unknown as Account[]);
      setCreditCards(cards as unknown as CreditCardItem[]);
      setGoals(goalsData);
      setLoading(false);

      // Fetch invoices for current and next month to show next when current is paid
      const now = new Date();
      const curMonth = now.getMonth() + 1;
      const curYear = now.getFullYear();
      const nextMonth = curMonth === 12 ? 1 : curMonth + 1;
      const nextYear = curMonth === 12 ? curYear + 1 : curYear;

      const { data: invoices } = await supabase
        .from("invoices")
        .select("credit_card_id, total_amount, paid_amount, is_paid, month, year")
        .or(`and(month.eq.${curMonth},year.eq.${curYear}),and(month.eq.${nextMonth},year.eq.${nextYear})`);

      const invoiceMap: Record<string, OpenInvoiceInfo> = {};
      if (invoices) {
        // Group by card, prefer current month unpaid; if paid, show next month
        const byCard = new Map<string, InvoiceData[]>();
        for (const inv of invoices as unknown as InvoiceData[]) {
          const arr = byCard.get(inv.credit_card_id) || [];
          arr.push(inv);
          byCard.set(inv.credit_card_id, arr);
        }
        for (const [cardId, invs] of byCard.entries()) {
          const currentInv = invs.find(i => i.month === curMonth && i.year === curYear);
          const nextInv = invs.find(i => i.month === nextMonth && i.year === nextYear);

          if (currentInv && !currentInv.is_paid) {
            invoiceMap[cardId] = {
              amount: Math.max(0, Number(currentInv.total_amount) - Number(currentInv.paid_amount ?? 0)),
              month: curMonth,
              year: curYear,
              isPaid: false,
            };
          } else if (nextInv) {
            invoiceMap[cardId] = {
              amount: Math.max(0, Number(nextInv.total_amount) - Number(nextInv.paid_amount ?? 0)),
              month: nextMonth,
              year: nextYear,
              isPaid: nextInv.is_paid,
            };
          } else {
            // Current is paid and no next invoice yet — show next month with 0
            invoiceMap[cardId] = {
              amount: 0,
              month: nextMonth,
              year: nextYear,
              isPaid: false,
            };
          }
        }
      }
      setOpenInvoices(invoiceMap);
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
        <p className="text-[14px] text-white/45">Suas contas e cartões em um só lugar</p>
      </div>

      {/* ═══════ Contas ═══════ */}
      <section>
        <div className={cn("flex items-center justify-between mb-3 px-1", bankAccounts.length > 0 && "hidden sm:flex")}>
          <h2 className="text-[18px] font-bold text-white">Contas</h2>
          <button onClick={() => setShowAddAccount(true)} aria-label="Adicionar conta" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-[#141414] text-white active:scale-95 transition-transform">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 rounded-[22px] bg-[#141414] animate-pulse" />
            ))}
          </div>
        ) : bankAccounts.length === 0 ? (
          <div className="rounded-[22px] bg-[#141414] border border-white/[0.07] p-8 text-center">
            <Landmark className="w-8 h-8 text-white/30 mx-auto mb-3" />
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
                    className="relative rounded-[22px] overflow-hidden cursor-pointer group border border-white/[0.07] bg-[#141414] hover:border-white/15 transition-all duration-300 active:scale-[0.98]"
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
                <span className="text-xs text-white/60 font-medium">Adicionar conta</span>
              </motion.button>
            </div>
          </>
        )}
      </section>

      {/* ═══════ Reserva e cofrinhos ═══════ */}
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[18px] font-bold text-white">Guardado</h2>
          <p className="text-[13px] text-white/45 tabular-nums">{totalMetas.toLocaleString("pt-BR", { style: "currency", currency: getCurrency(), maximumFractionDigits: 0 })}</p>
        </div>
        <ReserveAndPots goals={goals} onCreated={fetchData} />
      </section>

      {/* ═══════ Cartões de Crédito ═══════ */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-[18px] font-bold text-white">Cartões de crédito</h2>
          <button onClick={() => setShowAddCard(true)} aria-label="Adicionar cartão" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-[#141414] text-white active:scale-95 transition-transform">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1].map((i) => (
              <div key={i} className="h-44 rounded-[22px] bg-[#141414] animate-pulse" />
            ))}
          </div>
        ) : creditCards.length === 0 ? (
          <div className="rounded-[22px] bg-[#141414] border border-white/[0.07] p-8 text-center">
            <CreditCard className="w-8 h-8 text-white/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">Nenhum cartão cadastrado</p>
            <p className="text-xs text-muted-foreground/60 mb-4">Cadastre seu cartão de crédito</p>
            <Button
              onClick={() => setShowAddCard(true)}
              size="sm"
              className="h-10 px-5 willo-pill"
            >
              <Plus className="w-4 h-4 mr-1" /> Cadastrar Cartão
            </Button>
          </div>
        ) : (
          <>
            {/* Mobile stack */}
            <div className="sm:hidden space-y-2.5">
              {creditCards.map((card, idx) => (
                <CreditCardTile key={card.id} card={card} idx={idx} invoiceInfo={openInvoices[card.id]} navigate={navigate} />
              ))}
            </div>

            {/* Desktop grid */}
            <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {creditCards.map((card, idx) => (
                <CreditCardTile key={card.id} card={card} idx={idx} invoiceInfo={openInvoices[card.id]} navigate={navigate} />
              ))}
              <motion.button
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: creditCards.length * 0.05 }}
                onClick={() => setShowAddCard(true)}
                className="rounded-[22px] p-4 min-h-[148px] flex flex-col items-center justify-center gap-2 border border-dashed border-white/15 hover:border-white/30 bg-transparent transition-all duration-300 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs text-white/60 font-medium">Adicionar cartão</span>
              </motion.button>
            </div>
          </>
        )}
      </section>


      {/* ═══════ Microcopy educativo ═══════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="px-6 text-center"
      >
        <p className="text-[12px] text-white/30">
          "Separe o que é gasto do que é construção de patrimônio"
        </p>
      </motion.div>

      {/* ═══════ MODALS ═══════ */}
      <AccountCreateSheet open={showAddAccount} onClose={() => setShowAddAccount(false)} onCreated={fetchData} />
      <CardCreateSheet open={showAddCard} onClose={() => setShowAddCard(false)} onCreated={fetchData} />

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
