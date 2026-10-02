import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, Equal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Surface } from "@/components/shared/MobilePage";
import type { DashboardData } from "@/types/finance";
import { GREEN, MONTH_NAMES, RED, useMoney } from "./shared";

interface Props {
  data: DashboardData;
  month: number;
  year: number;
}

/** One side of the month: what already happened and what is still due, on a single bar. */
function FlowRow({
  label, doneLabel, pendingLabel, done, pending, base, hex, Icon, delay,
}: {
  label: string;
  doneLabel: string;
  pendingLabel: string;
  done: number;
  pending: number;
  base: number;
  hex: string;
  Icon: typeof ArrowDownLeft;
  delay: number;
}) {
  const { fmt } = useMoney();
  const total = done + pending;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] text-white/74">
          <Icon className="h-4 w-4" style={{ color: hex }} strokeWidth={2.5} /> {label}
        </span>
        <span className="text-[16px] font-bold text-white tabular-nums">{fmt(total)}</span>
      </div>

      {/* Solid = already happened, faded = still to come, both measured against the larger side */}
      <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full"
          style={{ background: hex }}
          initial={{ width: 0 }}
          animate={{ width: `${(done / base) * 100}%` }}
          transition={{ delay, duration: 0.7, ease: "easeOut" }}
        />
        <motion.div
          className="h-full"
          style={{ background: `${hex}55` }}
          initial={{ width: 0 }}
          animate={{ width: `${(pending / base) * 100}%` }}
          transition={{ delay: delay + 0.1, duration: 0.7, ease: "easeOut" }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[12.5px] text-white/66">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: hex }} />
          {doneLabel} <span className="font-semibold text-white/90 tabular-nums">{fmt(done)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: `${hex}55` }} />
          {pendingLabel} <span className="font-semibold text-white/90 tabular-nums">{fmt(pending)}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * The month we are in, as a balance: what came in and what is still to come in, what went
 * out and what is still to go out, and what that leaves over.
 */
export default function MonthBalanceCard({ data, month, year }: Props) {
  const { fmt, compact } = useMoney();
  const now = new Date();

  const income = data.receitas;
  const expense = data.despesas;
  const sobra = income - expense;
  const base = Math.max(income, expense, 1);
  const share = income > 0 ? sobra / income : 0;
  const pct = Math.round(share * 100);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getMonth() === month && now.getFullYear() === year ? now.getDate() : daysInMonth;
  const daysLeft = daysInMonth - today;

  const verdict = sobra < 0
    ? `Se nada mudar, o mês fecha ${fmt(-sobra)} no vermelho.`
    : sobra === 0
      ? "Entradas e saídas previstas empatam no mês."
      : share >= 0.2
        ? `Devem sobrar ${pct}% da renda. Mês redondo 👏`
        : `Devem sobrar ${pct >= 1 ? `${pct}%` : "uma fatia pequena"} da renda. Dá pra abrir mais folga segurando os gastos variáveis.`;

  return (
    <div>
      <p className="mt-6 text-[13px] text-white/62">Balanço de {MONTH_NAMES[month]}</p>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-2 overflow-hidden rounded-[28px] border border-white/[0.12] p-5"
        style={{
          background: `radial-gradient(120% 90% at 100% 0%, ${sobra < 0 ? "#F8717120" : "#C8F36D1C"} 0%, rgba(20,20,20,0.96) 55%, #0E0E0E 100%)`,
        }}
      >
        <p className="text-[13px] text-white/70">{sobra < 0 ? "Falta prevista" : "Sobra prevista"}</p>
        <p className={cn("truncate text-[42px] font-extrabold leading-tight tracking-tight tabular-nums", sobra < 0 ? "text-red-400" : "text-white")}>
          {fmt(Math.abs(sobra))}
        </p>
        <p className="text-[12.5px] text-white/56">no fim de {MONTH_NAMES[month].toLowerCase()}, com o que já está lançado</p>

        <div className="mt-5 space-y-5">
          <FlowRow
            label="Entradas"
            doneLabel="Entrou"
            pendingLabel="A entrar"
            done={data.receitasRecebidas}
            pending={data.receitasPendentes}
            base={base}
            hex={GREEN}
            Icon={ArrowDownLeft}
            delay={0.15}
          />
          <FlowRow
            label="Saídas"
            doneLabel="Saiu"
            pendingLabel="A sair"
            done={data.despesasPagas}
            pending={data.despesasPendentes}
            base={base}
            hex={RED}
            Icon={ArrowUpRight}
            delay={0.27}
          />

          <div className="flex items-center justify-between border-t border-white/[0.12] pt-3">
            <span className="flex items-center gap-1.5 text-[13px] text-white/74">
              <Equal className="h-4 w-4 text-white/66" strokeWidth={2.5} /> Balanço do mês
            </span>
            <span className={cn("text-[18px] font-extrabold tabular-nums", sobra < 0 ? "text-red-400" : "text-willo-green")}>
              {sobra > 0 ? "+" : ""}{fmt(sobra)}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-[16px] bg-black/25 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[11.5px] text-white/56">Saldo hoje</p>
            <p className="truncate text-[15px] font-bold text-white tabular-nums">{compact(data.saldoAtual)}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-white/40" />
          <div className="min-w-0 text-right">
            <p className="text-[11.5px] text-white/56">Previsto no fim do mês</p>
            <p className={cn("truncate text-[15px] font-bold tabular-nums", data.saldoPrevisto < 0 ? "text-red-400" : "text-white")}>
              {compact(data.saldoPrevisto)}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[13px] leading-snug text-white/85">{verdict}</p>
      </motion.section>

      {daysLeft >= 0 && (
        <Surface className="mt-3 p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] text-white/74">
              <CalendarDays className="h-4 w-4 text-white/62" /> Mês em andamento
            </span>
            <span className="text-[12px] text-white/62 tabular-nums">
              {daysLeft} {daysLeft === 1 ? "dia restante" : "dias restantes"}
            </span>
          </div>
          <div className="mt-2.5 flex gap-[2px]">
            {Array.from({ length: daysInMonth }, (_, d) => (
              <span
                key={d}
                className={cn(
                  "h-4 flex-1 rounded-[3px]",
                  d + 1 < today ? "bg-white/55" : d + 1 === today ? "bg-white" : "bg-white/[0.08]",
                )}
              />
            ))}
          </div>
        </Surface>
      )}
    </div>
  );
}
