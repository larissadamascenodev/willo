import { memo, useCallback, useEffect, useState } from "react";
import { Home, ArrowLeftRight, Plus, TrendingUp, TrendingDown, Camera, Sparkles } from "lucide-react";
import RegistroRapidoIcon from "@/components/registro/RegistroRapidoIcon";
import BotMark from "@/components/registro/BotMark";
import { Mic } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export const navItems: {
  icon: typeof Home;
  label: string;
  path?: string;
  /** Fires the same scanner the add menu uses, instead of navigating. */
  scan?: boolean;
  /** Shown but not reachable yet. */
  soon?: boolean;
}[] = [
  { icon: Home, label: "Início", path: "/" },
  { icon: ArrowLeftRight, label: "Transações", path: "/transacoes" },
  { icon: Sparkles, label: "Agentes", path: "/assistente" },
];

const openQuickEntry = () => window.dispatchEvent(new CustomEvent("open-registro-rapido"));

/**
 * The screens the nav belongs on.
 *
 * A section is somewhere you switch to; a page is somewhere you went into and come back
 * from. Carrying the nav into a page gives two ways out of it that mean different
 * things — one returns, the other abandons — stacked on top of each other at the bottom
 * of the screen. Pages get a back arrow instead, which is the only thing they need.
 */
export const NAV_SECTIONS = ["/", "/transacoes", "/assistente"];

export const isNavSection = (path: string) => NAV_SECTIONS.includes(path);

/* One curve for the whole fold, slow out of the gate and settling rather than snapping.
   A spring here read as a flinch every time the page moved, and the first eased version
   was still quick enough that the bar looked dropped rather than folded. */
const EASE = { duration: 0.58, ease: [0.32, 0.72, 0, 1] } as const;

/* The bar overhead leaves a little later than the row rearranges, so the two movements
   read as one thing handing over rather than as two things firing at once. */
const EASE_BAR = { duration: 0.5, ease: [0.32, 0.72, 0, 1], delay: 0.04 } as const;

/* The same curve as a CSS transition, for the widths that calc decides. */
const TRANSITION =
  "width .58s cubic-bezier(.32,.72,0,1), height .58s cubic-bezier(.32,.72,0,1)";

/** The invitation itself, in whichever shape the row is currently wearing. */
function QuickEntryContent({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <RegistroRapidoIcon
        className={cn("shrink-0 text-willo-green-ink", compact ? "h-[17px] w-[17px]" : "h-[19px] w-[19px]")}
      />
      <span className={cn("min-w-0 flex-1 truncate t-soft", compact ? "text-[13.5px]" : "text-[14.5px]")}>
        Registro rápido
      </span>
      <Mic
        className={cn("shrink-0 t-faint", compact ? "h-[15px] w-[15px]" : "h-[17px] w-[17px]")}
        strokeWidth={2.1}
      />
    </>
  );
}

const MobileBottomNav = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();

  // Folded once the page has moved enough that the bar would be in the way. The
  // threshold is generous so a thumb twitch does not make the row flap.
  const [scrolledPast, setScrolledPast] = useState(false);
  /* Held open on purpose: tapping Início while already on Início unfolds the row where
     you are, so the other sections are reachable without scrolling back to the top for
     them. The next scroll hands control back to the page. */
  const [heldOpen, setHeldOpen] = useState(false);
  const collapsed = scrolledPast && !heldOpen;

  // Pages are left alone; see NAV_SECTIONS.
  if (!isNavSection(location.pathname)) return null;

  return (
    <>
      {/* The bar that invites, above the bar that navigates — until you start reading.
          At the top of a screen there is room for an open invitation across the full
          width. Once the page is moving, that row is a thing in the way, so it folds
          into the nav between Início and Willo and the middle stops competing with it.
          Scrolling back up unfolds it. */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-5 md:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
      >
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.button
              key="quick-bar"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 46, marginBottom: 10 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={EASE_BAR}
              onClick={openQuickEntry}
              className="willo-float flex w-full items-center gap-2.5 overflow-hidden rounded-full pl-3.5 pr-4 text-left"
            >
              <QuickEntryContent />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Three separate things, the way the reference has them: Início on one end,
            Willo on the other, and the invitation between — its own piece of glass
            rather than a slot carved out of one long bar. */}
        {/* w-full, so the row is as wide as the screen allows and never as wide as its
            children want to be. Without it the measurement fed itself: the nav took the
            width it was given, the row grew to hold it, the observer read the bigger
            row, and the next frame pushed Willo further off the edge. */}
        <div className="flex w-full items-center gap-2.5">
          <BottomNavBar
            activePath={location.pathname}
            collapsed={collapsed}
            onNavigate={(path) => {
              // Already here: unfold where you are rather than going nowhere.
              if (path === location.pathname) setHeldOpen(true);
              else navigate(path);
            }}
            onPlus={() => navigate("/assistente")}
            middle={
              <button
                /* Always mounted, and it is the width that opens and closes. Mounting it
                   on arrival meant it had to fade in from nothing while the nav was
                   still shrinking, which is the part that looked dropped.
                   Two gaps of 10 and two ends of 50 is what it has to give back. */
                onClick={openQuickEntry}
                aria-hidden={!collapsed}
                style={{
                  width: collapsed ? "calc(100% - 120px)" : 0,
                  // Padding is a floor a width of 0 cannot push through: left in place it
                  // held 30px open next to Willo and pushed him off the edge. It closes
                  // with the width.
                  paddingLeft: collapsed ? 14 : 0,
                  paddingRight: collapsed ? 16 : 0,
                  opacity: collapsed ? 1 : 0,
                  pointerEvents: collapsed ? "auto" : "none",
                  transition: `${TRANSITION}, padding .58s cubic-bezier(.32,.72,0,1), opacity .4s ease`,
                }}
                className="willo-float flex h-[50px] shrink-0 items-center gap-2 overflow-hidden rounded-full text-left"
              >
                <QuickEntryContent compact />
              </button>
            }
          />
        </div>
      </div>
    </>
  );
});

MobileBottomNav.displayName = "MobileBottomNav";

/**
 * The nav pill + add button themselves, without positioning — the app pins
 * it to the bottom of the screen; the welcome showcase draws it inside its
 * phone so both always look exactly the same.
 */
export function BottomNavBar({ activePath, plusOpen = false, collapsed = false, middle, onNavigate, onPlus }: {
  activePath: string;
  plusOpen?: boolean;
  /** Folded: the nav shrinks to Início alone and `middle` takes the room it gave up. */
  collapsed?: boolean;
  /** Sits between the nav and Willo, as its own thing rather than inside either. */
  middle?: React.ReactNode;
  onNavigate?: (path: string) => void;
  onPlus?: () => void;
}) {
  const shown = collapsed ? navItems.slice(0, 1) : navItems;
  /* The row is a budget. Open, the ends can afford to be big and the icons grow to fill
     the pill edge to edge; folded, the invitation needs the middle, so the two ends give
     up height and width to pay for it. Spreading icons that stayed one size just left
     margins at both ends of the pill, which is the version that looks unfinished. */
  const end = collapsed ? 50 : 58;
  /* Open, the nav takes everything the other two leave: Willo's 58 and BOTH gaps. The
     invitation between them collapses to nothing, but a flex gap does not collapse with
     it, so the row still spends 20 on air — forgetting the second one is what pushed
     Willo ten pixels past the margin.
     Asking the browser with calc beats measuring the row, which could grow to fit what
     it was told and then report the larger number back. */
  const navWidth = collapsed ? `${end}px` : "calc(100% - 78px)";
  return (
    <>
      {/* isolate keeps the sliding pill from compositing above the icons: WebKit
          promotes a layoutId element to its own layer and paints it over
          non-composited siblings whatever the z-index says. */}
      <nav
        style={{ width: navWidth, height: end, transition: TRANSITION }}
        className="willo-float min-w-0 shrink-0 overflow-hidden rounded-full [isolation:isolate]"
      >
        <div className="flex h-full items-center justify-around px-1.5">
          {shown.map((item) => {
            const Icon = item.icon;
            const isActive = !!item.path && activePath === item.path;
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (item.soon) return;
                  if (item.scan) window.dispatchEvent(new CustomEvent("open-registro-rapido"));
                  else if (item.path) onNavigate?.(item.path);
                }}
                aria-label={item.soon ? `${item.label} — em breve` : item.label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center justify-center rounded-full",
                  collapsed ? "h-full w-full" : "mx-0.5 h-11 flex-1",
                )}
              >
                {/* A highlight behind the icon only while the nav is a long pill.
                    Folded, the nav IS a circle, so a circle inside it is a second ring
                    around the same thing. There the colour says it alone. */}
                {isActive && !collapsed && (
                  <span className="absolute inset-0 rounded-full bg-white/[0.10]" />
                )}
                <span className="relative flex">
                <Icon
                  className={cn(
                    "transform-gpu transition-colors",
                    collapsed ? "h-[21px] w-[21px]" : "h-[23px] w-[23px]",
                    // Where you are is the one place the house colour belongs here.
                    isActive ? "text-willo-green" : item.soon ? "t-faint" : "text-white/45",
                  )}
                  strokeWidth={isActive ? 2.25 : 2}
                />
                </span>
                {item.soon && (
                  <span className="absolute -top-0.5 right-1.5 h-1.5 w-1.5 rounded-full bg-willo-green" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {middle}

      <button
        onClick={onPlus}
        aria-label="Willo"
        style={{ width: end, height: end, transition: TRANSITION }}
        className="relative flex shrink-0 items-center justify-center rounded-full active:scale-95"
      >
        {/* Filling the button, so the only gap in the row is the one between the two
            pieces of glass rather than a ring of page showing around him. */}
        <BotMark size={end} />
      </button>
    </>
  );
}
export default MobileBottomNav;

export type AddActionType = "receita" | "despesa" | "transferencia" | "scanner";

/** Left to right along the arch; the two up top are the everyday ones. */
export const ADD_ACTIONS: { type: AddActionType; label: string; icon: typeof Plus; hex: string }[] = [
  { type: "receita", label: "Receita", icon: TrendingUp, hex: "#C8F36D" },
  { type: "despesa", label: "Despesa", icon: TrendingDown, hex: "#F87171" },
  { type: "scanner", label: "Escanear", icon: Camera, hex: "#7DD3FC" },
  { type: "transferencia", label: "Transferir", icon: ArrowLeftRight, hex: "#FFFFFF" },
];

const ARC_R = 148;
const ARC_ANGLES = [155, 113, 67, 25];
const arcPoint = (deg: number) => ({ x: ARC_R * Math.cos((deg * Math.PI) / 180), y: -ARC_R * Math.sin((deg * Math.PI) / 180) });
/** Where the orbs fly out from and back into: roughly the + button. */
const FROM = { x: 130, y: 70 };

/**
 * The "+" menu: the screen dims and the four actions fly out of the add
 * button into an arch of glass orbs above the nav. `inline` draws it inside
 * a positioned parent (the welcome showcase's phone) instead of the viewport.
 */
export function AddActionsMenu({ open, onClose, onSelect, inline = false, bottom }: {
  open: boolean;
  onClose: () => void;
  onSelect?: (type: AddActionType) => void;
  inline?: boolean;
  /** Distance from the bottom edge to the arch's center. */
  bottom?: string;
}) {
  useEffect(() => {
    if (!open || inline) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, inline, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className={cn(inline ? "absolute" : "fixed", "inset-0 z-40")}>
          {/* Lightly blurred screen that darkens towards the arch, so the labels read */}
          <motion.div
            className="absolute inset-0 backdrop-blur-[2px]"
            style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.68) 45%, rgba(0,0,0,0.9) 100%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          {/* Everything hangs off one point above the nav */}
          <div className="pointer-events-none absolute left-1/2 h-0 w-0" style={{ bottom: bottom ?? "calc(env(safe-area-inset-bottom, 0px) + 120px)" }}>
            <motion.div
              className="absolute w-[260px] text-center"
              style={{ left: -130, top: -ARC_R - 74 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ delay: 0.14 }}
            >
              <p className="text-[15px] font-medium tracking-tight text-white/82">O que você quer registrar?</p>
            </motion.div>

            {ADD_ACTIONS.map((action, i) => {
              const Icon = action.icon;
              const p = arcPoint(ARC_ANGLES[i]);
              return (
                <motion.button
                  key={action.type}
                  type="button"
                  data-action={action.type}
                  aria-label={action.label}
                  onClick={() => onSelect?.(action.type)}
                  className="pointer-events-auto absolute flex w-[84px] flex-col items-center"
                  style={{ left: -42, top: -34 }}
                  initial={{ x: FROM.x, y: FROM.y, scale: 0.3, rotate: -24, opacity: 0 }}
                  animate={{ x: p.x, y: p.y, scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ x: FROM.x, y: FROM.y, scale: 0.3, rotate: -24, opacity: 0, transition: { duration: 0.18, delay: (ADD_ACTIONS.length - 1 - i) * 0.02 } }}
                  transition={{ type: "spring", stiffness: 320, damping: 24, delay: 0.02 + (ADD_ACTIONS.length - 1 - i) * 0.05 }}
                  whileTap={{ scale: 0.92 }}
                >
                  {/* Glass orb: gradient hairline, dark core, the icon in the action's color */}
                  <span
                    className="relative flex h-[68px] w-[68px] rounded-full p-px"
                    style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.02) 100%)",
                      boxShadow: `0 22px 38px -22px ${action.hex}99`,
                    }}
                  >
                    <span
                      className="relative flex h-full w-full items-center justify-center rounded-full"
                      style={{ background: "radial-gradient(120% 120% at 50% 0%, #2B2B2B 0%, #151515 58%, #0D0D0D 100%)" }}
                    >
                      {/* One soft ripple as it lands */}
                      <motion.span
                        className="absolute inset-0 rounded-full border"
                        style={{ borderColor: `${action.hex}99` }}
                        initial={{ scale: 0.95, opacity: 0.6 }}
                        animate={{ scale: 1.4, opacity: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 + (ADD_ACTIONS.length - 1 - i) * 0.05, ease: "easeOut" }}
                      />
                      <Icon className="h-6 w-6" style={{ color: action.hex }} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span className="mt-2.5 text-[13px] font-semibold leading-tight text-white" style={{ textShadow: "0 1px 10px rgba(0,0,0,0.9)" }}>{action.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
