import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Contas", path: "/gestao" },
  { label: "Cartões", path: "/cartoes" },
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
              "h-10 shrink-0 rounded-full border px-5 text-[14.5px] font-semibold transition-colors",
              active
                ? "border-transparent bg-white text-[#0B0B0B] shadow-[0_6px_18px_-8px_rgba(0,0,0,0.9)]"
                : "border-white/25 bg-white/[0.10] text-white backdrop-blur-xl active:opacity-70",
            )}
          >
            {tab.label}
          </motion.button>
        );
      })}
    </div>
  );
}
