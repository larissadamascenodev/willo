import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { User, Bell, Eye, EyeOff, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFormattedCounter } from "@/hooks/useAnimatedCounter";
import NotificationsPanel, { useNotifications } from "./NotificationsPanel";
import MonthSelector from "./MonthSelector";
import { useProfile } from "@/hooks/useProfile";
import wordmarkOnDark from "@/assets/logo/willo-wordmark-light.png";

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
      className="relative overflow-hidden -mx-4 rounded-b-[32px] px-4 pb-6 border-b border-white/[0.09]"
      style={{
        paddingTop: `calc(env(safe-area-inset-top, 0px) + ${14 + topInset}px)`,
        background: "linear-gradient(165deg, rgba(34,34,34,0.95) 0%, rgba(18,18,18,0.97) 55%, rgba(10,10,10,0.98) 100%)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.14), inset 0 -1px 0 0 rgba(255,255,255,0.04), 0 18px 40px -16px rgba(0,0,0,0.85)",
      }}
    >
      {/* Droplet-style glossy highlight */}
      <div className="pointer-events-none absolute -top-24 -left-16 w-64 h-64 rounded-full bg-white/[0.05] blur-3xl" />
      
      {/* Top row: logo + notifications/profile */}
      <div className="relative flex items-center justify-between mb-5">
        <img src={wordmarkOnDark} alt="Willo" className="h-5 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative w-9 h-9 flex items-center justify-center text-white/85 hover:text-white transition-colors"
              aria-label="Notificações"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-willo-green ring-2 ring-[#1c1c1c]" />}
            </button>
            <NotificationsPanel open={notifOpen} onClose={() => { setNotifOpen(false); refresh(); }} />
          </div>
          <button
            onClick={() => navigate("/configuracoes")}
            className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-[13px] font-bold text-white active:scale-95 transition-transform"
            aria-label="Perfil"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : initial ? (
              initial
            ) : (
              <User className="w-4 h-4 text-white/80" />
            )}
          </button>
        </div>
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <p className="text-[12px] text-white/50">Saldo disponível</p>
        <MonthSelector selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={onMonthChange} />
      </div>
      <div className="relative flex items-center justify-between mt-2 gap-3">
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

      {/* Receitas / Despesas — inline with the balance, no separate cards */}
      <div className="relative mt-4 pt-4 border-t border-white/[0.08] flex items-stretch">
        {[
          { label: "Receitas", value: animatedReceitas, to: "/detalhe/receitas", Icon: ArrowDownLeft, iconCls: "text-willo-green" },
          { label: "Despesas", value: animatedDespesas, to: "/detalhe/despesas", Icon: ArrowUpRight, iconCls: "text-red-400" },
        ].map(({ label, value, to, Icon, iconCls }, i) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className={`flex-1 min-w-0 text-left active:opacity-70 transition-opacity ${i === 1 ? "pl-4 border-l border-white/[0.08]" : "pr-4"}`}
          >
            <span className="flex items-center gap-1 text-[12px] text-white/45">
              <Icon className={`w-3.5 h-3.5 ${iconCls}`} strokeWidth={2.5} />
              {label}
            </span>
            <span className="block mt-1 text-[17px] font-bold text-white tracking-tight tabular-nums leading-tight truncate">
              {hidden ? `${currencySymbol()} ••••` : value}
            </span>
          </button>
        ))}
      </div>
    </div>
    </>
  );
};

export default BalanceHeroCard;
