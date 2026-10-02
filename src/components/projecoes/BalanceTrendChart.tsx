import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Surface } from "@/components/shared/MobilePage";
import { RISK, riskOf, useMoney } from "./shared";

export interface TrendRow {
  month: number;
  year: number;
  balance: number;
  risk: string;
  estimated: boolean;
  short: string;
  yearTag: string;
}

/** The balance at the end of each month, one bar per month; tap a bar to open that month below. */
export default function BalanceTrendChart({
  rows, selectedIdx, onSelect, maxAbs,
}: {
  rows: TrendRow[];
  selectedIdx: number | null;
  onSelect: (i: number) => void;
  maxAbs: number;
}) {
  const { compact } = useMoney();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ startX: 0, scrollLeft: 0 });

  useEffect(() => {
    if (selectedIdx === null) return;
    const active = scrollRef.current?.querySelector("[data-active='true']");
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedIdx]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    setIsDragging(true);
    dragState.current = { startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const el = scrollRef.current;
    el.scrollLeft = dragState.current.scrollLeft - (e.pageX - el.offsetLeft - dragState.current.startX);
  }, [isDragging]);

  const onMouseUp = useCallback(() => setIsDragging(false), []);

  return (
    <Surface className="p-5">
      <div
        ref={scrollRef}
        className="-mx-1 flex select-none items-end gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide"
        style={{ minHeight: 130, cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {rows.map((r, i) => {
          const risk = riskOf(r.risk);
          const on = i === selectedIdx;
          const barColor = r.balance < 0 ? "#F87171" : risk.hex;
          const barHeight = Math.max((Math.abs(r.balance) / maxAbs) * 84, 18);

          return (
            <button
              key={`${r.year}-${r.month}`}
              data-active={on}
              onClick={() => { if (!isDragging) onSelect(i); }}
              className="flex min-w-[52px] flex-1 shrink-0 flex-col items-center gap-1.5"
            >
              <span className={cn("whitespace-nowrap text-[10.5px] font-bold tabular-nums transition-opacity", on ? "text-white" : "text-white/56")}>
                {compact(r.balance)}
              </span>

              <div className="relative w-full">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: barHeight }}
                  transition={{ delay: i * 0.02, duration: 0.5, ease: "easeOut" }}
                  className={cn("w-full rounded-[9px] transition-all", on ? "ring-2 ring-white" : "ring-1 ring-white/[0.06]")}
                  style={{
                    background: on ? barColor : `${barColor}33`,
                    // A month with no launches yet is a guess, so it is drawn as one
                    backgroundImage: r.estimated
                      ? "repeating-linear-gradient(135deg, transparent 0 4px, rgba(255,255,255,0.14) 4px 6px)"
                      : undefined,
                  }}
                />
              </div>

              <span className={cn("whitespace-nowrap text-[11px] font-semibold transition-colors", on ? "text-white" : "text-white/56")}>
                {r.short}{r.yearTag && <span className="text-white/38">/{r.yearTag}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-3.5 text-[11px] text-white/62">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: RISK.positivo.hex }} />
          <span>Tranquilo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: RISK.atencao.hex }} />
          <span>Atenção</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[#F87171]" />
          <span>Negativo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[3px] bg-white/25"
            style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 2px, rgba(255,255,255,0.35) 2px 3px)" }}
          />
          <span>Estimado</span>
        </div>
      </div>
    </Surface>
  );
}
