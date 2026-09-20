import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ChevronLeft, ChevronRight, Sparkles, Loader2, TrendingUp,
  Target, AlertTriangle, Zap, Milestone, Scissors, Brain, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { currencySymbol, getCurrency } from "@/lib/currency";
interface FinancialPlan {
  monthly_contribution: number;
  estimated_months: number;
  saving_capacity_explanation: string;
  expenses_to_cut: Array<{
    category: string;
    current_monthly: number;
    suggested_reduction: number;
    tip: string;
  }>;
  milestones: Array<{
    month: number;
    amount: number;
    label: string;
  }>;
  risks: string[];
  accelerate_options: string[];
  motivational_message: string;
}

interface AIFinancialWizardModalProps {
  open: boolean;
  onClose: () => void;
  type: "investimento" | "meta";
  onConfirm: (plan: FinancialPlan, objective: string) => void;
}

const OBJECTIVES = [
  { id: "carro", label: "Comprar um carro", emoji: "🚗" },
  { id: "viagem", label: "Fazer uma viagem", emoji: "✈️" },
  { id: "apartamento", label: "Comprar um apartamento", emoji: "🏠" },
  { id: "patrimonio", label: "Crescer o patrimônio", emoji: "📈" },
  { id: "reserva", label: "Reserva de emergência", emoji: "🛡️" },
  { id: "custom", label: "Outro objetivo", emoji: "✨" },
];

const TARGET_CHIPS = [
  { label: "5k", value: 5000 },
  { label: "10k", value: 10000 },
  { label: "25k", value: 25000 },
  { label: "50k", value: 50000 },
  { label: "100k", value: 100000 },
  { label: "250k", value: 250000 },
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const AIFinancialWizardModal = ({ open, onClose, type, onConfirm }: AIFinancialWizardModalProps) => {
  const [step, setStep] = useState(0);
  const [selectedObjective, setSelectedObjective] = useState<string | null>(null);
  const [customObjective, setCustomObjective] = useState("");
  const [targetAmount, setTargetAmount] = useState(0);
  const [targetInput, setTargetInput] = useState("0");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep(0);
    setSelectedObjective(null);
    setCustomObjective("");
    setTargetAmount(0);
    setTargetInput("0");
    setLoading(false);
    setPlan(null);
    setError(null);
  }, []);

  const handleClose = () => {
    onClose();
    setTimeout(reset, 300);
  };

  const isCustom = selectedObjective === "custom";
  const objectiveText = isCustom
    ? customObjective.trim()
    : OBJECTIVES.find((o) => o.id === selectedObjective)?.label ?? "";

  const canProceedStep0 = isCustom ? customObjective.trim().length > 0 : !!selectedObjective;

  const handleTargetChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const num = parseInt(digits || "0", 10);
    setTargetAmount(num);
    setTargetInput(num.toLocaleString("pt-BR"));
  };

  const analyzeWithAI = async () => {
    setStep(2);
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-financial-plan", {
        body: {
          objective: objectiveText,
          type,
          target_amount: targetAmount > 0 ? targetAmount : null,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.plan) throw new Error("Resposta inválida da IA");

      setPlan(data.plan);
      setStep(3);
    } catch (err: any) {
      console.error("AI analysis error:", err);
      setError(err.message || "Erro ao analisar seus dados");
      setStep(2); // stay on loading step but show error
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (plan) {
      onConfirm(plan, objectiveText);
      handleClose();
    }
  };

  const typeLabel = type === "investimento" ? "Investimento" : "Meta";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl bg-card border border-border/15 shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  {step === 0 ? `${typeLabel} com IA` : step === 1 ? "Valor Alvo" : step === 2 ? "Analisando" : "Seu Plano"}
                </span>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-muted/15 transition-colors">
                <X className="w-4 h-4 text-muted-foreground/50" />
              </button>
            </div>

            {/* Steps indicator */}
            <div className="flex gap-1.5 px-5 pb-3">
              {[0, 1, 2, 3].map((s) => (
                <div
                  key={s}
                  className="h-1 rounded-full flex-1 transition-all duration-500"
                  style={{
                    background: s <= step ? "hsl(150 100% 45%)" : "hsl(var(--muted) / 0.15)",
                  }}
                />
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
              <AnimatePresence mode="wait">
                {/* STEP 0 — Objective */}
                {step === 0 && (
                  <motion.div
                    key="step0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    <div>
                      <h2 className="text-lg font-bold text-foreground">
                        Qual é o seu objetivo?
                      </h2>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        A IA vai analisar seus dados reais e criar um plano personalizado
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {OBJECTIVES.map((obj) => {
                        const isSelected = selectedObjective === obj.id;
                        return (
                          <motion.button
                            key={obj.id}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setSelectedObjective(obj.id)}
                            className={`relative rounded-2xl overflow-hidden text-left transition-all p-4 border ${
                              isSelected
                                ? "border-primary/40 bg-primary/10"
                                : "border-border/15 bg-muted/5 hover:bg-muted/10"
                            } ${obj.id === "custom" ? "col-span-2" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{obj.emoji}</span>
                              <p className="text-sm font-bold text-foreground">{obj.label}</p>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                    <AnimatePresence>
                      {isCustom && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <input
                            value={customObjective}
                            onChange={(e) => setCustomObjective(e.target.value)}
                            placeholder="Descreva seu objetivo..."
                            className="w-full bg-muted/10 border border-border/15 rounded-xl h-12 px-4 text-sm text-foreground outline-none focus:border-primary/30"
                            autoFocus
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* STEP 1 — Target amount (optional) */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-5"
                  >
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Tem um valor em mente?</h2>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        Opcional — a IA pode sugerir um valor ideal se preferir
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/15 bg-muted/5 p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-muted-foreground/50">{currencySymbol()}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={targetInput}
                          onChange={(e) => handleTargetChange(e.target.value)}
                          className="flex-1 bg-transparent text-2xl font-bold text-foreground outline-none tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {TARGET_CHIPS.map((chip) => (
                        <motion.button
                          key={chip.value}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setTargetAmount(chip.value);
                            setTargetInput(chip.value.toLocaleString("pt-BR"));
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                            targetAmount === chip.value
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-muted/10 text-muted-foreground/50 border border-border/10 hover:bg-muted/15"
                          }`}
                        >
                          {chip.label}
                        </motion.button>
                      ))}
                    </div>

                    <p className="text-[10px] text-muted-foreground/40 text-center">
                      Deixe 0 para a IA sugerir o valor ideal
                    </p>
                  </motion.div>
                )}

                {/* STEP 2 — Loading / Error */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-12 flex flex-col items-center justify-center text-center space-y-6"
                  >
                    {loading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        >
                          <Brain className="w-12 h-12 text-primary" />
                        </motion.div>
                        <div>
                          <h2 className="text-lg font-bold text-foreground">Analisando seus dados...</h2>
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            Verificando transações, saldo e padrões de gastos
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
                              className="w-2 h-2 rounded-full bg-primary"
                            />
                          ))}
                        </div>
                      </>
                    ) : error ? (
                      <>
                        <AlertTriangle className="w-12 h-12 text-destructive/60" />
                        <div>
                          <h2 className="text-base font-bold text-foreground">Não foi possível analisar</h2>
                          <p className="text-xs text-muted-foreground/60 mt-1">{error}</p>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={analyzeWithAI}
                          className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary/15 text-primary border border-primary/20"
                        >
                          Tentar novamente
                        </motion.button>
                      </>
                    ) : null}
                  </motion.div>
                )}

                {/* STEP 3 — AI Plan Results */}
                {step === 3 && plan && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4 pb-2"
                  >
                    {/* Hero */}
                    <div className="text-center space-y-2 py-2">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.1 }}
                      >
                        <Brain className="w-10 h-10 text-primary mx-auto" />
                      </motion.div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/70">
                        Plano Personalizado
                      </p>
                      <p className="text-sm text-muted-foreground/60">{plan.motivational_message}</p>
                    </div>

                    {/* Key metrics */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="rounded-xl border border-primary/15 bg-primary/5 p-3.5 text-center"
                      >
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-primary/60">Aporte Ideal/Mês</p>
                        <p className="text-lg font-bold text-primary tabular-nums mt-0.5">{fmt(plan.monthly_contribution)}</p>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-xl border border-border/15 bg-muted/5 p-3.5 text-center"
                      >
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40">Prazo Estimado</p>
                        <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">
                          {plan.estimated_months} {plan.estimated_months === 1 ? "mês" : "meses"}
                        </p>
                      </motion.div>
                    </div>

                    {/* Saving capacity */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="rounded-xl border border-border/15 bg-muted/5 p-3.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">Capacidade de Poupança</p>
                          <p className="text-[12px] text-foreground/80 leading-relaxed">{plan.saving_capacity_explanation}</p>
                        </div>
                      </div>
                    </motion.div>

                    {/* Expenses to cut */}
                    {plan.expenses_to_cut.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="rounded-xl border border-border/15 bg-muted/5 p-3.5"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Scissors className="w-4 h-4 text-primary" />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Onde Economizar</p>
                        </div>
                        <div className="space-y-2.5">
                          {plan.expenses_to_cut.map((expense, idx) => (
                            <div key={idx} className="flex items-start gap-2.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="text-[12px] font-semibold text-foreground">{expense.category}</p>
                                  <p className="text-[10px] font-bold text-primary tabular-nums">
                                    -{fmt(expense.suggested_reduction)}
                                  </p>
                                </div>
                                <p className="text-[10px] text-muted-foreground/50">{expense.tip}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Milestones */}
                    {plan.milestones.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="rounded-xl border border-border/15 bg-muted/5 p-3.5"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Milestone className="w-4 h-4 text-primary" />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Marcos no Caminho</p>
                        </div>
                        <div className="space-y-2">
                          {plan.milestones.map((m, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <span className="text-[8px] font-bold text-primary">{m.month}m</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-foreground truncate">{m.label}</p>
                              </div>
                              <p className="text-[10px] font-bold text-muted-foreground/50 tabular-nums shrink-0">{fmt(m.amount)}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Risks & Accelerate */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {plan.risks.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                          className="rounded-xl border border-border/15 bg-muted/5 p-3"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">Riscos</p>
                          </div>
                          <div className="space-y-1.5">
                            {plan.risks.map((risk, idx) => (
                              <p key={idx} className="text-[10px] text-foreground/60 leading-snug">• {risk}</p>
                            ))}
                          </div>
                        </motion.div>
                      )}
                      {plan.accelerate_options.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.45 }}
                          className="rounded-xl border border-border/15 bg-muted/5 p-3"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <Zap className="w-3 h-3 text-primary" />
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">Acelerar</p>
                          </div>
                          <div className="space-y-1.5">
                            {plan.accelerate_options.map((opt, idx) => (
                              <p key={idx} className="text-[10px] text-foreground/60 leading-snug">• {opt}</p>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-5 pt-2 pb-5 sm:pb-5 pb-8 flex items-center gap-3">
              {step > 0 && step !== 2 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStep((s) => s - 1)}
                  className="flex items-center gap-1 px-4 py-3 rounded-xl border border-border/15 text-xs font-bold text-muted-foreground hover:bg-muted/10 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Voltar
                </motion.button>
              )}

              {step === 0 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={!canProceedStep0}
                  onClick={() => setStep(1)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-primary/80 to-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </motion.button>
              )}

              {step === 1 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={analyzeWithAI}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-primary/80 to-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Brain className="w-4 h-4" /> Analisar Meus Dados
                </motion.button>
              )}

              {step === 3 && plan && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleConfirm}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-primary/80 to-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Sparkles className="w-4 h-4" /> Criar {typeLabel}
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIFinancialWizardModal;
