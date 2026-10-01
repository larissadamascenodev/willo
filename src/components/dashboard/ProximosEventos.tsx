import { memo, useMemo, useState } from "react";
import { Check, Clock, AlertTriangle, ChevronDown, ChevronUp, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FinanceEvent } from "@/types/finance";

import { getCurrency } from "@/lib/currency";
interface Props {
  events: FinanceEvent[];
  selectedMonth: number;
  selectedYear: number;
  onVerTodos?: () => void;
  onEventClick?: (event: FinanceEvent) => void;
}

const STATUS_CONFIG = {
  pago: { label: "Pago", accent: "80 84% 69%", Icon: Check },
  pendente: { label: "Pendente", accent: "45 93% 64%", Icon: Clock },
  atrasado: { label: "Atrasado", accent: "0 91% 71%", Icon: AlertTriangle },
  recebido: { label: "Recebido", accent: "80 84% 69%", Icon: Check },
};

const getStatusLabel = (status: string, type?: string) => {
  if (type === "receita") {
    if (status === "pago" || status === "recebido") return "Recebido";
    if (status === "pendente") return "A Receber";
  }
  if (type === "despesa") {
    if (status === "pago") return "Pago";
    if (status === "pendente") return "Pendente";
  }
  if (status === "atrasado") return "A Pagar";
  return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label ?? status;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const fmtDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

const parseDateSafe = (dateStr: string): Date => {
  if (dateStr.includes("T")) return new Date(dateStr);
  return new Date(dateStr + "T12:00:00");
};

const MIN_VISIBLE = 3;

const ProximosEventos = memo(({ events, selectedMonth, selectedYear, onVerTodos, onEventClick }: Props) => {
  const [expanded, setExpanded] = useState(false);

  // Sort: pendente/atrasado first, then pago/recebido; within each group sort by date
  const sortedEvents = useMemo(() => {
    const mapped = [...events].map((ev) => ({ ...ev, _date: parseDateSafe(ev.rawDate || ev.date) }));
    const statusOrder = (s: string) => (s === "pago" || s === "recebido" ? 1 : 0);
    return mapped.sort((a, b) => {
      const so = statusOrder(a.status) - statusOrder(b.status);
      if (so !== 0) return so;
      return a._date.getTime() - b._date.getTime();
    });
  }, [events]);

  // Always show at least MIN_VISIBLE, expand shows all
  const visibleCount = Math.max(MIN_VISIBLE, 0);
  const displayEvents = expanded ? sortedEvents : sortedEvents.slice(0, visibleCount);
  const hasMore = sortedEvents.length > visibleCount;

  const renderEvent = (ev: typeof sortedEvents[0], idx: number) => {
    const isPaid = ev.status === "pago" || ev.status === "recebido";
    const cfg = STATUS_CONFIG[ev.status] ?? STATUS_CONFIG.pendente;
    const a = cfg.accent;
    const StatusIcon = cfg.Icon;
    const isClickable = ev.isTransaction && ev.status === "pendente";

    return (
      <motion.div
        key={ev.id}
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ delay: idx * 0.03, type: "spring", stiffness: 500, damping: 35 }}
        className={`flex items-center gap-3 py-3 ${isClickable ? "cursor-pointer active:opacity-70" : ""}`}
        onClick={() => {
          if (isClickable && onEventClick) onEventClick(ev);
        }}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `hsl(${a} / 0.12)` }}>
          <StatusIcon className="h-4 w-4" style={{ color: `hsl(${a})` }} />
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-medium ${isPaid ? "text-white/45" : "text-white"}`}>{ev.name}</p>
          <p className="text-[12px]" style={{ color: `hsl(${a} / 0.85)` }}>
            {getStatusLabel(ev.status, ev.type)}
          </p>
        </div>

        {/* Amount + date */}
        <div className="shrink-0 text-right">
          <p className={`text-[15px] font-semibold tabular-nums ${isPaid ? "text-white/45" : "text-white"}`}>{fmt(ev.amount)}</p>
          <p className="text-[12px] text-white/40">{fmtDate(ev._date)}</p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="rounded-[22px] border border-white/[0.12] willo-glass overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4">
        <CalendarDays className="h-4 w-4 text-white/60" />
        <h2 className="text-[16px] font-semibold text-white">Próximos eventos</h2>
      </div>

      {/* Events list */}
      <div className="px-4 pt-1 divide-y divide-white/[0.06]">
        <AnimatePresence mode="popLayout" initial={false}>
          {displayEvents.length > 0 ? (
            displayEvents.map((ev, idx) => renderEvent(ev, idx))
          ) : (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-5 text-center text-[13px] text-white/40">
              Nenhum evento este mês
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Ver todos / Recolher */}
      {hasMore ? (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-white/[0.06] py-3 text-[13px] font-medium text-white/60 active:opacity-60"
        >
          {expanded ? (
            <>Recolher <ChevronUp className="h-4 w-4" /></>
          ) : (
            <>Ver todos ({sortedEvents.length}) <ChevronDown className="h-4 w-4" /></>
          )}
        </button>
      ) : (
        <div className="h-1" />
      )}
    </div>
  );
});

ProximosEventos.displayName = "ProximosEventos";
export default ProximosEventos;
