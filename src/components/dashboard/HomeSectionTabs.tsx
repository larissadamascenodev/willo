import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Contas", path: "/gestao" },
  { label: "Cartões", path: "/cartoes" },
  { label: "Parcelamentos", path: "/parcelamentos" },
  { label: "Projeções", path: "/bot-finance/projecoes" },
  { label: "Raio-X", path: "/bot-finance" },
] as const;

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
              "h-10 shrink-0 rounded-full border px-[18px] text-[14.5px] font-semibold tracking-tight transition-colors duration-200",
              active
                ? "border-white/70 bg-white text-[#0B0B0B]"
                : "border-white/[0.20] willo-glass-control text-white/90 active:opacity-70",
            )}
          >
            {tab.label}
          </motion.button>
        );
      })}
    </div>
  );
}
