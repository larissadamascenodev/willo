import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Contas", path: "/gestao" },
  { label: "Cartões", path: "/cartoes" },
  { label: "Raio-X", path: "/bot-finance" },
] as const;

/** Clear glass: the light behind the pill has to come through it, so the fill is
 *  barely there and the hairline border carries the edge. */
const GLASS_PILL = {
  background: "linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%)",
  backdropFilter: "blur(18px) saturate(185%)",
  WebkitBackdropFilter: "blur(18px) saturate(185%)",
  border: "1px solid rgba(255,255,255,0.28)",
  boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.35), 0 6px 18px -10px rgba(0,0,0,0.8)",
} as const;

/** The highlight running off the top-left corner, like a lit bevel. */
const PILL_SHEEN = {
  background: "radial-gradient(120% 140% at 14% -30%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.06) 42%, transparent 70%)",
} as const;

const ACTIVE_PILL = {
  border: "1px solid rgba(255,255,255,0.9)",
  boxShadow: "0 6px 20px -8px rgba(255,255,255,0.45)",
} as const;

/**
 * The three places the home screen leads to. Accounts and cards are separate here —
 * a statement is not a balance, and mixing them made both harder to read.
 */
export default function HomeSectionTabs({ activePath }: { activePath?: string }) {
  const navigate = useNavigate();

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
      {TABS.map((tab, i) => {
        const active = activePath === tab.path;
        return (
          <motion.button
            key={tab.path}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            onClick={() => navigate(tab.path)}
            className={cn(
              "relative h-10 shrink-0 overflow-hidden rounded-full px-[18px] text-[14.5px] font-semibold transition-colors",
              active
                ? "bg-[#F4F2EE] text-[#0B0B0B]"
                : "text-white active:opacity-80",
            )}
            style={active ? ACTIVE_PILL : GLASS_PILL}
          >
            {/* The specular edge that makes the pill read as glass rather than a flat tint */}
            {!active && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={PILL_SHEEN} />}
            <span className="relative">{tab.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
