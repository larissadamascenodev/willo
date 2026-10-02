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
  const sobra = receitas - despesas;
  const animatedEntradas = useFormattedCounter(receitas);
  const animatedSaidas = useFormattedCounter(despesas);
  // How much of what came in is still here. A full bar is a month you kept; an empty
  // one is a month you spent, which is the thing the two figures alone never say.
  const kept = receitas > 0 ? Math.max(0, Math.min(100, (sobra / receitas) * 100)) : 0;

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
      className="relative -mx-4 overflow-hidden px-4"
      style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${68 + topInset}px)` }}
    >
      {/* Colour pooled behind the hero only: green low-left into blue high-right, over
          the wallpaper rather than instead of it. Positive z-index on the content above
          it, because a negative one would sink beneath the wallpaper layer. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px]"
        style={{
          background:
            "radial-gradient(120% 78% at 8% 96%, rgba(34,186,124,0.52) 0%, transparent 62%)," +
            "radial-gradient(110% 76% at 96% 6%, rgba(44,104,224,0.50) 0%, transparent 64%)," +
            "radial-gradient(90% 60% at 52% 46%, rgba(72,150,170,0.26) 0%, transparent 70%)",
          maskImage: "linear-gradient(180deg, #000 0%, #000 62%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 62%, transparent 100%)",
        }}
      />

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

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.14]">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-out ${
                sobra >= 0 ? "bg-willo-green" : "bg-red-400"
              }`}
              style={{ width: `${sobra >= 0 ? Math.max(kept, 2) : 100}%` }}
            />
          </div>

          <div className="mt-4 flex items-stretch">
            {[
              { key: "in", label: "Entradas", value: animatedEntradas, to: "/detalhe/receitas",
                Icon: ArrowDownLeft, ring: "bg-willo-green/20 text-willo-green" },
              { key: "out", label: "Saídas", value: animatedSaidas, to: "/detalhe/despesas",
                Icon: ArrowUpRight, ring: "bg-red-500/20 text-red-400" },
            ].map(({ key, label, value, to, Icon, ring }, i) => (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); navigate(to); }}
                className={`flex min-w-0 flex-1 items-center gap-2.5 text-left active:opacity-70 ${
                  i === 0 ? "pr-3" : "pl-3"
                }`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ring}`}>
                  <Icon className="h-[15px] w-[15px]" strokeWidth={2.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] text-white/66">{label}</span>
                  <span className="block truncate text-[14.5px] font-bold tracking-tight text-white tabular-nums">
                    {hidden ? `${currencySymbol()} ••••` : value}
                  </span>
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
