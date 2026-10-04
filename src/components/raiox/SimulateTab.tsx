import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Check, ChevronDown, Plus, Scissors, ShoppingBag } from "lucide-react";
import BottomSheet from "@/components/shared/BottomSheet";
import { getCategoryHexColor, getCategoryIcon } from "@/lib/categoryUtils";
import { purchaseScenarios } from "@/services/raioXForecast";
import type { RaioXData } from "@/hooks/useRaioX";
import { cn } from "@/lib/utils";
import { Card, LIGHT_HEX, MONTHS_SHORT, Section, Verdict, brl, brlCents } from "./primitives";

import { currencySymbol } from "@/lib/currency";
export default function SimulateTab({ data }: { data: RaioXData }) {
  return (
    <>
      <PurchaseCopilot data={data} />
      <CutSimulator data={data} />
    </>
  );
}

const moneyInput = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
};

// ─── Purchase copilot ───────────────────────────────────────────────

const TIMES = [1, 2, 3, 4, 5, 6];

function PurchaseCopilot({ data }: { data: RaioXData }) {
  const [value, setValue] = useState(0);
  const [times, setTimes] = useState(1);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const { report, installments, goals, today, commitment } = data;
  const income = commitment.income;

  const sim = useMemo(() => {
    if (value <= 0) return null;
    const monthly = value / times;
    const baseNet = report.projection.avgNet;
    const months = Array.from({ length: times }, (_, k) => {
      // Installments already running in that month stop weighing as they end
      const existing = installments.purchases.filter((p) => p.remaining > k).reduce((s, p) => s + p.amount, 0);
      const free = k === 0 ? report.pulse.free : baseNet + installments.monthly - existing;
      const date = new Date(today.getFullYear(), today.getMonth() + k, 1);
      return {
        label: `${MONTHS_SHORT[date.getMonth()]}${date.getFullYear() !== today.getFullYear() ? `/${String(date.getFullYear()).slice(2)}` : ""}`,
        before: free,
        after: free - monthly,
      };
    });
    const worst = Math.min(...months.map((m) => m.after));
    const light = worst < 0 ? "vermelho" : worst < income * 0.1 ? "amarelo" : "verde";
    const goal = goals.find((g) => g.monthly > 0);
    const goalDelay = goal ? Math.ceil(value / goal.monthly) : null;

    const verdict = light === "vermelho"
      ? `Essa compra deixa ${months.find((m) => m.after < 0)?.label} no vermelho. Melhor esperar ou dividir em mais vezes 🛑`
      : light === "amarelo"
        ? "Dá pra comprar, mas o orçamento fica apertado. Pense duas vezes 🤔"
        : "Cabe no seu bolso sem apertar. Pode ir tranquilo ✅";

    return { monthly, months, light, goal, goalDelay, verdict, share: income > 0 ? monthly / income : null };
  }, [value, times, report, installments, goals, today, income]);

  const applyCustom = () => {
    const n = Math.min(Math.max(Number(custom.replace(/\D/g, "")) || 0, 1), 60);
    if (n > 0) setTimes(n);
    setCustom("");
    setCustomOpen(false);
  };

  return (
    <Section icon={ShoppingBag} title="Posso comprar?" hint="Veja o impacto antes de decidir">
      <Card className="p-4">
        <p className="text-[12px] text-white/62">Quanto custa o que você quer comprar?</p>
        <label className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[20px] font-bold text-white/56">{currencySymbol()}</span>
          <input
            inputMode="numeric"
            value={value ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""}
            onChange={(e) => setValue(moneyInput(e.target.value))}
            placeholder="0,00"
            className="w-full min-w-0 bg-transparent text-[34px] font-extrabold leading-none tracking-tight text-white tabular-nums placeholder:text-white/20 focus:outline-none"
          />
        </label>

        <p className="mt-4 text-[12px] text-white/62">Como vai pagar?</p>
        <div className="mt-2 grid grid-cols-8 gap-1.5">
          {TIMES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTimes(n)}
              className={cn(
                "h-9 rounded-full text-[12px] font-semibold transition-colors",
                n === 1 && "col-span-2",
                times === n ? "bg-white text-[#0B0B0B]" : "border border-white/[0.08] bg-white/[0.04] text-white/82",
              )}
            >
              {n === 1 ? "À vista" : `${n}x`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            aria-label="Outro número de parcelas"
            className={cn(
              "flex h-9 items-center justify-center gap-0.5 rounded-full text-[12px] font-semibold transition-colors",
              times > 6 ? "bg-white text-[#0B0B0B]" : "border border-white/[0.08] bg-white/[0.04] text-white/82",
            )}
          >
            {times > 6 ? `${times}x` : <Plus className="h-4 w-4" />}
          </button>
        </div>

        <AnimatePresence>
          {customOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-2.5 flex gap-2">
                <input
                  autoFocus
                  inputMode="numeric"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  onKeyDown={(e) => e.key === "Enter" && applyCustom()}
                  placeholder="Ex.: 18"
                  className="h-10 min-w-0 flex-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-[14px] text-white placeholder:text-white/45 focus:outline-none"
                />
                <button type="button" onClick={applyCustom} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0B0B0B]">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sim && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-4 flex items-start gap-2.5 rounded-[18px] p-3.5" style={{ background: `${LIGHT_HEX[sim.light]}14` }}>
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: LIGHT_HEX[sim.light], boxShadow: `0 0 10px ${LIGHT_HEX[sim.light]}` }} />
                <p className="text-[13px] leading-snug text-white/85">{sim.verdict}</p>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div className="rounded-[16px] bg-white/[0.04] p-3">
                  <p className="truncate text-[11px] text-white/62">{times === 1 ? "Sai este mês" : "Por mês"}</p>
                  <p className="truncate text-[17px] font-bold text-white tabular-nums">{brlCents(sim.monthly)}</p>
                  {sim.share !== null && <p className="text-[11px] text-white/56">{Math.round(sim.share * 100)}% da renda</p>}
                </div>
                <div className="rounded-[16px] bg-white/[0.04] p-3">
                  <p className="truncate text-[11px] text-white/62">Sobra depois</p>
                  <p className={cn("truncate text-[17px] font-bold tabular-nums", sim.months[0].after < 0 ? "text-red-400" : "text-white")}>{brl(sim.months[0].after)}</p>
                  <p className="truncate text-[11px] text-white/56 tabular-nums">antes: {brl(sim.months[0].before)}</p>
                </div>
              </div>

              {times > 1 && (
                <div className="mt-2.5 rounded-[18px] bg-black/25 p-3">
                  <p className="mb-2 text-[11px] text-white/62">Sobra de cada mês com a parcela</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {sim.months.slice(0, 12).map((m) => {
                      const hex = m.after < 0 ? "#F87171" : m.after < income * 0.1 ? "#FCD34D" : "#C8F36D";
                      return (
                        <div key={m.label} className="rounded-[12px] bg-white/[0.04] px-1.5 py-2 text-center">
                          <p className="truncate text-[10px] text-white/62">{m.label}</p>
                          <p className="truncate text-[11px] font-bold tabular-nums" style={{ color: hex }}>{brl(m.after)}</p>
                        </div>
                      );
                    })}
                  </div>
                  {sim.months.length > 12 && <p className="mt-2 text-[11px] text-white/56">+{sim.months.length - 12} meses no mesmo ritmo</p>}
                </div>
              )}

              {sim.goal && sim.goalDelay !== null && (
                <p className="mt-2.5 text-[12px] leading-snug text-white/74">
                  🎯 Equivale a <b className="text-white">{sim.goalDelay} {sim.goalDelay === 1 ? "mês" : "meses"}</b> de depósitos na meta “{sim.goal.goal.name}”.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </Section>
  );
}

// ─── Cut simulator ──────────────────────────────────────────────────

const CUT_STEPS = [50, 100, 200, 300, 500];

function CutSimulator({ data }: { data: RaioXData }) {
  const options = data.categories.filter((c) => c.spent >= 20 || c.average >= 20);
  const [category, setCategory] = useState<string | null>(options[0]?.name ?? null);
  const [cut, setCut] = useState(100);
  const [pickerOpen, setPickerOpen] = useState(false);
  if (options.length === 0) return null;

  const selected = options.find((c) => c.name === category) ?? options[0];
  const base = Math.max(selected.average, selected.spent);
  const effectiveCut = Math.min(cut, base);
  const { avgNet, start } = data.report.projection;
  const keep12 = start + avgNet * 12;
  const adjust12 = keep12 + effectiveCut * 12;
  const SelectedIcon = getCategoryIcon(selected.name);

  return (
    <Section icon={Scissors} title="Simulador de corte" hint="E se você gastasse menos em uma categoria?">
      <Card className="p-4">
        {/* Category picker */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center gap-3 rounded-[18px] border border-white/[0.08] bg-white/[0.04] px-3.5 py-3 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${getCategoryHexColor(selected.name)}1F` }}>
            <SelectedIcon className="h-[18px] w-[18px]" style={{ color: getCategoryHexColor(selected.name) }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-white/62">Categoria</span>
            <span className="block truncate text-[15px] font-semibold text-white">{selected.name}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-white/56" />
        </button>

        <p className="mt-3.5 text-[12px] leading-snug text-white/66">
          Você gasta cerca de <b className="text-white">{brl(base)}</b> por mês aqui. Quanto quer cortar?
        </p>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {CUT_STEPS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={s > base && s !== CUT_STEPS[0]}
              onClick={() => setCut(s)}
              className={cn(
                "h-9 rounded-full text-[12px] font-semibold transition-colors disabled:opacity-30",
                cut === s ? "bg-willo-green text-[#0B0B0B]" : "border border-white/[0.08] bg-white/[0.04] text-white/82",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {[3, 6, 12].map((m) => (
            <div key={m} className="rounded-[16px] bg-willo-green/[0.08] px-2 py-2.5 text-center">
              <p className="text-[10px] text-white/66">{m === 12 ? "1 ano" : `${m} meses`}</p>
              <p className="truncate text-[15px] font-extrabold text-willo-green tabular-nums">+{brl(effectiveCut * m)}</p>
            </div>
          ))}
        </div>

        <p className="mb-2 mt-4 text-[12px] font-semibold text-white">Seu saldo daqui a 1 ano</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[16px] bg-white/[0.04] p-3">
            <p className="truncate text-[11px] text-white/66">Se continuar assim</p>
            <p className={cn("truncate text-[17px] font-bold tabular-nums", keep12 < 0 ? "text-red-400" : "text-white")}>{brl(keep12)}</p>
          </div>
          <div className="rounded-[16px] border border-willo-green/25 bg-willo-green/[0.08] p-3">
            <p className="truncate text-[11px] text-white/74">Se ajustar</p>
            <p className={cn("truncate text-[17px] font-bold tabular-nums", adjust12 < 0 ? "text-red-400" : "text-willo-green")}>{brl(adjust12)}</p>
          </div>
        </div>
        <div className="mt-3">
          <Verdict hex="#C8F36D">
            Cortando {brl(effectiveCut)} por mês em {selected.name}, você junta {brl(effectiveCut * 12)} em um ano
            {effectiveCut * 12 >= 1000 ? ". Dá uma viagem, hein? ✈️" : ". Pequenos cortes, grande diferença 💡"}
          </Verdict>
        </div>
      </Card>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <div className="px-5 pb-3">
          <p className="text-[20px] font-bold text-white">Escolha a categoria</p>
          <div className="mt-3 divide-y divide-white/[0.06]">
            {options.map((c) => {
              const Icon = getCategoryIcon(c.name);
              const hex = getCategoryHexColor(c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => { setCategory(c.name); setPickerOpen(false); }}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `${hex}1F` }}>
                    <Icon className="h-[18px] w-[18px]" style={{ color: hex }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-white">{c.name}</span>
                    <span className="block text-[12px] text-white/62 tabular-nums">{brl(Math.max(c.average, c.spent))} por mês</span>
                  </span>
                  {c.name === selected.name && <Check className="h-5 w-5 shrink-0 text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    </Section>
  );
}
