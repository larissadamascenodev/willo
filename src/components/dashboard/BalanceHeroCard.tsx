import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { User, Bell, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFormattedCounter } from "@/hooks/useAnimatedCounter";
import { useHiddenValues, setHiddenValues } from "@/hooks/useHiddenValues";
import NotificationsPanel, { useNotifications } from "./NotificationsPanel";
import HomeSectionTabs from "./HomeSectionTabs";
import { useGreeting } from "./DashboardHeader";
import { useProfile } from "@/hooks/useProfile";

import { currencySymbol } from "@/lib/currency";

interface Props {
  saldoAtual: number;
  saldoPrevisto: number;
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
const BalanceHeroCard = ({ saldoAtual, saldoPrevisto, receitas, despesas, topInset = 0 }: Props) => {
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
  const animatedPrevisto = useFormattedCounter(saldoPrevisto);

  // Two taps anywhere on the hero start a new entry, the way the + button does.
  const lastTap = useRef(0);
  const onHeroTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      window.dispatchEvent(new CustomEvent("open-nova-transacao-direct", { detail: { type: "despesa" } }));
    } else {
      lastTap.current = now;
    }
  };
  const heroRef = useRef<HTMLDivElement>(null);
  const greetingRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // The name appears in the header once the greeting it duplicates has scrolled off.
  useEffect(() => {
    const onScroll = () => {
      const el = greetingRef.current;
      if (el) setCollapsed(el.getBoundingClientRect().bottom < 96);
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
    <div
      ref={heroRef}
      className="relative -mx-4 px-4"
      style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${68 + topInset}px)` }}
    >
      {/* The header stays put while everything else scrolls under it. Fixed rather than
          sticky: sticky would unpin the moment this block scrolls past. */}
      <div
        className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-4 pb-2.5"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${14 + topInset}px)` }}
      >
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

        <AnimatePresence>
          {collapsed && firstName && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0 flex-1 truncate text-[19px] font-bold tracking-tight text-white"
            >
              {firstName}
            </motion.span>
          )}
        </AnimatePresence>

        <div className="ml-auto flex shrink-0 items-center gap-2">
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

        </div>
      </div>

      <div className="relative z-10 mt-3.5">
        <HomeSectionTabs />
      </div>

      {/* Greeting, then the one number that answers "can I spend?" — what is left of
          the month rather than what is in the account today. */}
      <div
        ref={greetingRef}
        onClick={onHeroTap}
        className="relative z-10 mt-9"
      >
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="truncate text-[28px] font-normal leading-tight tracking-tight text-white"
        >
          {greeting}{firstName ? `, ${firstName}` : ""}
        </motion.p>
        <p className="mt-1 text-[13px] text-white/56">Toque duas vezes aqui para lançar</p>

        <div className="willo-glass mt-4 rounded-[24px] border border-white/[0.12] p-[18px]">
          <p className="text-[13px] text-white/66">Saldo disponível</p>
          <p className="mt-2 truncate text-[34px] font-extrabold leading-none tracking-[-0.035em] text-white tabular-nums">
            {hidden ? `${currencySymbol()} ••••••` : animatedSaldo}
          </p>

          <p className="mt-2.5 truncate text-[13px] text-white/60">
            Previsto no fim do mês:{" "}
            <span className="font-semibold text-white/80 tabular-nums">
              {hidden ? `${currencySymbol()} ••••` : animatedPrevisto}
            </span>
          </p>

          <div className="mt-4 flex items-stretch border-t border-white/[0.12] pt-4">
            {[
              { key: "in", label: "Receitas", value: animatedReceitas, to: "/detalhe/receitas",
                Icon: ArrowDownLeft, iconCls: "text-willo-green" },
              { key: "out", label: "Despesas", value: animatedDespesas, to: "/detalhe/despesas",
                Icon: ArrowUpRight, iconCls: "text-red-400" },
            ].map(({ key, label, value, to, Icon, iconCls }, i) => (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); navigate(to); }}
                className={`min-w-0 flex-1 text-left active:opacity-70 ${
                  i === 0 ? "pr-4" : "border-l border-white/[0.12] pl-4"
                }`}
              >
                <span className="flex items-center gap-1.5 text-[13px] text-white/66">
                  <Icon className={`h-3.5 w-3.5 ${iconCls}`} strokeWidth={2.6} />
                  {label}
                </span>
                <span className="mt-1.5 block truncate text-[19px] font-extrabold tracking-tight text-white tabular-nums">
                  {hidden ? `${currencySymbol()} ••••` : value}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default BalanceHeroCard;
