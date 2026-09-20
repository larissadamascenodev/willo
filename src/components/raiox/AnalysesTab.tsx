import { motion } from "framer-motion";
import { AlertOctagon, Droplets, GraduationCap, Moon, Repeat, Wallet } from "lucide-react";
import { getCategoryHexColor, getCategoryIcon } from "@/lib/categoryUtils";
import type { RaioXData } from "@/hooks/useRaioX";
import { cn } from "@/lib/utils";
import { Card, Section, Verdict, brl, brlCents } from "./primitives";

import { currencySymbol } from "@/lib/currency";
export default function AnalysesTab({ data }: { data: RaioXData }) {
  return (
    <>
      <CategoriesAndLeaks data={data} />
      <CashFlowReading data={data} />
      <Lessons data={data} />
    </>
  );
}

// ─── Where the money leaks ──────────────────────────────────────────

function CategoriesAndLeaks({ data }: { data: RaioXData }) {
  const { categories, villain, leaks, duplicates, impulse, anomalies } = data;
  if (categories.length === 0) return null;

  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);

  // A leak is what runs above the usual, plus the recurring drains
  const overspending = categories
    .filter((c) => c.average > 0 && c.spent > c.average)
    .map((c) => ({ ...c, excess: c.spent - c.average }))
    .sort((x, y) => y.excess - x.excess)
    .slice(0, 3);
  const excessTotal = overspending.reduce((sum, c) => sum + c.excess, 0);
  const monthlyDrains = leaks.leaks.reduce((sum, l) => sum + l.monthly, 0);
  const escaping = excessTotal + monthlyDrains;

  const drains = [
    ...leaks.leaks.map((l) => ({ id: l.id, Icon: l.kind === "taxa" ? AlertOctagon : Repeat, title: l.title, detail: l.detail })),
    ...duplicates.map((d) => ({
      id: `dup-${d.name}-${d.dates[0]}`,
      Icon: AlertOctagon,
      title: `${d.name} cobrado 2x`,
      detail: `${brlCents(d.amount)} em ${d.dates.map((x) => `${x.slice(8, 10)}/${x.slice(5, 7)}`).join(" e ")} · confira se foi engano`,
    })),
    ...(impulse ? [{ id: "impulso", Icon: Moon, title: "Compras por impulso", detail: impulse.message }] : []),
  ];

  const topAnomaly = anomalies.find((x) => x.category);
  const verdict = escaping > 0
    ? `Voltando ao seu padrão nessas categorias e revisando as cobranças fixas, você libera cerca de ${brl(escaping)} por mês, ${brl(escaping * 12)} em um ano.`
    : topAnomaly
      ? `${topAnomaly.what} ${topAnomaly.action}`
      : "Nenhum vazamento por aqui: seus gastos estão dentro do seu padrão 👏";

  const VillainIcon = villain ? getCategoryIcon(villain.name) : null;

  return (
    <Section icon={Droplets} title="Onde seu dinheiro escapa" hint="O que está fugindo do seu padrão">
      {/* How much is escaping */}
      <div
        className="mb-2 overflow-hidden rounded-[26px] border p-5"
        style={{
          borderColor: escaping > 0 ? "rgba(252,211,77,0.22)" : "rgba(200,243,109,0.22)",
          background: `linear-gradient(135deg, ${escaping > 0 ? "rgba(252,211,77,0.13)" : "rgba(200,243,109,0.12)"}, rgba(20,20,20,0.95) 65%)`,
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: escaping > 0 ? "#FCD34D" : "#C8F36D" }}>
          {escaping > 0 ? "Escapando por mês" : "Tudo sob controle"}
        </p>
        <p className="mt-1 truncate text-[34px] font-extrabold leading-none tracking-tight text-white tabular-nums">{brl(escaping)}</p>
        <p className="mt-1.5 text-[12.5px] leading-snug text-white/60">
          {escaping > 0
            ? `${brl(excessTotal)} em gastos acima da sua média e ${brl(monthlyDrains)} em cobranças recorrentes`
            : "Nenhum gasto acima da média nem cobrança esquecida neste mês"}
        </p>
      </div>

      {/* Villain of the month */}
      {villain && VillainIcon && (
        <Card className="mb-2 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-400/15">
              <VillainIcon className="h-6 w-6 text-red-400" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-red-400">Vilã do mês 😈</p>
              <p className="truncate text-[18px] font-bold text-white">{villain.name}</p>
              <p className="truncate text-[12px] text-white/55 tabular-nums">
                {brl(villain.spent)} · {Math.round((villain.spent / (totalSpent || 1)) * 100)}% de tudo que você gastou
              </p>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-snug text-white/70">{villain.diagnosis}</p>
        </Card>
      )}

      {/* Categories running above the usual */}
      {overspending.length > 0 && (
        <Card className="mb-2 p-4">
          <p className="mb-3 text-[12px] text-white/45">Gastando acima do seu normal</p>
          <div className="space-y-4">
            {overspending.map((c) => {
              const Icon = getCategoryIcon(c.name);
              const hex = getCategoryHexColor(c.name);
              const scale = Math.max(c.spent, c.average) || 1;
              return (
                <div key={c.name}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${hex}1F` }}>
                      <Icon className="h-[17px] w-[17px]" style={{ color: hex }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] text-white">{c.name}</p>
                      <p className="truncate text-[11.5px] text-white/45 tabular-nums">{brl(c.spent)} este mês · média {brl(c.average)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-red-400/15 px-2.5 py-1 text-[12px] font-bold text-red-400 tabular-nums">
                      +{brl(c.excess)}
                    </span>
                  </div>
                  <div className="ml-12 mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-[10px] text-white/35">média</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-white/30" style={{ width: `${(c.average / scale) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-[10px] text-white/55">agora</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: hex }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${(c.spent / scale) * 100}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recurring drains */}
      {drains.length > 0 && (
        <Card className="mb-2 p-4">
          <p className="mb-2.5 text-[12px] text-white/45">Cobranças que passam despercebidas</p>
          <div className="space-y-3">
            {drains.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-300/10">
                  <d.Icon className="h-4 w-4 text-amber-300" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-white">{d.title}</p>
                  <p className="text-[12px] leading-snug text-white/45">{d.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <Verdict hex={escaping > 0 ? "#FCD34D" : "#C8F36D"}>{verdict}</Verdict>
      </Card>
    </Section>
  );
}

// ─── Cash flow, read as an analysis ─────────────────────────────────

function CashFlowReading({ data }: { data: RaioXData }) {
  const f = data.cashFlow;
  const { comparison } = data;
  if (f.income === 0 && f.expense === 0) return null;

  const burn = f.income > 0 ? f.expense / f.income : 1;
  const heaviest = f.weeks.reduce((m, w, i) => (w.expense > f.weeks[m].expense ? i : m), 0);
  const firstHalf = f.weeks.slice(0, 2).reduce((s, w) => s + w.expense, 0);
  const firstHalfShare = f.expense > 0 ? firstHalf / f.expense : 0;
  const biggestOutShare = f.biggestOut && f.income > 0 ? f.biggestOut.amount / f.income : 0;
  const incomeConcentration = f.biggestIn && f.income > 0 ? f.biggestIn.amount / f.income : 0;

  const readings = [
    `De cada ${currencySymbol()} 100 que entraram, você já usou ${currencySymbol()} ${Math.round(Math.min(burn, 9.99) * 100)}.`,
    firstHalfShare >= 0.6
      ? `${Math.round(firstHalfShare * 100)}% das saídas acontecem na primeira quinzena, logo depois que o dinheiro entra.`
      : `As saídas estão bem distribuídas no mês; a semana ${f.weeks[heaviest].label} foi a mais pesada.`,
    f.biggestOut
      ? `Maior saída: ${f.biggestOut.name}, ${brlCents(f.biggestOut.amount)}${biggestOutShare > 0.1 ? ` (${Math.round(biggestOutShare * 100)}% da renda do mês)` : ""}.`
      : null,
    incomeConcentration >= 0.9 && f.biggestIn
      ? `Toda a sua renda vem de uma fonte só (${f.biggestIn.name}). Uma segunda entrada deixaria o mês menos sensível a atrasos.`
      : null,
    comparison.hasBefore
      ? comparison.expense.now > comparison.expense.before
        ? `No mês passado, até aqui, tinham saído ${brl(comparison.expense.before)}. Você está gastando mais rápido.`
        : `No mês passado, até aqui, tinham saído ${brl(comparison.expense.before)}. Você está gastando mais devagar.`
      : null,
  ].filter(Boolean) as string[];

  const verdict = burn >= 1
    ? "Está saindo mais do que entra nas contas. Nesse ritmo o mês fecha no vermelho ou come a reserva."
    : burn >= 0.85
      ? "Sobra pouco depois das contas: qualquer imprevisto vira dívida. Vale abrir mais folga."
      : `Boa margem: sobra ${Math.round((1 - burn) * 100)}% do que entra nas contas.`;

  return (
    <Section icon={Wallet} title="Fluxo das contas" hint="O que entra, o que sai e o que isso diz">
      <Card className="p-5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-white/45">Comprometido do que entrou</p>
            <p className={cn("truncate text-[32px] font-extrabold leading-tight tracking-tight tabular-nums", burn >= 1 ? "text-red-400" : burn >= 0.85 ? "text-amber-300" : "text-white")}>
              {Math.round(Math.min(burn, 9.99) * 100)}%
            </p>
          </div>
          <div className="shrink-0 text-right text-[12px] text-white/45">
            Resultado do mês
            <span className={cn("block text-[16px] font-bold tabular-nums", f.net < 0 ? "text-red-400" : "text-willo-green")}>{brl(f.net)}</span>
          </div>
        </div>

        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.span
            className="h-full rounded-l-full bg-red-400/80"
            initial={{ width: 0 }}
            whileInView={{ width: `${Math.min(burn, 1) * 100}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11.5px] text-white/45 tabular-nums">
          <span>Entrou {brl(f.income)}</span>
          <span>Saiu {brl(f.expense)}</span>
        </div>

        <div className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3">
          {readings.map((r, i) => (
            <p key={i} className="flex gap-2 text-[13px] leading-snug text-white/70">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/35" />
              {r}
            </p>
          ))}
        </div>

        <div className="mt-3">
          <Verdict hex={burn >= 1 ? "#F87171" : burn >= 0.85 ? "#FCD34D" : "#C8F36D"}>{verdict}</Verdict>
        </div>
      </Card>
    </Section>
  );
}

// ─── What this month taught ─────────────────────────────────────────

function Lessons({ data }: { data: RaioXData }) {
  if (data.lessons.length === 0) return null;
  return (
    <Section icon={GraduationCap} title="O que este mês ensinou" hint="Padrões que aparecem no seu histórico">
      <Card className="space-y-2.5 p-4">
        {data.lessons.map((l, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="flex gap-2.5 text-[13.5px] leading-snug text-white/75"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
            {l}
          </motion.p>
        ))}
      </Card>
    </Section>
  );
}
