import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BrainCircuit, ChevronRight, Sparkles } from "lucide-react";
import { useRaioX, type RaioXData } from "@/hooks/useRaioX";
import { DailyLightCard, GoalsCountdown, ScoreCard } from "@/components/raiox/SummaryTab";
import { CurrentScenario, MonthComparison } from "@/components/raiox/NowTab";
import { PressureCalendar, SmartInvoice, Surplus } from "@/components/raiox/FutureTab";
import AnalysesTab from "@/components/raiox/AnalysesTab";
import SimulateTab from "@/components/raiox/SimulateTab";
import MonthWrapped from "@/components/raiox/MonthWrapped";
import { Segmented } from "@/components/raiox/primitives";

type Tab = "geral" | "simular";

const RaioX = () => {
  const result = useRaioX();
  const data = result.loading ? null : (result as RaioXData);
  const { hash } = useLocation();
  const [tab, setTab] = useState<Tab>("geral");
  const [wrapOpen, setWrapOpen] = useState(false);

  // Opened from a Radar shortcut: jump straight to the radar section
  useEffect(() => {
    if (!data) return;
    if (hash === "#simular") { setTab("simular"); window.scrollTo({ top: 0 }); return; }
    if (hash !== "#radar") return;
    setTab("geral");
  }, [hash, data]);

  const changeTab = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-lg pb-28">
      <header className="px-1 pt-1">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/56">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-willo-green opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-willo-green" />
          </span>
          Análise em tempo real
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-[30px] font-extrabold leading-none tracking-tight text-white">
          Raio-X
          <BrainCircuit className="h-6 w-6 text-willo-green" />
        </h1>
        <p className="mt-1.5 text-[14px] text-white/62">O cérebro do seu dinheiro: o que você faz certo, o que dá pra melhorar.</p>
      </header>

      {!data ? (
        <LoadingState />
      ) : !data.report.hasData ? (
        <EmptyState />
      ) : (
        <>
          <DailyLightCard data={data} />

          {data.wrap && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => setWrapOpen(true)}
              className="relative mt-2.5 flex w-full items-center gap-3 overflow-hidden rounded-[22px] p-3.5 text-left active:scale-[0.99] transition-transform"
              style={{ background: "linear-gradient(110deg, #3F6212 0%, #1E3A8A 55%, #86198F 100%)" }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-[22px]">✨</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-white">Retrospectiva de {data.wrap.monthLabel}</span>
                <span className="block text-[12px] text-white/85">Vilã, dia mais caro e sua maior conquista</span>
              </span>
              <ChevronRight className="h-5 w-5 text-white/80" />
            </motion.button>
          )}

          <div className="sticky top-[calc(env(safe-area-inset-top,0px)+8px)] z-30 mt-4 rounded-full shadow-[0_10px_30px_-10px_rgba(0,0,0,0.9)]">
            <Segmented
              value={tab}
              onChange={(t) => changeTab(t as Tab)}
              layoutId="raiox-tabs"
              options={[
                { key: "geral", label: "Geral" },
                { key: "simular", label: "Simular" },
              ]}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "geral" && (
                <>
                  <ScoreCard data={data} />
                  <CurrentScenario data={data} />
                  <MonthComparison data={data} />
                  <PressureCalendar data={data} />
                  <SmartInvoice data={data} />
                  <Surplus data={data} />
                  <AnalysesTab data={data} />
                  <GoalsCountdown data={data} />
                </>
              )}
              {tab === "simular" && <SimulateTab data={data} />}
            </motion.div>
          </AnimatePresence>

          {data.wrap && <MonthWrapped wrap={data.wrap} open={wrapOpen} onClose={() => setWrapOpen(false)} />}
        </>
      )}
    </div>
  );
};

function LoadingState() {
  return (
    <div className="mt-5 space-y-3">
      <div className="relative h-[300px] overflow-hidden rounded-[30px] border border-white/[0.06] willo-glass">
        <motion.div
          className="absolute inset-x-0 h-20 bg-gradient-to-b from-transparent to-white/[0.08]"
          animate={{ top: ["-20%", "100%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/66">
          <BrainCircuit className="h-7 w-7" />
          <p className="text-[14px]">Analisando suas finanças…</p>
        </div>
      </div>
      <div className="h-48 animate-pulse rounded-[24px] willo-glass" />
    </div>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="mt-12 flex flex-col items-center px-6 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04]">
        <Sparkles className="h-8 w-8 text-white/66" />
      </span>
      <p className="mt-5 text-[19px] font-bold text-white">Nada pra analisar ainda</p>
      <p className="mt-1 text-[14px] text-white/62">Adicione suas receitas e despesas e o Raio-X começa a trabalhar.</p>
      <button type="button" onClick={() => navigate("/transacoes")} className="mt-6 h-12 rounded-full bg-white px-6 text-[15px] font-semibold text-[#0B0B0B]">
        Adicionar transações
      </button>
    </div>
  );
}

export default RaioX;
