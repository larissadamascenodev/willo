import { useState, useCallback, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import FinanceOverviewCard from "@/components/dashboard/FinanceOverviewCard";
import WalletSummaryCard from "@/components/dashboard/WalletSummaryCard";
import BalanceHeroCard from "@/components/dashboard/BalanceHeroCard";
import MonthFiguresCard from "@/components/dashboard/MonthFiguresCard";
import { useGreeting } from "@/components/dashboard/DashboardHeader";
import SaldoCard from "@/components/dashboard/SaldoCard";
import ReceitasDespesasCards from "@/components/dashboard/ReceitasDespesasCards";
import SaldoWalletCarousel from "@/components/dashboard/SaldoWalletCarousel";
import TransacoesRecentes from "@/components/dashboard/TransacoesRecentes";
import ProximosEventos from "@/components/dashboard/ProximosEventos";
import AssinaturasCard from "@/components/dashboard/AssinaturasCard";
import GastosPorCategoria from "@/components/dashboard/GastosPorCategoria";
import FinanceChartCard from "@/components/dashboard/FinanceChartCard";
import CardsOverviewSection from "@/components/dashboard/CardsOverviewSection";

import MetasResumoCard from "@/components/dashboard/MetasResumoCard";
import ParcelamentosAtivosCard from "@/components/dashboard/ParcelamentosAtivosCard";
import MonthSelector from "@/components/dashboard/MonthSelector";
import PagarEditarModal from "@/components/dashboard/PagarEditarModal";
import OnboardingCard from "@/components/dashboard/OnboardingCard";
import { useAuth } from "@/contexts/AuthContext";
import { useMonth } from "@/contexts/MonthContext";
import { useFinanceData } from "@/hooks/useFinanceData";
import type { Profile } from "@/hooks/useProfile";
import type { FinanceEvent } from "@/types/finance";

interface IndexOutletContext {
  profile: Profile | null;
  refetch: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  isOnboardingComplete: boolean;
}

const Index = () => {
  const { selectedMonth, selectedYear, setMonth } = useMonth();
  const [selectedEvent, setSelectedEvent] = useState<FinanceEvent | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, refetch } = useFinanceData(selectedMonth, selectedYear, { includeHistorical: false });
  const { profile, refetch: refetchProfile, updateDisplayName, isOnboardingComplete } = useOutletContext<IndexOutletContext>();
  const handleNovaTransacao = useCallback(() => {
    // Dispatch event to open the global type chooser
    window.dispatchEvent(new CustomEvent("open-nova-transacao-direct", { detail: { type: "despesa" } }));
  }, []);

  // Listen for global transaction-created event to refresh data
  useEffect(() => {
    const handleCreated = () => {
      refetch();
      refetchProfile();
    };
    window.addEventListener("transaction-created", handleCreated);
    return () => window.removeEventListener("transaction-created", handleCreated);
  }, [refetch, refetchProfile]);
  const { greeting, dateStr } = useGreeting();
  const userName = profile?.display_name || (user?.email?.split("@")[0] ?? "Usuário");

  const handleMonthChange = (month: number, year: number) => {
    setMonth(month, year);
  };

  const handleEventClick = (event: FinanceEvent) => {
    setSelectedEvent(event);
    setShowPayModal(true);
  };

  const receitas = data.receitas;
  const despesas = data.despesas;
  const balanco = receitas - despesas;
  const saldoMes = data.saldoAtual;
  const saldoPrevisto = data.saldoPrevisto;
  const isFutureMonth = data.isFutureMonth;

  const now = new Date();
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  // Only show full loading screen on very first load (no data at all yet)
  const isFirstLoad = loading && data === undefined;
  if (isFirstLoad) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-primary text-lg">Carregando dados...</div>
      </div>
    );
  }

  return (
    <>

        {/* DESKTOP LAYOUT */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_340px] gap-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <div className="pl-0.5">
                <h1 className="font-display text-lg font-bold leading-tight">
                   {greeting}, <span className="text-primary">{userName}</span>
                </h1>
                <p className="text-[10px] text-muted-foreground">{dateStr}</p>
              </div>
              <MonthSelector selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={handleMonthChange} />
            </div>
            {profile && !isOnboardingComplete && (
              <OnboardingCard
                profile={profile}
                onUpdateName={updateDisplayName}
                onGoToAccounts={() => navigate("/gestao?abrir=conta")}
                onCreateTransaction={handleNovaTransacao}
                onGoToCard={() => navigate("/gestao?abrir=cartao")}
                onCreateFixedExpense={handleNovaTransacao}
              />
            )}
            <div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-[1.4fr_1fr] gap-3">
                <SaldoCard saldoAtual={saldoMes} saldoPrevisto={saldoPrevisto} isFutureMonth={isFutureMonth} isPastMonth={data.isPastMonth} />
                <ReceitasDespesasCards receitas={receitas} receitasRecebidas={data.receitasRecebidas} receitasPendentes={data.receitasPendentes} despesas={despesas} despesasPagas={data.despesasPagas} despesasPendentes={data.despesasPendentes} compact />
              </motion.div>
            </div>
            {/* MicroInteracoesCard temporarily disabled */}
            {data.categories.length > 0 && (
              <GastosPorCategoria
                categories={data.categories}
                selectedMonth={selectedMonth}
                onVerAnalise={() => navigate("/transacoes")}
              />
            )}
            <TransacoesRecentes transactions={data.transactions} onDelete={refetch} />
            <ParcelamentosAtivosCard />
          </div>
          <div className="space-y-4">
            <WalletSummaryCard />
            {isCurrentMonth && <FinanceChartCard />}
            <FinanceOverviewCard receitas={receitas} despesas={despesas} saldoPrevisto={saldoPrevisto} nextMonthBalance={data.projection.nextMonthBalance} />
            <ProximosEventos events={data.events} selectedMonth={selectedMonth} selectedYear={selectedYear} onEventClick={handleEventClick} />
            <AssinaturasCard />
            <MetasResumoCard />
          </div>
        </div>

        {/* TABLET LAYOUT */}
        <div className="hidden md:block lg:hidden space-y-4">
          <div className="flex items-center justify-between mb-3">
            <div className="pl-0.5">
              <h1 className="font-display text-lg font-bold leading-tight">
                {greeting}, <span className="text-primary">{userName}</span>
              </h1>
              <p className="text-[10px] text-muted-foreground">{dateStr}</p>
            </div>
            <MonthSelector selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={handleMonthChange} />
          </div>
          {profile && !isOnboardingComplete && (
            <OnboardingCard
              profile={profile}
              onUpdateName={updateDisplayName}
              onGoToAccounts={() => navigate("/gestao?abrir=conta")}
              onCreateTransaction={handleNovaTransacao}
              onGoToCard={() => navigate("/gestao?abrir=cartao")}
              onCreateFixedExpense={handleNovaTransacao}
            />
          )}
          <SaldoWalletCarousel saldoAtual={saldoMes} saldoPrevisto={saldoPrevisto} isFutureMonth={isFutureMonth} isPastMonth={data.isPastMonth} />
          <ReceitasDespesasCards receitas={receitas} receitasRecebidas={data.receitasRecebidas} receitasPendentes={data.receitasPendentes} despesas={despesas} despesasPagas={data.despesasPagas} despesasPendentes={data.despesasPendentes} compact />
          {/* MicroInteracoesCard temporarily disabled */}
          <FinanceChartCard />
          {data.categories.length > 0 && (
            <GastosPorCategoria categories={data.categories} selectedMonth={selectedMonth} onVerAnalise={() => navigate("/transacoes")} />
          )}
          <FinanceOverviewCard receitas={receitas} despesas={despesas} saldoPrevisto={saldoPrevisto} nextMonthBalance={data.projection.nextMonthBalance} />
          <TransacoesRecentes transactions={data.transactions} onDelete={refetch} />
          <ProximosEventos events={data.events} selectedMonth={selectedMonth} selectedYear={selectedYear} onEventClick={handleEventClick} />
          <AssinaturasCard />
           <ParcelamentosAtivosCard />
           <MetasResumoCard />
        </div>

        {/* MOBILE LAYOUT */}
        <div className="md:hidden space-y-3">
          <BalanceHeroCard saldoAtual={saldoMes} />

          <MonthFiguresCard
            receitas={receitas}
            despesas={despesas}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={handleMonthChange}
          />
          {/* MicroInteracoesCard temporarily disabled */}
          {isCurrentMonth && <FinanceChartCard />}
          {profile && !isOnboardingComplete && (
            <OnboardingCard
              profile={profile}
              onUpdateName={updateDisplayName}
              onGoToAccounts={() => navigate("/gestao?abrir=conta")}
              onCreateTransaction={handleNovaTransacao}
              onGoToCard={() => navigate("/gestao?abrir=cartao")}
              onCreateFixedExpense={handleNovaTransacao}
            />
          )}
          <GastosPorCategoria categories={data.categories} selectedMonth={selectedMonth} onVerAnalise={() => navigate("/transacoes")} />
          <FinanceOverviewCard receitas={receitas} despesas={despesas} saldoPrevisto={saldoPrevisto} nextMonthBalance={data.projection.nextMonthBalance} />
          <CardsOverviewSection />
          <TransacoesRecentes transactions={data.transactions} onDelete={refetch} />
          <ProximosEventos events={data.events} selectedMonth={selectedMonth} selectedYear={selectedYear} onEventClick={handleEventClick} />
          <AssinaturasCard />
          <ParcelamentosAtivosCard />
          
          <MetasResumoCard />
        </div>
      <PagarEditarModal
        open={showPayModal}
        event={selectedEvent}
        onClose={() => { setShowPayModal(false); setSelectedEvent(null); }}
        onSuccess={refetch}
      />
    </>
  );
};

export default Index;
