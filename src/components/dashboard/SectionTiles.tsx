import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Scan, Wallet } from "lucide-react";
import { chipFill, chipInk } from "@/lib/chipColor";
import { TileRow } from "./StatTile";

/**
 * The two screens the home cannot show a piece of.
 *
 * Everything else the dashboard leads to is already on the page as a card you can
 * read — the balance, the cards, the goals — so the pill above it was a second door
 * onto a room you were already looking into. These two are not summaries of anything:
 * one is the month taken apart, the other is where the money has been going. They get
 * a tile each, side by side, in the same family as the rest of the feed.
 */

const SECTIONS = [
  {
    label: "Financeiro",
    caption: "Balanço, fluxo e projeções",
    icon: Wallet,
    accent: "#7DD3FC",
    path: "/bot-finance/balanco",
  },
  {
    label: "Raio-X",
    caption: "Para onde o dinheiro vai",
    icon: Scan,
    accent: "#C8F36D",
    path: "/bot-finance",
  },
] as const;

export default function SectionTiles() {
  const navigate = useNavigate();

  return (
    <TileRow>
      {SECTIONS.map((s, i) => (
        <motion.button
          key={s.path}
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 + i * 0.05 }}
          onClick={() => navigate(s.path)}
          className="relative flex w-full flex-col overflow-hidden rounded-[22px] border border-white/[0.08] willo-glass p-4 text-left transition-transform active:scale-[0.98]"
        >
          <div className="flex items-start justify-between gap-2">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-1"
              style={{
                background: chipFill(s.accent),
                ["--tw-ring-color" as string]: s.accent + "3d",
              }}
            >
              <s.icon className="h-[21px] w-[21px]" style={{ color: chipInk(s.accent) }} strokeWidth={2.1} />
            </span>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/25" />
          </div>

          <p className="mt-4 text-[17px] font-bold tracking-[-0.02em] text-white">{s.label}</p>
          <p className="mt-1 text-[12px] leading-snug t-softer">{s.caption}</p>
        </motion.button>
      ))}
    </TileRow>
  );
}
