import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronRight, CreditCard, PiggyBank, ShieldCheck, Sparkles, X } from "lucide-react";
import type { RaioXData } from "@/hooks/useRaioX";
import type { ForecastDay } from "@/services/raioXForecast";
import { cn } from "@/lib/utils";
import { Card, Section, Verdict, brl, brlCents } from "./primitives";

const PRESSURE_HEX = { tranquilo: "rgba(255,255,255,0.14)", atencao: "#FCD34D", pressao: "#F87171" } as const;

// ─── What's coming: the month's pressure calendar ───────────────────

export function PressureCalendar({ data }: { data: RaioXData }) {
  const { forecast, today } = data;
  const [selected, setSelected] = useState<ForecastDay | null>(null);
  const firstWeekday = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const heavy = forecast.days.filter((d) => !d.isPast && d.pressure !== "tranquilo").slice(0, 3);

  const insight = forecast.negativeDay !== null
    ? `Dia ${forecast.negativeDay} é o ponto crítico: é quando o saldo pode ficar negativo.`
    : heavy.length > 0
      ? `Os dias mais pesados daqui pra frente são ${heavy.map((d) => d.day).join(", ")}. Prepare o caixa para eles.`
      : "Nenhum dia pesado à vista pelo resto do mês. Caminho livre 🙌";

  return (
    <Section icon={CalendarDays} title="O que vem pela frente" hint="Toque num dia para ver o que acontece nele">
      <Card className="p-4">
        <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[10px] text-white/35">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstWeekday }, (_, i) => <span key={`pad-${i}`} />)}
          {forecast.days.map((d) => (
            <button
              key={d.day}
              type="button"
              onClick={() => setSelected(d)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-[12px] text-[12px] font-medium transition-colors",
                d.isPast ? "bg-white/[0.03] text-white/25" : "text-white",
                d.isToday && "ring-2 ring-white",
              )}
              style={!d.isPast ? { background: d.pressure === "tranquilo" ? "rgba(255,255,255,0.05)" : `${PRESSURE_HEX[d.pressure]}2E` } : undefined}
            >
              {d.day}
              {!d.isPast && d.pressure !== "tranquilo" && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full" style={{ background: PRESSURE_HEX[d.pressure] }} />
              )}
              {d.inflow > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-willo-green" />}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-white/45">
          {[
            { label: "Tranquilo", hex: "rgba(255,255,255,0.2)" },
            { label: "Atenção", hex: PRESSURE_HEX.atencao },
            { label: "Pressão", hex: PRESSURE_HEX.pressao },
            { label: "Entrada", hex: "#C8F36D" },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: l.hex }} /> {l.label}
            </span>
          ))}
        </div>
        <div className="mt-3">
          <Verdict hex={forecast.negativeDay !== null ? "#F87171" : heavy.length ? "#FCD34D" : "#C8F36D"}>{insight}</Verdict>
        </div>
      </Card>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-2 rounded-[22px] border border-white/[0.12] willo-glass p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[16px] font-bold text-white">
                  {selected.day} de {today.toLocaleDateString("pt-BR", { month: "long" })}
                </p>
                {!selected.isPast && (
                  <p className={cn("text-[13px] tabular-nums", selected.balance < 0 ? "text-red-400" : "text-white/55")}>
                    Saldo previsto: {brl(selected.balance)}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fechar" className="text-white/40">
                <X className="h-5 w-5" />
              </button>
            </div>

            {selected.items.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {selected.items.map((i, k) => (
                  <div key={k} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate text-white/70">{i.name}</span>
                    <span className={cn("shrink-0 font-semibold tabular-nums", i.type === "receita" ? "text-willo-green" : "text-white")}>
                      {i.type === "receita" ? "+" : "−"}{brlCents(i.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-white/45">Nenhum compromisso agendado neste dia.</p>
            )}
            {selected.estimated > 0 && (
              <p className="mt-2 text-[12px] text-white/40">+ {brl(selected.estimated)} estimados de gastos do dia a dia.</p>
            )}
            {!selected.isPast && selected.pressure !== "tranquilo" && (
              <p className="mt-2.5 text-[12.5px]" style={{ color: PRESSURE_HEX[selected.pressure] }}>
                {selected.pressure === "pressao" ? "Dia de maior pressão financeira do mês." : "Dia de atenção: tem conta pesada por aqui."}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}

// ─── Smart invoice: a reading of the card, not a list ───────────────

export function SmartInvoice({ data }: { data: RaioXData }) {
  const inv = data.invoice;
  const { installments, card, commitment, impulse, categories } = data;
  if (!inv) return null;

  const share = commitment.income > 0 ? inv.projectedClose / commitment.income : 0;
  const cardCategory = card?.topCategories[0];
  const heaviest = categories.find((c) => c.name === cardCategory?.name);

  const readings: string[] = [];
  if (installments.purchases.length > 0) {
    readings.push(`Você tem ${installments.purchases.length} ${installments.purchases.length === 1 ? "compra parcelada" : "compras parceladas"} rodando: ${brl(installments.monthly)} por mês até ${installments.freeFrom ?? "os próximos meses"}.`);
  }
  if (cardCategory) {
    readings.push(`${cardCategory.name} é o que mais pesa no cartão: ${brl(cardCategory.amount)}${heaviest && heaviest.average > 0 && heaviest.spent > heaviest.average ? `, ${brl(heaviest.spent - heaviest.average)} acima da sua média` : ""}.`);
  }
  if (impulse) readings.push(impulse.message);
  if (share >= 0.4) readings.push(`A fatura prevista come ${Math.round(share * 100)}% da sua renda do mês.`);

  const saving = Math.max((card?.avgTicket ?? 0) * 2, 80);

  return (
    <Section icon={CreditCard} title="Fatura inteligente" hint={`Fecha em ${inv.daysToClose} ${inv.daysToClose === 1 ? "dia" : "dias"}`}>
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[16px] bg-white/[0.04] px-3 py-2.5">
            <p className="truncate text-[11px] text-white/45">Fatura atual</p>
            <p className="truncate text-[17px] font-bold text-white tabular-nums">{brl(inv.current)}</p>
          </div>
          <div className="rounded-[16px] bg-white/[0.04] px-3 py-2.5">
            <p className="truncate text-[11px] text-white/45">Previsão ao fechar</p>
            <p className="truncate text-[17px] font-bold text-white tabular-nums">{brl(inv.projectedClose)}</p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-[16px] bg-willo-green/[0.08] px-3 py-2.5">
            <p className="truncate text-[11px] text-white/55">Limite seguro</p>
            <p className="truncate text-[17px] font-bold text-willo-green tabular-nums">{brl(inv.safeForNewPurchases)}</p>
          </div>
          <div className="rounded-[16px] bg-white/[0.04] px-3 py-2.5">
            <p className="truncate text-[11px] text-white/45">% da renda</p>
            <p className={cn("truncate text-[17px] font-bold tabular-nums", share >= 0.5 ? "text-red-400" : share >= 0.3 ? "text-amber-300" : "text-white")}>
              {Math.round(share * 100)}%
            </p>
          </div>
        </div>

        {inv.futureInstallments > 0 && (
          <p className="mt-3 text-[13px] leading-snug text-white/60">
            <b className="text-white">{brl(inv.futureInstallments)}</b> das próximas faturas já estão comprometidos com parcelas.
          </p>
        )}

        {readings.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
            {readings.map((r, i) => (
              <p key={i} className="flex gap-2 text-[13px] leading-snug text-white/70">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/35" />
                {r}
              </p>
            ))}
          </div>
        )}

        <div className="mt-3">
          <Verdict hex={share >= 0.5 ? "#F87171" : "#7DD3FC"}>
            {share >= 0.5
              ? `Cortando ${brl(saving)} em compras no crédito, a fatura volta para um patamar saudável.`
              : inv.safeForNewPurchases > 0
                ? `Dá pra colocar até ${brl(inv.safeForNewPurchases)} no cartão sem apertar o mês.`
                : "Segure novas compras no crédito até a fatura fechar."}
          </Verdict>
        </div>
      </Card>
    </Section>
  );
}

// ─── Smart surplus ──────────────────────────────────────────────────

export function Surplus({ data }: { data: RaioXData }) {
  const navigate = useNavigate();
  const s = data.surplus;
  const { reserveInfo } = data;
  if (!s) return null;

  const needsReserve = reserveInfo.coverage < 3;
  const rows = [
    {
      key: "reserva",
      label: "Reserva de emergência",
      value: s.reserve,
      hex: "#C8F36D",
      Icon: ShieldCheck,
      note: needsReserve
        ? `sua reserva cobre ${reserveInfo.coverage.toFixed(1).replace(".", ",")} ${reserveInfo.coverage < 2 ? "mês" : "meses"} de gastos essenciais`
        : "sua reserva já está firme",
      go: () => navigate("/gestao"),
    },
    {
      key: "cofrinho",
      label: "Cofrinhos",
      value: s.goal + s.invest,
      hex: "#7DD3FC",
      Icon: PiggyBank,
      note: "para objetivos e investimentos",
      go: () => navigate("/metas"),
    },
    { key: "livre", label: "Livre pra usar", value: s.free, hex: "rgba(255,255,255,0.35)", Icon: Sparkles, note: "sem culpa", go: null },
  ].filter((r) => r.value > 0);

  return (
    <Section icon={Sparkles} title="Sobra inteligente">
      <Card className="p-5">
        <p className="text-[13px] text-white/50">Você deve terminar o mês com</p>
        <p className="truncate text-[30px] font-extrabold leading-tight tracking-tight text-willo-green tabular-nums">{brl(s.surplus)} livres</p>
        <p className="mt-1 text-[13px] text-white/55">Sugestão de destino para essa sobra:</p>

        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="rounded-[18px] bg-white/[0.04] p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${r.hex}1F` }}>
                  <r.Icon className="h-[18px] w-[18px]" style={{ color: r.hex }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-white">{r.label}</p>
                  <p className="truncate text-[12px] text-white/45">{r.note}</p>
                </div>
                <p className="shrink-0 text-[16px] font-bold text-white tabular-nums">{brl(r.value)}</p>
              </div>
              {r.go && (
                <button
                  type="button"
                  onClick={r.go}
                  className="mt-2.5 flex h-9 w-full items-center justify-center gap-1 rounded-full bg-white text-[13px] font-semibold text-[#0B0B0B] active:scale-[0.98]"
                >
                  {r.key === "reserva" ? "Guardar na reserva" : "Escolher cofrinho"}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3">
          <Verdict hex="#C8F36D">
            {needsReserve
              ? "Enquanto a reserva não cobrir três meses de gastos essenciais, ela é o melhor destino para a sobra."
              : "Com a reserva firme, essa sobra rende mais indo para um cofrinho ou investimento."}
          </Verdict>
        </div>
      </Card>
    </Section>
  );
}
