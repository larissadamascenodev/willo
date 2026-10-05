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
  /** Off inside the welcome showcase, which scrolls its own phone rather than the
      window — pinning there would stick this block to the real viewport. */
  pinned?: boolean;
}

/**
 * The page header: who is signed in, the controls, the section pills and the
 * greeting. The month's figures are a card further down the stack — the top of
 * the screen is for orientation, not for numbers.
 */
/** How far the page scrolls before the pinned block has fully receded. */
const PIN_TRAVEL = 190;

const BalanceHeroCard = ({ topInset = 0, slot, pinned = true }: Props) => {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount, refresh } = useNotifications();
  const { profile } = useProfile();
  const { greeting } = useGreeting();
  const firstName = profile?.display_name?.trim().split(" ")[0] ?? "";
  const initial = profile?.display_name?.trim().charAt(0).toUpperCase();

  const heroRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const [pinnedHeight, setPinnedHeight] = useState(0);
  const [progress, setProgress] = useState(0);

  // This block does not scroll: it stays where it is and recedes — blurring, dimming
  // and sinking slightly — while the cards travel up over it. Progress is how far
  // into that recession we are, and everything else here reads off it.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setProgress(Math.min(Math.max(window.scrollY / PIN_TRAVEL, 0), 1));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // The spacer below has to be exactly as tall as what was lifted out of the flow,
  // or the first card starts in the wrong place — and it changes with the carousel.
  useEffect(() => {
    const el = pinnedRef.current;
    if (!pinned || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setPinnedHeight(el.offsetHeight));
    ro.observe(el);
    setPinnedHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [pinned]);

  // The name takes over in the header once the greeting has faded far enough that
  // reading it is no longer the point.
  const collapsed = progress > 0.55;

  // The pinned block carries this padding itself, so the spacer must not count it twice.
  const heroPadTop = 70 + topInset;

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

        {/* Beside the photo, where a name belongs. It greets you while the top of the
            screen is still being read and drops to the bare name once it is not. */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={collapsed ? "short" : "long"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-[-0.02em] text-white"
          >
            {collapsed ? firstName : `${greeting}${firstName ? `, ${firstName}` : ""}`}
          </motion.span>
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

      {/* Pinned. The pills, the greeting and the slot stay put at the top of the
          screen; the cards are what move. Once it has receded far enough it stops
          taking taps, since by then you cannot read what you would be tapping. */}
      <div
        ref={pinnedRef}
        className={pinned ? "fixed inset-x-0 z-10 px-4" : "relative z-10"}
        style={pinned ? {
          top: 0,
          paddingTop: `calc(env(safe-area-inset-top, 0px) + ${heroPadTop}px)`,
          filter: progress > 0.001 ? `blur(${(progress * 13).toFixed(2)}px)` : undefined,
          opacity: 1 - progress * 0.78,
          transform: `scale(${1 - progress * 0.035})`,
          transformOrigin: "50% 0%",
          willChange: "filter, opacity, transform",
          pointerEvents: progress > 0.4 ? "none" : undefined,
        } : undefined}
      >
        {/* Whatever the page is reading out, straight onto the background — no card,
            so there is no edge across the top of the screen to read as a seam. The
            section pills sit last, landing directly above the first card. */}
        {slot ?? <div className="h-[118px]" aria-hidden="true" />}

        <div className="mt-8 pb-5">
          <HomeSectionTabs />
        </div>
      </div>

      {/* Holds the room the pinned block would have taken, so the first card starts
          where it would have. */}
      {pinned && <div aria-hidden="true" style={{ height: pinnedHeight ? pinnedHeight - heroPadTop : undefined }} />}
    </div>
    </>
  );
};

export default BalanceHeroCard;
