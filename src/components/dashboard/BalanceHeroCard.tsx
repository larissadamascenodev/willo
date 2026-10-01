import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { User, Bell, Eye, EyeOff, ArrowDownLeft, ArrowUpRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useFormattedCounter } from "@/hooks/useAnimatedCounter";
import NotificationsPanel, { useNotifications } from "./NotificationsPanel";
import MonthSelector from "./MonthSelector";
import HomeSectionTabs from "./HomeSectionTabs";
import { useGreeting } from "./DashboardHeader";
import { useProfile } from "@/hooks/useProfile";

import { currencySymbol, getCurrency } from "@/lib/currency";
interface Props {
  saldoAtual: number;
  changeAmount: number;
  changePercent: number;
  receitas: number;
  despesas: number;
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
  /** Extra space above the top row (px), e.g. under a drawn status bar. */
  topInset?: number;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
}

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Top of the mobile dashboard. The avatar stands alone on the left and the
 * controls sit on the right; underneath, a wide aurora lights the section pills
 * and the greeting, and the month's figures live in one swipeable card instead
 * of being spread across the header.
 */
const BalanceHeroCard = ({
  saldoAtual, changeAmount, changePercent, receitas, despesas,
  selectedMonth, selectedYear, onMonthChange, topInset = 0,
}: Props) => {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount, refresh } = useNotifications();
  const { profile } = useProfile();
  const { greeting } = useGreeting();
  const firstName = profile?.display_name?.trim().split(" ")[0] ?? "";
  const initial = profile?.display_name?.trim().charAt(0).toUpperCase();
  const animatedSaldo = useFormattedCounter(saldoAtual);
  const animatedReceitas = useFormattedCounter(receitas);
  const animatedDespesas = useFormattedCounter(despesas);
  const isPositive = changeAmount >= 0;
  const heroRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [slide, setSlide] = useState(0);

  const balanco = receitas - despesas;
  const monthLabel = MONTH_NAMES[selectedMonth];

  // Once the hero starts scrolling away, show a compact translucent bar pinned to the top.
  useEffect(() => {
    const onScroll = () => {
      const el = heroRef.current;
      if (el) setCollapsed(el.getBoundingClientRect().top < -70);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const mask = (v: string) => (hidden ? `${currencySymbol()} ••••` : v);

  const slides: { key: string; label: string; value: string; foot: JSX.Element; to: string | null }[] = [
    {
      key: "saldo",
      label: "Saldo disponível",
      value: hidden ? `${currencySymbol()} ••••••` : animatedSaldo,
      foot: (
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-white/60 tabular-nums">
            {isPositive ? "+" : "-"}{formatCurrency(Math.abs(changeAmount))}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              isPositive ? "bg-willo-green/20 text-willo-green" : "bg-red-500/20 text-red-400"
            }`}
          >
            {isPositive ? "+" : "-"}{Math.abs(changePercent).toFixed(2)}%
          </span>
        </span>
      ),
      to: null,
    },
    {
      key: "receitas",
      label: "Receitas",
      value: mask(animatedReceitas),
      foot: (
        <span className="flex items-center gap-1.5 text-[13px] text-white/50">
          <ArrowDownLeft className="h-3.5 w-3.5 text-willo-green" strokeWidth={2.5} />
          o que entrou em {monthLabel}
        </span>
      ),
      to: "/detalhe/receitas",
    },
    {
      key: "despesas",
      label: "Despesas",
      value: mask(animatedDespesas),
      foot: (
        <span className="flex items-center gap-1.5 text-[13px] text-white/50">
          <ArrowUpRight className="h-3.5 w-3.5 text-red-400" strokeWidth={2.5} />
          o que saiu em {monthLabel}
        </span>
      ),
      to: "/detalhe/despesas",
    },
    {
      key: "balanco",
      label: "Balanço do mês",
      value: hidden
        ? `${currencySymbol()} ••••`
        : `${balanco >= 0 ? "+" : "-"}${formatCurrency(Math.abs(balanco))}`,
      foot: (
        <span className="text-[13px] text-white/50">
          {balanco >= 0 ? "sobrou" : "faltou"} em {monthLabel}
        </span>
      ),
      to: null,
    },
  ];

  const onTrackScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setSlide(Math.max(0, Math.min(slides.length - 1, i)));
  };

  const goToSlide = (i: number) => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <>
    <AnimatePresence>
      {collapsed && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="md:hidden fixed top-0 inset-x-0 z-40 px-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
        >
          <div
            className="flex items-center gap-3 rounded-full border border-white/[0.10] pl-1.5 pr-2 py-1.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.8)]"
            style={{
              background: "rgba(22,22,22,0.62)",
              backdropFilter: "blur(22px) saturate(170%)",
              WebkitBackdropFilter: "blur(22px) saturate(170%)",
            }}
          >
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
              aria-label="Voltar ao topo"
            >
              <span className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-[13px] font-bold text-white shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : initial ? initial : <User className="w-4 h-4 text-white/80" />}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[10px] text-white/45">Saldo</span>
                <span className="block text-[15px] font-bold text-white tabular-nums truncate">
                  {hidden ? `${currencySymbol()} ••••` : animatedSaldo}
                </span>
              </span>
            </button>
            <div className="flex flex-col items-end leading-tight shrink-0">
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-white/85 tabular-nums">
                <ArrowDownLeft className="w-3 h-3 text-willo-green" strokeWidth={2.5} />
                {hidden ? "••••" : animatedReceitas}
              </span>
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-white/85 tabular-nums">
                <ArrowUpRight className="w-3 h-3 text-red-400" strokeWidth={2.5} />
                {hidden ? "••••" : animatedDespesas}
              </span>
            </div>
            <button
              onClick={() => setHidden((v) => !v)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 shrink-0"
              aria-label={hidden ? "Mostrar saldo" : "Ocultar saldo"}
            >
              {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    <div
      ref={heroRef}
      className="relative -mx-4 px-4 pb-2"
      style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${14 + topInset}px)` }}
    >
      {/* Aurora behind the pills and the greeting. Masked to an ellipse so every edge
          dies into the page instead of showing the gradient's own corners. */}
      <div className="pointer-events-none absolute inset-x-0 top-[18px] -z-10 h-[320px]">
        <div
          className="absolute inset-x-4 inset-y-0"
          style={{
            WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 48%, #000 40%, transparent 84%)",
            maskImage: "radial-gradient(ellipse 80% 70% at 50% 48%, #000 40%, transparent 84%)",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, #1E7BFF 0%, #3D62F0 18%, #7B3BD6 34%, #C32A66 52%, #D9452C 68%, #D9A62A 84%, #93D13C 100%)",
              filter: "blur(46px)",
              opacity: 0.95,
            }}
          />
        </div>
      </div>

      {/* Avatar alone on the left; hide-values, notifications and the assistant on the right */}
      <div className="relative flex items-center justify-between gap-2">
        <button
          onClick={() => navigate("/configuracoes")}
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-[15px] font-bold text-white active:opacity-70"
          aria-label="Perfil"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : initial ? (
            initial
          ) : (
            <User className="h-[18px] w-[18px] text-white/80" />
          )}
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setHidden((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.07] text-white/85 backdrop-blur-xl active:opacity-70"
            aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
          >
            {hidden ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>

          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.07] text-white/85 backdrop-blur-xl active:opacity-70"
              aria-label="Notificações"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-willo-green ring-2 ring-black" />
              )}
            </button>
            <NotificationsPanel open={notifOpen} onClose={() => { setNotifOpen(false); refresh(); }} />
          </div>

          <button
            onClick={() => toast("O assistente da Willo chega em breve")}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-willo-green pl-3.5 pr-3 text-[14px] font-bold text-[#0B0B0B] active:opacity-80"
          >
            Willo IA
            <Sparkles className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Section pills, sitting on the aurora */}
      <div className="relative mt-6">
        <HomeSectionTabs />
      </div>

      {/* The greeting carries the name, so the avatar needs no label beside it */}
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative mt-[88px] truncate text-[30px] font-normal leading-tight tracking-tight text-white"
      >
        {greeting}{firstName ? `, ${firstName}` : ""}
      </motion.h1>

      {/* The month's figures, one per page */}
      <div className="relative mt-5 overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#141416]">
        <div className="absolute right-4 top-4 z-10">
          <MonthSelector selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={onMonthChange} />
        </div>

        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none"
        >
          {slides.map((s) => (
            <div
              key={s.key}
              onClick={() => s.to && navigate(s.to)}
              className={`w-full shrink-0 snap-center px-5 pb-4 pt-5 ${s.to ? "cursor-pointer active:opacity-70" : ""}`}
            >
              <span className="block text-[12.5px] text-white/50">{s.label}</span>
              <p className="mt-2 truncate text-[34px] font-extrabold leading-none tracking-tight text-white tabular-nums">
                {s.value}
              </p>
              <div className="mt-2.5">{s.foot}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-1.5 pb-3.5">
          {slides.map((s, i) => (
            <button
              key={s.key}
              onClick={() => goToSlide(i)}
              aria-label={s.label}
              className={`h-1.5 rounded-full transition-all ${
                i === slide ? "w-5 bg-white/85" : "w-1.5 bg-white/25"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
    </>
  );
};

export default BalanceHeroCard;
