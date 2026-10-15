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

const MobileBottomNav = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();

  // Folded once the page has moved enough that the bar would be in the way. The
  // threshold is generous so a thumb twitch does not make the row flap.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const read = () => setCollapsed(window.scrollY > 90);
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, []);

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
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              onClick={openQuickEntry}
              className="willo-float flex w-full items-center gap-2.5 overflow-hidden rounded-full pl-3.5 pr-4 text-left"
            >
              <RegistroRapidoIcon className="h-[19px] w-[19px] shrink-0 text-willo-green-ink" />
              <span className="min-w-0 flex-1 truncate text-[14.5px] t-soft">Registro rápido</span>
              <Mic className="h-[17px] w-[17px] shrink-0 t-faint" strokeWidth={2.1} />
            </motion.button>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-3">
          <BottomNavBar
            activePath={location.pathname}
            collapsed={collapsed}
            onNavigate={(path) => navigate(path)}
            onPlus={() => navigate("/assistente")}
            onQuickEntry={openQuickEntry}
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
export function BottomNavBar({ activePath, plusOpen = false, collapsed = false, onNavigate, onPlus, onQuickEntry }: {
  activePath: string;
  plusOpen?: boolean;
  /** Folded: Início keeps its place, the quick entry takes the rest of the row. */
  collapsed?: boolean;
  onNavigate?: (path: string) => void;
  onPlus?: () => void;
  onQuickEntry?: () => void;
}) {
  const shown = collapsed ? navItems.slice(0, 1) : navItems;
  return (
    <>
      {/* isolate keeps the sliding pill from compositing above the icons: WebKit
          promotes a layoutId element to its own layer and paints it over
          non-composited siblings whatever the z-index says. */}
      <motion.nav
        layout
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className={cn(
          "willo-float rounded-full [isolation:isolate]",
          collapsed ? "flex-1" : "flex-1 max-w-[250px]",
        )}
      >
        <div className="flex items-center justify-around h-[58px] px-1.5">
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
                  "relative mx-0.5 flex h-11 items-center justify-center rounded-full",
                  // Folded, Início holds its own width so the invitation gets the room.
                  collapsed ? "w-11 shrink-0" : "flex-1",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="willo-nav-active"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    className="absolute inset-0 rounded-full bg-white/[0.18]"
                  />
                )}
                <Icon
                  className={cn(
                    "relative w-5 h-5 transform-gpu transition-colors",
                    isActive ? "text-white" : item.soon ? "t-faint" : "text-white/62",
                  )}
                  strokeWidth={isActive ? 2.25 : 2}
                />
                {item.soon && (
                  <span className="absolute -top-0.5 right-1.5 h-1.5 w-1.5 rounded-full bg-willo-green" />
                )}
              </button>
            );
          })}

          {/* Folded, the invitation rides inside the nav, between Início and Willo. */}
          {collapsed && (
            <motion.button
              layout
              onClick={onQuickEntry}
              className="ml-1 flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.07] pl-3 pr-3.5 text-left"
            >
              <RegistroRapidoIcon className="h-[17px] w-[17px] shrink-0 text-willo-green-ink" />
              <span className="min-w-0 flex-1 truncate text-[13.5px] t-soft">Registro rápido</span>
              <Mic className="h-[15px] w-[15px] shrink-0 t-faint" strokeWidth={2.1} />
            </motion.button>
          )}
        </div>
      </motion.nav>

      <button
        onClick={onPlus}
        aria-label="Willo"
        className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
      >
        <BotMark size={50} />
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
