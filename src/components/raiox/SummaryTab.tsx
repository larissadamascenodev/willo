import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import {
  ArrowDownLeft, CalendarCheck, CalendarClock, CalendarRange, ChevronDown, ChevronRight, Coffee, CreditCard, Flag,
  Flame, Gauge, Lightbulb, PiggyBank, Radar, Repeat, ShieldCheck, Sparkles, Stethoscope, Target, TrendingDown,
  TrendingUp, Trophy, Wallet, type LucideIcon,
} from "lucide-react";
import BottomSheet from "@/components/shared/BottomSheet";
import CategoryLimitSheet from "@/components/dashboard/CategoryLimitSheet";
import { getCategoryIcon } from "@/lib/categoryUtils";
import { SCORE_MAX, scoreLevel, type Insight, type InsightIcon, type InsightKind, type PillarKey } from "@/services/raioXService";
import type { RaioXData } from "@/hooks/useRaioX";
import { cn } from "@/lib/utils";
import { Bar, Card, LIGHT_HEX, MONTHS_SHORT, Section, TONE_HEX, Verdict, brl, brlCents } from "./primitives";

const KIND: Record<InsightKind, { label: string; hex: string }> = {
  alerta: { label: "Alerta", hex: "#F87171" },
  atencao: { label: "Atenção", hex: "#FCD34D" },
  dica: { label: "Dica", hex: "#7DD3FC" },
  conquista: { label: "Conquista", hex: "#C8F36D" },
};
const INSIGHT_ICON: Record<InsightIcon, LucideIcon> = {
  flame: Flame, limit: Gauge, calendar: CalendarClock, card: CreditCard, repeat: Repeat, coffee: Coffee,
  "trending-down": TrendingDown, "trending-up": TrendingUp, trophy: Trophy, shield: ShieldCheck,
  wallet: Wallet, piggy: PiggyBank, income: ArrowDownLeft,
};
const PILLAR_SHORT: Record<PillarKey, string> = {
  contas: "Contas em dia", sobra: "Sobra do mês", saldo: "Saldo positivo", gastos: "Gastos", credito: "Crédito", reserva: "Reserva",
};
const PILLAR_ICON: Record<PillarKey, LucideIcon> = {
  contas: CalendarCheck, sobra: PiggyBank, saldo: Wallet, gastos: Gauge, credito: CreditCard, reserva: ShieldCheck,
};

// ─── Traffic light (shown above the tabs) ───────────────────────────

export function DailyLightCard({ data }: { data: RaioXData }) {
  const { light } = data;
  const hex = LIGHT_HEX[light.light];
  const label = light.light === "verde" ? "Dia verde" : light.light === "amarelo" ? "Dia amarelo" : "Dia vermelho";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 flex items-center gap-3.5 rounded-[24px] border p-4"
      style={{ borderColor: `${hex}33`, background: `linear-gradient(135deg, ${hex}14 0%, rgba(20,20,20,0.9) 60%)` }}
    >
      {/* Traffic light */}
      <div className="flex shrink-0 flex-col gap-1.5 rounded-full bg-black/40 p-1.5">
        {(["vermelho", "amarelo", "verde"] as const).map((l) => (
          <span
            key={l}
            className="h-3.5 w-3.5 rounded-full"
            style={l === light.light ? { background: LIGHT_HEX[l], boxShadow: `0 0 12px ${LIGHT_HEX[l]}` } : { background: "rgba(255,255,255,0.08)" }}
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: hex }}>{label}</p>
        <p className="mt-0.5 text-[14px] leading-snug text-white/85">{light.message}</p>
      </div>
      {light.allowance > 0 && (
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-white/40">Hoje</p>
          <p className="text-[17px] font-extrabold tabular-nums text-white">{brl(Math.max(light.leftToday, 0))}</p>
        </div>
      )}
    </motion.div>
  );
}

// ─── Score: speedometer ─────────────────────────────────────────────

const TICKS = 40;

export function ScoreCard({ data }: { data: RaioXData }) {
  const { report, trend } = data;
  const [open, setOpen] = useState(false);
  const count = useMotionValue(0);
  const shown = useTransform(count, (v) => Math.round(v));
  useEffect(() => {
    const controls = animate(count, report.score, { duration: 1.3, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [count, report.score]);

  // Rising streak, counted backwards from this month
  let streak = 0;
  for (let i = trend.length - 1; i > 0 && trend[i].score > trend[i - 1].score; i--) streak++;
  const delta = trend.length >= 2 ? trend[trend.length - 1].score - trend[trend.length - 2].score : null;
  const trendText = streak >= 2
    ? `Subindo há ${streak} meses seguidos 🔥`
    : delta !== null && delta > 0
      ? `+${delta} pontos desde o mês passado 📈`
      : delta !== null && delta < 0
        ? `${delta} pontos desde o mês passado. Dá pra recuperar 💪`
        : "Seu primeiro mês de score. Agora é subir 🚀";

  const lit = Math.round((report.score / SCORE_MAX) * TICKS);
  const W = 280, H = 158, cx = W / 2, cy = 148, r1 = 104, r2 = 128;
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const angle = Math.PI - (i / (TICKS - 1)) * Math.PI;
    return {
      x1: cx + r1 * Math.cos(angle), y1: cy - r1 * Math.sin(angle),
      x2: cx + r2 * Math.cos(angle), y2: cy - r2 * Math.sin(angle),
    };
  });
  const max = Math.max(...trend.map((t) => t.score), 1);

  return (
    <Section icon={Sparkles} title="Saúde financeira">
      <div
        className="relative overflow-hidden rounded-[28px] border border-white/[0.12] px-4 pb-5 pt-4"
        style={{ background: `radial-gradient(120% 80% at 50% 0%, ${report.level.hex}1F 0%, rgba(20,20,20,0.95) 55%, #0E0E0E 100%)` }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(75% 65% at 50% 30%, black, transparent)",
            WebkitMaskImage: "radial-gradient(75% 65% at 50% 30%, black, transparent)",
          }}
        />

        {/* Speedometer */}
        <div className="relative mx-auto" style={{ width: W, maxWidth: "100%" }}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {ticks.map((t, i) => (
              <motion.line
                key={i}
                x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                strokeWidth={4.5}
                strokeLinecap="round"
                initial={{ stroke: "rgba(255,255,255,0.08)" }}
                animate={{ stroke: i < lit ? report.level.hex : "rgba(255,255,255,0.08)" }}
                transition={{ delay: 0.12 + i * 0.022, duration: 0.2 }}
                style={i < lit ? { filter: `drop-shadow(0 0 4px ${report.level.hex}66)` } : undefined}
              />
            ))}
          </svg>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
            <motion.span className="text-[54px] font-extrabold leading-none tracking-tighter text-white tabular-nums">{shown}</motion.span>
            <span className="mt-1 text-[11px] text-white/40">de {SCORE_MAX} pontos</span>
          </div>
        </div>

        <div className="relative mt-3 flex flex-col items-center gap-1.5">
          <span className="rounded-full px-3.5 py-1 text-[13px] font-bold text-[#0B0B0B]" style={{ background: report.level.hex }}>
            {report.level.label}
          </span>
          <p className="text-center text-[12px] text-white/55">{trendText}</p>
        </div>

        {/* Scale */}
        <div className="relative mt-3.5 grid grid-cols-4 gap-1.5">
          {[300, 500, 700, 900].map((sc) => {
            const l = scoreLevel(sc);
            const active = l.key === report.level.key;
            return (
              <div key={l.key} className="text-center">
                <div className="h-1 rounded-full" style={{ background: active ? l.hex : `${l.hex}33` }} />
                <p className={cn("mt-1 text-[9px]", active ? "font-semibold text-white" : "text-white/35")}>{l.label}</p>
              </div>
            );
          })}
        </div>

        {/* Trend */}
        {trend.length >= 2 && (
          <div className="relative mt-4 flex items-end justify-between gap-1.5 rounded-[18px] bg-black/25 px-3 pb-2 pt-2.5">
            {trend.map((t, i) => {
              const level = scoreLevel(t.score);
              const last = i === trend.length - 1;
              return (
                <div key={i} className="flex flex-1 flex-col items-center">
                  <span className={cn("mb-1 text-[9px] tabular-nums", last ? "font-bold text-white" : "text-white/40")}>{t.score}</span>
                  <motion.span
                    className="w-full max-w-[30px] rounded-[6px]"
                    style={{ background: last ? level.hex : `${level.hex}55` }}
                    initial={{ height: 0 }}
                    whileInView={{ height: Math.max((t.score / max) * 40, 5) }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06, duration: 0.5 }}
                  />
                  <span className={cn("mt-1 text-[9px]", last ? "text-white" : "text-white/40")}>{MONTHS_SHORT[t.month]}</span>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative mt-3.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-white/[0.07] text-[14px] font-semibold text-white transition-transform active:scale-[0.98]"
        >
          Ver o que forma seu score <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <div className="px-5 pb-4">
          <p className="text-[22px] font-bold tracking-tight text-white">O que forma seu score</p>
          <p className="text-[14px] text-white/45">Cada pilar soma pontos até {SCORE_MAX}.</p>
          <div className="mt-4 divide-y divide-white/[0.06]">
            {report.pillars.map((p, i) => {
              const Icon = PILLAR_ICON[p.key];
              const hex = TONE_HEX[p.tone];
              return (
                <div key={p.key} className="py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `${hex}1A` }}>
                      <Icon className="h-[18px] w-[18px]" style={{ color: hex }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-white">{p.label}</p>
                      <p className="text-[12px] text-white/45">{p.detail}</p>
                    </div>
                    <p className="shrink-0 tabular-nums">
                      <span className="text-[17px] font-bold text-white">{p.points}</span>
                      <span className="text-[12px] text-white/35">/{p.max}</span>
                    </p>
                  </div>
                  <Bar value={p.points / p.max} hex={hex} className="ml-[52px] mt-2" delay={0.05 * i} />
                </div>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    </Section>
  );
}

// ─── Weekly summary ─────────────────────────────────────────────────

export function WeeklyCard({ data }: { data: RaioXData }) {
  const { weekly } = data;
  const up = weekly.change !== null && weekly.change > 0;
  const max = Math.max(...weekly.days.map((d) => d.amount), 1);

  return (
    <Section icon={CalendarRange} title="Sua semana" hint="Últimos 7 dias">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-white/45">Gasto na semana</p>
            <p className="truncate text-[26px] font-extrabold leading-tight tracking-tight text-white tabular-nums">{brl(weekly.spent)}</p>
          </div>
          {weekly.change !== null && (
            <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums", up ? "bg-red-400/15 text-red-400" : "bg-willo-green/15 text-willo-green")}>
              {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {up ? "+" : ""}{Math.round(weekly.change * 100)}%
            </span>
          )}
        </div>

        {/* One bar per day */}
        <div className="mt-4 flex h-24 items-end justify-between gap-1.5">
          {weekly.days.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center">
              <motion.span
                className="w-full max-w-[26px] rounded-[7px]"
                style={{ background: d.today ? "#C8F36D" : d.amount > 0 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.08)" }}
                initial={{ height: 0 }}
                whileInView={{ height: Math.max((d.amount / max) * 72, 4) }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.45 }}
              />
              <span className={cn("mt-1.5 text-[10px]", d.today ? "font-bold text-white" : "text-white/40")}>{d.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-[12px]">
          <span className="min-w-0 truncate text-white/45">
            Semana anterior <b className="font-semibold text-white tabular-nums">{brl(weekly.previous)}</b>
          </span>
          {weekly.topCategory && (
            <span className="min-w-0 truncate text-right text-white/45">
              Mais em <b className="font-semibold text-white">{weekly.topCategory.name}</b>
            </span>
          )}
        </div>
        <p className="mt-2.5 text-[13px] leading-snug text-white/70">{weekly.message}</p>
      </Card>
    </Section>
  );
}

// ─── Radar with actions ─────────────────────────────────────────────

const FILTERS: { key: "todos" | InsightKind; label: string }[] = [
  { key: "todos", label: "Tudo" },
  { key: "alerta", label: "Alertas" },
  { key: "atencao", label: "Atenção" },
  { key: "dica", label: "Dicas" },
  { key: "conquista", label: "Conquistas" },
];

export function RadarList({ data }: { data: RaioXData }) {
  const navigate = useNavigate();
  const insights = data.report.insights;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("todos");
  const [expanded, setExpanded] = useState(false);
  const [limitFor, setLimitFor] = useState<string | null>(null);
  const filtered = filter === "todos" ? insights : insights.filter((i) => i.kind === filter);
  const visible = expanded ? filtered : filtered.slice(0, 5);
  const counts: Record<string, number> = {};
  for (const i of insights) counts[i.kind] = (counts[i.kind] ?? 0) + 1;

  const act = (insight: Insight) => {
    if (!insight.action) return;
    if (insight.action.type === "limit") setLimitFor(insight.action.category);
    else navigate(insight.action.to);
  };

  return (
    <Section
      id="radar"
      icon={Radar}
      title="Radar"
      hint="Alertas, dicas e conquistas do seu mês"
      aside={<span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[12px] font-semibold text-white/70 tabular-nums">{insights.length}</span>}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.filter((f) => f.key === "todos" || counts[f.key]).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => { setFilter(f.key); setExpanded(false); }}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors",
              filter === f.key ? "bg-white text-[#0B0B0B]" : "border border-white/[0.12] willo-glass text-white/70",
            )}
          >
            {f.key !== "todos" && <span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND[f.key].hex }} />}
            {f.label}
            {f.key !== "todos" && <span className="tabular-nums opacity-50">{counts[f.key]}</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-6 text-center text-[14px] text-white/45">Nada por aqui. Tudo tranquilo 😌</Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {visible.map((insight, i) => {
              const kind = KIND[insight.kind];
              const Icon = insight.category ? getCategoryIcon(insight.category) : INSIGHT_ICON[insight.icon];
              return (
                <motion.div
                  key={insight.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="relative overflow-hidden rounded-[22px] border border-white/[0.12] willo-glass p-4"
                >
                  <span className="absolute inset-y-4 left-0 w-[3px] rounded-r-full" style={{ background: kind.hex }} />
                  <div className="flex gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `${kind.hex}17` }}>
                      <Icon className="h-5 w-5" style={{ color: kind.hex }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: kind.hex }}>{kind.label}</p>
                      <p className="mt-0.5 text-[15px] font-semibold leading-snug text-white">{insight.title}</p>
                      <p className="mt-1 text-[13px] leading-snug text-white/55">{insight.message}</p>
                      {insight.tip && (
                        <p className="mt-2.5 flex gap-1.5 rounded-[14px] bg-white/[0.04] px-3 py-2 text-[12px] leading-snug text-white/75">
                          <Lightbulb className="mt-px h-3.5 w-3.5 shrink-0 text-amber-200" />
                          {insight.tip}
                        </p>
                      )}
                      {insight.action && (
                        <button
                          type="button"
                          onClick={() => act(insight)}
                          className="mt-2.5 inline-flex h-9 items-center gap-1 rounded-full bg-white px-3.5 text-[13px] font-semibold text-[#0B0B0B] active:scale-95 transition-transform"
                        >
                          {insight.action.type === "limit" ? `Criar limite para ${insight.action.category}` : insight.action.label}
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filtered.length > 5 && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-center gap-1 py-2 text-[13px] font-medium text-white/55">
              {expanded ? "Mostrar menos" : `Ver todos (${filtered.length})`}
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </div>
      )}

      <CategoryLimitSheet
        open={limitFor !== null}
        onClose={() => setLimitFor(null)}
        initialCategory={limitFor}
        spentByCategory={Object.fromEntries(data.current.categories.map((c) => [c.name, c.amount]))}
        currentLimits={Object.fromEntries(data.limits.map((l) => [l.category, l.limit]))}
      />
    </Section>
  );
}

// ─── Goals countdown ────────────────────────────────────────────────

export function GoalsCountdown({ data }: { data: RaioXData }) {
  const navigate = useNavigate();
  if (data.goals.length === 0) return null;
  return (
    <Section icon={Target} title="Suas metas" hint="Contagem regressiva no seu ritmo atual">
      <div className="space-y-2">
        {data.goals.slice(0, 4).map((g) => {
          const hex = g.onTrack === false ? "#FCD34D" : "#C8F36D";
          return (
            <Card key={g.goal.id} className="p-4" onClick={() => navigate(`/metas/${g.goal.id}`)}>
              <div className="flex items-center gap-3">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                  <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                    <circle cx="24" cy="24" r="20" fill="none" stroke={hex} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${g.progress * 125.7} 125.7`} />
                  </svg>
                  <span className="text-[11px] font-bold text-white tabular-nums">{Math.round(g.progress * 100)}%</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-white">{g.goal.name}</p>
                  <p className="text-[12px] text-white/45 tabular-nums">{brl(g.goal.current)} de {brl(g.goal.target)}</p>
                </div>
                {g.monthsLeft !== null && (
                  <div className="shrink-0 text-right">
                    <p className="text-[20px] font-extrabold leading-none text-white tabular-nums">{g.monthsLeft}</p>
                    <p className="text-[10px] text-white/40">{g.monthsLeft === 1 ? "mês" : "meses"}</p>
                  </div>
                )}
              </div>
              <p className="mt-3 text-[13px] leading-snug" style={{ color: g.onTrack === false ? "#FDE68A" : "rgba(255,255,255,0.65)" }}>{g.message}</p>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
