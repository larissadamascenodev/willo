import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { User, Bell, Eye, EyeOff, ArrowDownLeft, ArrowUpRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useFormattedCounter } from "@/hooks/useAnimatedCounter";
import { useHiddenValues, setHiddenValues } from "@/hooks/useHiddenValues";
import NotificationsPanel, { useNotifications } from "./NotificationsPanel";
import HomeSectionTabs from "./HomeSectionTabs";
import { useGreeting } from "./DashboardHeader";
import { useProfile } from "@/hooks/useProfile";

import { currencySymbol } from "@/lib/currency";

interface Props {
  saldoAtual: number;
  receitas: number;
  despesas: number;
  /** Extra space above the top row (px), e.g. under a drawn status bar. */
  topInset?: number;
}

/**
 * The page header: who is signed in, the controls, the section pills and the
 * greeting. The month's figures are a card further down the stack — the top of
 * the screen is for orientation, not for numbers.
 */
const BalanceHeroCard = ({ saldoAtual, receitas, despesas, topInset = 0 }: Props) => {
  const navigate = useNavigate();
  const hidden = useHiddenValues();
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount, refresh } = useNotifications();
  const { profile } = useProfile();
  const { greeting } = useGreeting();
  const firstName = profile?.display_name?.trim().split(" ")[0] ?? "";
  const initial = profile?.display_name?.trim().charAt(0).toUpperCase();
  const animatedSaldo = useFormattedCounter(saldoAtual);
  const animatedReceitas = useFormattedCounter(receitas);
  const animatedDespesas = useFormattedCounter(despesas);
  const heroRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Once the header scrolls away, show a compact translucent bar pinned to the top.
  useEffect(() => {
    const onScroll = () => {
      const el = heroRef.current;
      if (el) setCollapsed(el.getBoundingClientRect().bottom < 10);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /** The translucent control surface the pills and the round buttons share. */
  const control =
    "border border-white/[0.34] willo-glass-control shadow-[inset_0_1px_0_rgba(255,255,255,0.26)]";

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
          <div className={`flex items-center gap-3 rounded-full pl-1.5 pr-2 py-1.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.8)] ${control}`}>
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
              onClick={() => setHiddenValues(!hidden)}
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
      className="relative -mx-4 px-4 pb-1"
      style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${14 + topInset}px)` }}
    >
      {/* Avatar alone on the left; hide-values, notifications and the assistant on the right */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => navigate("/configuracoes")}
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.34] bg-white/10 text-[15px] font-bold text-white active:opacity-70"
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
            onClick={() => setHiddenValues(!hidden)}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-white/90 active:opacity-70 ${control}`}
            aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
          >
            {hidden ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>

          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className={`relative flex h-11 w-11 items-center justify-center rounded-full text-white/90 active:opacity-70 ${control}`}
              aria-label="Notificações"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-willo-green ring-2 ring-black/70" />
              )}
            </button>
            <NotificationsPanel open={notifOpen} onClose={() => { setNotifOpen(false); refresh(); }} />
          </div>

          <button
            onClick={() => toast("O assistente da Willo chega em breve")}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-willo-green pl-3.5 pr-3 text-[14px] font-bold text-[#0B0B0B] shadow-[0_8px_24px_-10px_rgba(200,243,109,0.7)] active:opacity-80"
          >
            Willo IA
            <Sparkles className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <HomeSectionTabs />
      </div>

      {/* The greeting carries the name, so the avatar needs no label beside it */}
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-11 truncate text-[30px] font-normal leading-tight tracking-tight text-white"
      >
        {greeting}{firstName ? `, ${firstName}` : ""}
      </motion.h1>
    </div>
    </>
  );
};

export default BalanceHeroCard;
