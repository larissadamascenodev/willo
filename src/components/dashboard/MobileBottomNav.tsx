import { memo, useCallback, useEffect, useState } from "react";
import { Home, ArrowLeftRight, Plus, TrendingUp, TrendingDown, Camera, Sparkles } from "lucide-react";
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
  { icon: Sparkles, label: "Assistente", soon: true },
  { icon: Camera, label: "Escanear", scan: true },
];

const MobileBottomNav = memo(() => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const close = useCallback(() => setIsOpen(false), []);
  const handleOption = (type: AddActionType) => {
    setIsOpen(false);
    if (type === "scanner") {
      window.dispatchEvent(new CustomEvent("open-scanner"));
    } else {
      window.dispatchEvent(new CustomEvent("open-nova-transacao-direct", { detail: { type } }));
    }
  };

  return (
    <>
      {/* Add menu: actions fly out of the + into an arch */}
      <AddActionsMenu open={isOpen} onClose={close} onSelect={handleOption} />

      {/* Bottom Nav Bar — pill (Início/Transações/Assistente/Escanear) + separate add button */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-3 px-5 md:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
      >
        <BottomNavBar
          activePath={location.pathname}
          plusOpen={isOpen}
          onNavigate={(path) => navigate(path)}
          onPlus={() => setIsOpen((v) => !v)}
        />
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
export function BottomNavBar({ activePath, plusOpen = false, onNavigate, onPlus }: {
  activePath: string;
  plusOpen?: boolean;
  onNavigate?: (path: string) => void;
  onPlus?: () => void;
}) {
  return (
    <>
      <nav className="willo-glass flex-1 max-w-[280px] rounded-full">
        <div className="flex items-center justify-around h-[58px] px-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = !!item.path && activePath === item.path;
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (item.soon) return;
                  if (item.scan) window.dispatchEvent(new CustomEvent("open-scanner"));
                  else if (item.path) onNavigate?.(item.path);
                }}
                aria-label={item.soon ? `${item.label} — em breve` : item.label}
                className={cn(
                  "relative flex items-center justify-center h-11 flex-1 mx-0.5 rounded-[15px] transition-colors",
                  isActive ? "bg-white/[0.17]" : item.soon ? "" : "hover:bg-white/[0.07]",
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isActive ? "text-white" : item.soon ? "text-white/38" : "text-white/62",
                  )}
                  strokeWidth={isActive ? 2.25 : 2}
                />
                {item.soon && (
                  <span className="absolute -top-0.5 right-1.5 h-1.5 w-1.5 rounded-full bg-willo-green" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <button
        onClick={onPlus}
        aria-label="Adicionar transação"
        className={cn(
          "relative w-[58px] h-[58px] rounded-full flex items-center justify-center shrink-0 transition-colors",
          plusOpen ? "bg-white" : "willo-glass"
        )}
      >
        <motion.div animate={{ rotate: plusOpen ? 135 : 0 }} transition={{ type: "spring", stiffness: 380, damping: 24 }}>
          <Plus className={cn("w-6 h-6", plusOpen ? "text-[#0B0B0B]" : "text-white")} strokeWidth={2.25} />
        </motion.div>
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
