import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { User, Bell, Eye, EyeOff, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  /** Extra space above the logo row (px), e.g. under a drawn status bar. */
  topInset?: number;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
}

/**
 * Full-bleed dark "hero" card spanning the top of the mobile dashboard —
 * logo + profile/notifications, big balance with a show/hide toggle, a
 * net-change pill, the month selector and a Receitas/Despesas breakdown,
 * all folded into one glassy translucent surface. Replaces the plain sticky mobile header on this
 * route (see DashboardHeader.tsx).
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
  const initial = profile?.display_name?.trim().charAt(0).toUpperCase();
  const animatedSaldo = useFormattedCounter(saldoAtual);
  const animatedReceitas = useFormattedCounter(receitas);
  const animatedDespesas = useFormattedCounter(despesas);
  const { greeting } = useGreeting();
  const isPositive = changeAmount >= 0;
  const heroRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

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
      className="relative -mx-4 px-4 pb-7"
      style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${14 + topInset}px)` }}
    >
      {/* The balance sits on the page itself, lit from behind. The glow runs past the bottom of
          the hero so the first cards overlap it and read as floating in front of the backdrop,
          instead of the balance being yet another card. Solid blobs + blur, not soft radials —
          a gradient that already fades out loses almost all of its energy to the blur. */}
      <div className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-[540px] overflow-hidden">
        {/* Blue over the pills, warm through the middle, green where the cards start —
            the bands stay apart so the glass above them picks up a colour instead of grey mud. */}
        {/* Just enough cool light over the pills for the glass to have something to
            catch; the silk backdrop carries the rest. */}
        <div
          className="absolute right-[-14%] top-[-90px] h-[260px] w-[300px] rounded-full blur-[70px]"
          style={{ background: "rgba(96,132,186,0.30)" }}
        />
        <div
          className="absolute left-[-20%] top-[-40px] h-[220px] w-[240px] rounded-full blur-[70px]"
          style={{ background: "rgba(72,98,142,0.24)" }}
        />
      </div>

      {/* Who is signed in and the bell live in the page header now, above the pills */}
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate("/configuracoes")}
          className="flex min-w-0 items-center gap-2.5 active:opacity-70"
          aria-label="Perfil"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-[14px] font-bold text-white">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : initial ? (
              initial
            ) : (
              <User className="h-4 w-4 text-white/80" />
            )}
          </span>
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0 truncate text-[16px] font-semibold tracking-tight text-white"
          >
            {profile?.display_name?.split(" ")[0] ?? ""}
          </motion.span>
        </button>
        <div className="relative shrink-0">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white/85 transition-colors active:opacity-70"
            aria-label="Notificações"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-willo-green ring-2 ring-[#1c1c1c]" />}
          </button>
          <NotificationsPanel open={notifOpen} onClose={() => { setNotifOpen(false); refresh(); }} />
        </div>
      </div>

      <div className="relative mb-5">
        <HomeSectionTabs />
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-white/90">
          {greeting}{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}
        </p>
        <MonthSelector selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={onMonthChange} />
      </div>
      <div className="relative flex items-center justify-between mt-2.5 gap-3">
        <p className="text-[34px] font-extrabold text-white tracking-tight tabular-nums leading-none truncate">
          {hidden ? `${currencySymbol()} ••••••` : animatedSaldo}
        </p>
        <button
          onClick={() => setHidden((v) => !v)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/70 shrink-0"
          aria-label={hidden ? "Mostrar saldo" : "Ocultar saldo"}
        >
          {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <p className="relative mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        Saldo disponível
      </p>

      <div className="relative flex items-center gap-2 mt-2.5">
        <span className="text-[13px] font-medium text-white/60">
          {isPositive ? "+" : "-"}{formatCurrency(Math.abs(changeAmount))}
        </span>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            isPositive ? "bg-willo-green/20 text-willo-green" : "bg-red-500/20 text-red-400"
          }`}
        >
          {isPositive ? "+" : "-"}{Math.abs(changePercent).toFixed(2)}%
        </span>
      </div>

      {/* Receitas e despesas descem para o primeiro card, logo abaixo do brilho */}
    </div>
    </>
  );
};

export default BalanceHeroCard;
