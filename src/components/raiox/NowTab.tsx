import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowDownRight, ArrowUpRight, ChevronDown, HelpCircle, Scale } from "lucide-react";
import type { RaioXData } from "@/hooks/useRaioX";
import type { Reason } from "@/services/raioXForecast";
import { cn } from "@/lib/utils";
import { Card, Section, Verdict, brl, brlCents } from "./primitives";

/** Small "por quê?" disclosure used across the forecast cards. */
export function Why({ reasons, label = "Por quê?" }: { reasons: Reason[]; label?: string }) {
  const [open, setOpen] = useState(false);
  if (reasons.length === 0) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] font-medium text-white/50 active:opacity-60"
      >
        <HelpCircle className="h-3.5 w-3.5" /> {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-2 space-y-1.5 rounded-[16px] bg-black/25 p-3">
              {reasons.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="min-w-0 truncate text-white/60">{r.label}</span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", r.amount < 0 ? "text-red-400" : "text-willo-green")}>
                    {r.amount < 0 ? "−" : "+"}{brl(Math.abs(r.amount))}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Current scenario: where you are + how the month ends ───────────

export function CurrentScenario({ data }: { data: RaioXData }) {
  const { forecast, current, today, commitment } = data;
  const monthName = today.toLocaleDateString("pt-BR", { month: "long" });
  const toPay = Math.max(current.despesas - current.despesasPagas, 0);
  const negative = forecast.endBalance < 0;
  const hex = negative || forecast.negativeDay !== null ? "#F87171" : forecast.tightWindow ? "#FCD34D" : "#C8F36D";
  const paidShare = current.despesas > 0 ? current.despesasPagas / current.despesas : 0;

  // How much is still free to spend without closing the month in the red
  const spendable = Math.max(forecast.safeToSpend, 0);

  const insight = forecast.negativeDay !== null
    ? `No ritmo atual seu saldo fica negativo no dia ${forecast.negativeDay}. Segurar ${brl(Math.max(forecast.estimatedRest * 0.25, 50))} nos gastos do dia a dia já resolve.`
    : forecast.tightWindow
      ? `O caixa aperta entre os dias ${forecast.tightWindow.from} e ${forecast.tightWindow.to}: deixe as compras maiores para depois disso.`
      : forecast.endBalance >= current.receitas * 0.2
        ? `Do jeito que está, sobra ${brl(forecast.endBalance)} no fim do mês. Já dá pra reservar uma parte.`
        : "O mês fecha no azul, mas sem muita folga. Vale segurar os gastos variáveis.";

  return (
    <Section icon={Activity} title="Como você está" hint={`Fechamento previsto de ${monthName}`}>
      <div
        className="relative overflow-hidden rounded-[28px] border border-white/[0.12] p-5"
        style={{ background: `radial-gradient(120% 90% at 100% 0%, ${hex}1C 0%, rgba(20,20,20,0.96) 55%, #0E0E0E 100%)` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-white/50">Saldo na conta</p>
            <p className="truncate text-[30px] font-extrabold leading-tight tracking-tight text-white tabular-nums">{brl(current.saldoAtual)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[12px] text-white/50">Deve sobrar</p>
            <p className={cn("truncate text-[22px] font-extrabold leading-tight tracking-tight tabular-nums", negative ? "text-red-400" : "text-willo-green")}>
              {brl(forecast.endBalance)}
            </p>
          </div>
        </div>

        {/* Expenses of the month: paid vs still to pay */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[12px] text-white/45">
            <span>Despesas do mês <b className="font-semibold text-white tabular-nums">{brl(current.despesas)}</b></span>
            <span className="tabular-nums">{Math.round(paidShare * 100)}% pago</span>
          </div>
          <div className="mt-2 flex h-3 gap-[3px] overflow-hidden rounded-full bg-white/[0.06]">
            <motion.span
              className="h-full rounded-l-full bg-white/70"
              initial={{ width: 0 }}
              whileInView={{ width: `${paidShare * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            />
            <motion.span
              className="h-full bg-amber-300/70"
              initial={{ width: 0 }}
              whileInView={{ width: `${(1 - paidShare) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { label: "Já paguei", value: current.despesasPagas, dot: "rgba(255,255,255,0.7)" },
              { label: "Falta pagar", value: toPay, dot: "rgba(252,211,77,0.7)" },
              { label: "Entra no mês", value: current.receitas, dot: "#C8F36D" },
            ].map((s) => (
              <div key={s.label}>
                <p className="flex items-center gap-1 truncate text-[10.5px] text-white/45">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.dot }} /> {s.label}
                </p>
                <p className="truncate text-[13.5px] font-semibold text-white tabular-nums">{brl(s.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Room left before closing the month in the red */}
        <div className="mt-4 rounded-[18px] bg-black/30 p-3.5">
          <p className="text-[12px] text-white/55">Você ainda pode gastar</p>
          <p className="truncate text-[24px] font-extrabold leading-tight text-white tabular-nums">{brl(spendable)}</p>
          <p className="text-[12px] leading-snug text-white/45">
            sem fechar o mês no vermelho · cerca de {brl(forecast.dailyAllowance)} por dia
          </p>
        </div>

        {/* Where the income is already committed */}
        {commitment.income > 0 && (
          <div className="mt-4 border-t border-white/[0.12] pt-3.5">
            <div className="flex items-center justify-between text-[12px] text-white/45">
              <span>Renda comprometida</span>
              <span className={cn("font-bold tabular-nums", commitment.committedPct >= 0.6 ? "text-red-400" : commitment.committedPct >= 0.4 ? "text-amber-300" : "text-white")}>
                {Math.round(commitment.committedPct * 100)}%
              </span>
            </div>
            <div className="mt-2 flex h-2.5 gap-[3px] overflow-hidden rounded-full">
              {[
                { label: "Contas fixas", value: commitment.fixed, hex: "#60A5FA" },
                { label: "Parcelas", value: commitment.installments, hex: "#C084FC" },
                { label: "Cartão", value: commitment.card, hex: "#F472B6" },
                { label: "Dia a dia", value: commitment.variable, hex: "#FCD34D" },
                { label: "Livre", value: Math.max(commitment.free, 0), hex: "#C8F36D" },
              ].filter((p) => p.value > 0).map((p) => (
                <span
                  key={p.label}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ background: p.hex, width: `${(p.value / Math.max(commitment.income, 1)) * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                { label: "Contas fixas", value: commitment.fixed, hex: "#60A5FA" },
                { label: "Parcelas", value: commitment.installments, hex: "#C084FC" },
                { label: "Cartão", value: commitment.card, hex: "#F472B6" },
                { label: "Dia a dia", value: commitment.variable, hex: "#FCD34D" },
              ].filter((p) => p.value > 0).map((p) => (
                <div key={p.label} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[11.5px] text-white/50">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.hex }} /> {p.label}
                  </span>
                  <span className="shrink-0 text-[12.5px] font-semibold text-white tabular-nums">{brl(p.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Range */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Conservador", value: forecast.conservative },
            { label: "Provável", value: forecast.endBalance },
            { label: "Otimista", value: forecast.optimistic },
          ].map((s, i) => (
            <div key={s.label} className={cn("rounded-[14px] px-2.5 py-2", i === 1 ? "bg-white/[0.08]" : "bg-black/25")}>
              <p className="truncate text-[10px] text-white/45">{s.label}</p>
              <p className={cn("truncate text-[13px] font-bold tabular-nums", s.value < 0 ? "text-red-400" : "text-white")}>{brl(s.value)}</p>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <Verdict hex={hex}>{insight}</Verdict>
        </div>
        <Why reasons={forecast.reasons} label="Como cheguei nessa previsão?" />
      </div>
    </Section>
  );
}

// ─── This month vs. last month ──────────────────────────────────────

export function MonthComparison({ data }: { data: RaioXData }) {
  const c = data.comparison;
  const last = new Date(data.today.getFullYear(), data.today.getMonth() - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
  const rows = [
    { label: "Entrou", now: c.income.now, before: c.income.before, goodWhenUp: true },
    { label: "Saiu", now: c.expense.now, before: c.expense.before, goodWhenUp: false },
    { label: "Sobrou", now: c.saved.now, before: c.saved.before, goodWhenUp: true },
  ];

  return (
    <Section icon={Scale} title={`Este mês x ${last}`} hint="Comparando até o mesmo dia do mês">
      <Card className="p-5">
        <div className="space-y-3">
          {rows.map((r) => {
            const diff = r.now - r.before;
            const good = r.goodWhenUp ? diff >= 0 : diff <= 0;
            return (
              <div key={r.label} className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-[13.5px] text-white/60">{r.label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {c.hasBefore && (
                    <>
                      <span className="text-[12px] text-white/35 tabular-nums">{brl(r.before)}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 rotate-45 text-white/25" />
                    </>
                  )}
                  <span className="text-[15px] font-bold text-white tabular-nums">{brl(r.now)}</span>
                  {c.hasBefore && Math.abs(diff) >= 1 && (
                    <span className={cn("flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums", good ? "bg-willo-green/15 text-willo-green" : "bg-red-400/15 text-red-400")}>
                      {diff > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {brl(Math.abs(diff))}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {c.categories.length > 0 && (
          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <p className="mb-2 text-[12px] text-white/45">Maiores mudanças por categoria</p>
            <div className="space-y-1.5">
              {c.categories.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-white/75">{cat.name}</span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", cat.diff > 0 ? "text-red-400" : "text-willo-green")}>
                    {cat.diff > 0 ? "+" : "−"}{brl(Math.abs(cat.diff))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3">
          <Verdict hex={c.expense.now > c.expense.before ? "#FCD34D" : "#C8F36D"}>{c.message}</Verdict>
        </div>
      </Card>
    </Section>
  );
}
