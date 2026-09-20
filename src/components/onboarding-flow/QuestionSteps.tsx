import { useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import GlowButton from "@/components/shared/GlowButton";
import { cn } from "@/lib/utils";
import { FlowScreen, Heading, NumberWheel, OptionRow, ValueRuler } from "./primitives";

interface Base {
  section: string;
  light: ReactNode;
  bold: ReactNode;
  sub?: ReactNode;
  onBack: () => void;
  onNext: () => void;
}

/** Pick one (auto-advances) or several answers. */
export function ChoiceStep<T extends string>({ section, light, bold, sub, options, value, onChange, multi = false, onBack, onNext, note }: Base & {
  options: { value: T; label: string; hint?: string }[];
  value: T | T[] | null;
  onChange: (v: T | T[]) => void;
  multi?: boolean;
  note?: string;
}) {
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  const hasValue = Array.isArray(value) ? value.length > 0 : !!value;

  const advancing = useRef(false);
  const pick = (v: T) => {
    if (advancing.current) return;
    if (multi) {
      const list = Array.isArray(value) ? value : [];
      onChange(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
    } else {
      onChange(v);
      advancing.current = true;
      setTimeout(onNext, 380);
    }
  };

  return (
    <FlowScreen section={section} onBack={onBack} footer={<GlowButton disabled={!hasValue} onClick={onNext}>Continuar</GlowButton>}>
      <div className={cn("flex min-h-full flex-col", options.length <= 4 && "justify-center")}>
        <Heading light={light} bold={bold} sub={sub} className="pt-6" />
        <div className="mt-8 space-y-2.5 pb-4">
          {options.map((o, i) => (
            <OptionRow key={o.value} label={o.label} hint={o.hint} selected={selected(o.value)} onClick={() => pick(o.value)} delay={0.05 + i * 0.04} square={multi} />
          ))}
        </div>
        {note && <p className="pb-4 text-center text-[12px] text-white/35">{note}</p>}
      </div>
    </FlowScreen>
  );
}

/** Age on a wheel. */
export function AgeStep({ value, onChange, onBack, onNext }: { value: number; onChange: (v: number) => void; onBack: () => void; onNext: () => void }) {
  return (
    <FlowScreen section="Sobre você" onBack={onBack} scroll={false} footer={<GlowButton onClick={onNext}>Continuar</GlowButton>}>
      <Heading light="Qual" bold="sua idade?" className="pt-6" />
      <div className="mt-6">
        <NumberWheel value={value} min={16} max={85} onChange={onChange} unit="anos" />
      </div>
    </FlowScreen>
  );
}

const money = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

/** An amount on the ruler (income, spending, goal). */
export function AmountStep({ section, light, bold, sub, value, onChange, min, max, step, labelEvery, hint, onBack, onNext }: Base & {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  labelEvery?: number;
  hint?: ReactNode;
}) {
  return (
    <FlowScreen section={section} onBack={onBack} scroll={false} footer={<GlowButton onClick={onNext}>Continuar</GlowButton>}>
      <div className="flex h-full flex-col justify-center pb-10">
        <Heading light={light} bold={bold} sub={sub} />
        <div className="mt-12">
          <ValueRuler value={value} min={min} max={max} step={step} labelEvery={labelEvery} onChange={onChange} format={money} hint={hint} />
        </div>
      </div>
    </FlowScreen>
  );
}

/** Months on the ruler. */
export function MonthsStep({ value, onChange, bold = "quer chegar lá?", onBack, onNext }: { value: number; onChange: (v: number) => void; bold?: string; onBack: () => void; onNext: () => void }) {
  return (
    <FlowScreen section="Seu objetivo" onBack={onBack} scroll={false} footer={<GlowButton onClick={onNext}>Continuar</GlowButton>}>
      <div className="flex h-full flex-col justify-center pb-10">
        <Heading light="Em quanto tempo você" bold={bold} />
        <div className="mt-12">
          <ValueRuler value={value} min={1} max={60} step={1} labelEvery={6} onChange={onChange} format={(v) => String(v)} unit={value === 1 ? "mês" : "meses"} />
        </div>
      </div>
    </FlowScreen>
  );
}

/** Small green/red chip under the spending ruler. */
export function DeltaChip({ income, spending }: { income: number; spending: number }) {
  const diff = income - spending;
  const ok = diff >= 0;
  return (
    <motion.span
      key={ok ? "ok" : "no"}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-full px-3 py-1 text-[12px] font-semibold tabular-nums",
        ok ? "bg-willo-green/15 text-willo-green" : "bg-[#F87171]/15 text-[#F87171]",
      )}
    >
      {ok ? `Sobram ${money(diff)} por mês` : `Faltam ${money(-diff)} por mês`}
    </motion.span>
  );
}
