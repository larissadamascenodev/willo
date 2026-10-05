import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Contas", path: "/gestao" },
  { label: "Cartões", path: "/cartoes" },
  { label: "Financeiro", path: "/bot-finance/balanco" },
  { label: "Raio-X", path: "/bot-finance" },
] as const;

/**
 * The four places the home screen leads to. Accounts and cards are separate: a
 * statement is not a balance, and mixing them made both harder to read. Installments
 * left the row because they already live inside Cartões, and five pills could not be
 * seen at once; four share the width, so nothing is hidden off the edge.
 */
export default function HomeSectionTabs({ activePath }: { activePath?: string }) {
  const navigate = useNavigate();

  return (
    <div className="flex gap-1.5">
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
              "h-10 min-w-0 flex-1 truncate rounded-full border px-1.5 text-[13px] font-semibold tracking-tight transition-colors duration-200",
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
