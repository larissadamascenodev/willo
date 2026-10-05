import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { User, Bell, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useHiddenValues, setHiddenValues } from "@/hooks/useHiddenValues";
import NotificationsPanel, { useNotifications } from "./NotificationsPanel";
import HomeSectionTabs from "./HomeSectionTabs";
import { useGreeting } from "./DashboardHeader";
import { useProfile } from "@/hooks/useProfile";


interface Props {
  /** Extra space above the top row (px), e.g. under a drawn status bar. */
  topInset?: number;
  /** Fills the room under the greeting. Left empty, it is simply open space. */
  slot?: React.ReactNode;
}

/**
 * The page header: who is signed in, the controls, the section pills and the
 * greeting. The month's figures are a card further down the stack — the top of
 * the screen is for orientation, not for numbers.
 */
const BalanceHeroCard = ({ topInset = 0, slot }: Props) => {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount, refresh } = useNotifications();
  const { profile } = useProfile();
  const { greeting } = useGreeting();
  const firstName = profile?.display_name?.trim().split(" ")[0] ?? "";
  const initial = profile?.display_name?.trim().charAt(0).toUpperCase();

  const heroRef = useRef<HTMLDivElement>(null);
  const greetingRef = useRef<HTMLParagraphElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // The name appears in the header once the greeting it duplicates has scrolled off.
  useEffect(() => {
    const onScroll = () => {
      const el = greetingRef.current;
      // Measured against the header's own bottom edge, so the name takes over at the
      // exact moment the greeting it repeats slides out of sight.
      if (el) setCollapsed(el.getBoundingClientRect().bottom < 62 + topInset);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [topInset]);

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
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-white active:opacity-70"
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

      <div className="relative z-10 mt-5">
        <HomeSectionTabs />
      </div>

      {/* Greeting, and then whatever the page puts in the room the balance card used
          to take — that card asked the same question as "Saldo em contas" below, so it
          went, and the space stayed. */}
      <div className="relative z-10 mt-12">
        <motion.p
          ref={greetingRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="truncate text-[30px] font-bold leading-[1.12] tracking-[-0.03em] text-white"
        >
          {greeting}{firstName ? `, ${firstName}` : ""}
        </motion.p>
        <p className="mt-1 text-[13px] text-white/56">Toque duas vezes na tela para lançar</p>

        {slot ?? <div className="mt-4 h-[129px]" aria-hidden="true" />}
      </div>
    </div>
    </>
  );
};

export default BalanceHeroCard;
