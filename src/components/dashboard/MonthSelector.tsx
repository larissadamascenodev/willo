import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

const monthShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Props {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
}

function addMonths(month: number, year: number, offset: number) {
  const d = new Date(year, month + offset, 1);
  return { month: d.getMonth(), year: d.getFullYear() };
}

const MonthSelector = memo(({ selectedMonth, selectedYear, onMonthChange }: Props) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const isMobile = useIsMobile();

  const months = useMemo(() => {
    const offsets = isMobile ? [-1, 0, 1] : [-2, -1, 0, 1, 2];
    return offsets.map((offset) => addMonths(selectedMonth, selectedYear, offset));
  }, [selectedMonth, selectedYear, isMobile]);

  const activeIndex = isMobile ? 1 : 2;

  return (
    <div className="flex items-center bg-card/60 backdrop-blur-xl border border-border/15 rounded-2xl px-1.5 py-0.5 shadow-lg shadow-black/10">
      <div className="flex items-center gap-0.5">
        {months.map((item, index) => {
          const isActive = index === activeIndex;
          const isCurrent = item.month === currentMonth && item.year === currentYear;
          const isEdge = !isMobile && (index === 0 || index === 4);

          return (
            <motion.button
              key={`${item.year}-${item.month}`}
              layout
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: isEdge ? 0.5 : 1, scale: isEdge ? 0.9 : 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: isActive ? 1 : 1.05 }}
              onClick={() => onMonthChange(item.month, item.year)}
              className={`relative px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors duration-200 ${
                isActive
                  ? "text-primary"
                  : isCurrent
                  ? "text-primary/70"
                  : "text-muted-foreground/50 hover:text-foreground/80"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="month-active-bg"
                  className="absolute inset-0 z-0 rounded-xl bg-primary/15 border border-primary/20 shadow-[0_0_10px_-3px_hsl(var(--primary)/0.25)]"
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  style={{ zIndex: 0 }}
                />
              )}
              <span className="relative z-10">
                {monthShort[item.month]}
                {item.year !== currentYear && (
                  <span className="text-[8px] ml-0.5 opacity-60">{String(item.year).slice(2)}</span>
                )}
              </span>
              {isCurrent && !isActive && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary shadow-[0_0_4px_hsl(var(--primary)/0.5)]"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
});

MonthSelector.displayName = "MonthSelector";
export default MonthSelector;
