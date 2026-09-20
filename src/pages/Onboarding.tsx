import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import AuthPanel from "@/components/auth/AuthPanel";
import { NameStep, ConsentStep, EvolutionStep, HowItWorksStep } from "@/components/onboarding-flow/IntroSteps";
import { AgeStep, AmountStep, ChoiceStep, DeltaChip, MonthsStep } from "@/components/onboarding-flow/QuestionSteps";
import {
  CalculatingStep,
  CategoriesStep,
  CommitmentStep,
  InsightStep,
  NotificationStep,
  ScanDemoStep,
} from "@/components/onboarding-flow/ShowcaseSteps";
import ResultStep from "@/components/onboarding-flow/ResultStep";
import Paywall from "@/components/onboarding-flow/Paywall";
import { BILLING_ENABLED } from "@/lib/billing";
import {
  INITIAL_ANSWERS, PURPOSE_LABEL, brl0, buildPlan, defaultTarget, purposeOf, targetCopy,
  type DebtAnswer, type GoalAnswer, type OnboardingAnswers, type PurposeAnswer, type WorkAnswer,
} from "@/lib/onboardingPlan";
import type { CreditCardAnswer, EmergencyAnswer, EndOfMonthAnswer } from "@/lib/onboardingScore";
import { clearOnboardingProgress, readOnboardingProgress, saveOnboardingProgress } from "@/lib/onboardingProgress";

const STEPS = [
  "name", "consent", "evolution", "how",
  "goal", "age", "work", "income", "spending",
  "endOfMonth", "creditCard", "debts", "emergency",
  "purpose", "target", "months",
  "categories", "insight", "scan", "leaks",
  "commitment", "notifications",
  "calculating", "result", "signup",
] as const;
type Step = (typeof STEPS)[number];

const LEAKS = [
  { value: "delivery", label: "Delivery e restaurantes" },
  { value: "online", label: "Compras online" },
  { value: "mercado", label: "Mercado" },
  { value: "transporte", label: "Uber e transporte" },
  { value: "assinaturas", label: "Assinaturas" },
  { value: "lazer", label: "Lazer e saídas" },
];

/**
 * The pre-signup onboarding, run as an analysis of the person's financial
 * profile: who they are, how their money behaves today and what they want
 * it for — then the analysis itself with a suggested plan, the Willo Pro
 * paywall and, last, the account.
 */
const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  // Answered everything before on this device: back straight to the result
  const [saved] = useState(readOnboardingProgress);
  const [index, setIndex] = useState(() => {
    if (saved) return STEPS.indexOf("result");
    // Dev only: /onboarding?step=result jumps straight to a screen
    if (!import.meta.env.DEV) return 0;
    const i = STEPS.indexOf(new URLSearchParams(window.location.search).get("step") as Step);
    return Math.max(i, 0);
  });
  const [dir, setDir] = useState(1);
  const [a, setA] = useState<OnboardingAnswers>(() => (saved ? { ...INITIAL_ANSWERS, ...saved.answers } : INITIAL_ANSWERS));
  const [paywall, setPaywall] = useState(false);
  const plan = useMemo(() => buildPlan(a), [a]);

  // Answers as of right now, for the choice steps that advance on a timer
  const latest = useRef(a);
  latest.current = a;

  const step: Step = STEPS[index];
  const set = <K extends keyof OnboardingAnswers>(key: K) => (v: OnboardingAnswers[K]) => setA((prev) => ({ ...prev, [key]: v }));
  // Getting out of debt already says what the money is for
  const skipped = (st: Step) => st === "purpose" && latest.current.goal === "dividas";
  const move = (from: number, delta: 1 | -1) => {
    let i = from + delta;
    while (i > 0 && i < STEPS.length - 1 && skipped(STEPS[i])) i += delta;
    return Math.min(Math.max(i, 0), STEPS.length - 1);
  };
  const go = (to: Step) => {
    const i = STEPS.indexOf(to);
    setDir(i >= index ? 1 : -1);
    setIndex(i);
  };
  const next = () => { setDir(1); setIndex((i) => move(i, 1)); };
  const back = () => {
    if (index === 0) navigate("/welcome");
    else { setDir(-1); setIndex((i) => move(i, -1)); }
  };

  // From the result on, the answers are kept: reopening the app comes back here
  const reachedResult = index >= STEPS.indexOf("result");
  useEffect(() => {
    if (reachedResult) saveOnboardingProgress({ answers: a, completedAt: saved?.completedAt ?? new Date().toISOString() });
  }, [reachedResult, a, saved]);

  useEffect(() => {
    if (user) clearOnboardingProgress();
  }, [user]);

  if (!loading && user) return <Navigate to="/" replace />;

  const purpose = purposeOf(a);
  const copy = targetCopy(purpose);
  const name = a.name.trim().split(/\s+/)[0] ?? "";
  const nav = { onBack: back, onNext: next };

  const screen = (() => {
    switch (step) {
      case "name": return <NameStep value={a.name} onChange={set("name")} {...nav} />;
      case "consent": return <ConsentStep name={name} {...nav} />;
      case "evolution": return <EvolutionStep name={name} {...nav} />;
      case "how": return <HowItWorksStep {...nav} />;
      case "goal":
        return (
          <ChoiceStep<GoalAnswer>
            section="Seu objetivo" light="Qual é o seu" bold="maior objetivo agora?"
            value={a.goal}
            onChange={(v) => setA((prev) => ({ ...prev, goal: v as GoalAnswer, ...(v === "dividas" ? { target: defaultTarget("dividas", prev.spending) } : {}) }))}
            {...nav}
            options={[
              { value: "juntar", label: "Juntar dinheiro" },
              { value: "dividas", label: "Sair das dívidas" },
              { value: "organizar", label: "Organizar os gastos" },
              { value: "investir", label: "Começar a investir" },
            ]}
          />
        );
      case "age": return <AgeStep value={a.age} onChange={set("age")} {...nav} />;
      case "work":
        return (
          <ChoiceStep<WorkAnswer>
            section="Sobre você" light="Como você" bold="ganha dinheiro hoje?"
            value={a.work} onChange={(v) => set("work")(v as WorkAnswer)} {...nav}
            options={[
              { value: "clt", label: "Carteira assinada (CLT)" },
              { value: "autonomo", label: "Autônomo ou freelancer" },
              { value: "empresario", label: "Tenho empresa" },
              { value: "estudante", label: "Estudante" },
              { value: "aposentado", label: "Aposentado" },
            ]}
          />
        );
      case "income":
        return (
          <AmountStep
            section="Sua renda" light="Quanto entra" bold="por mês?" sub="Some tudo o que você recebe, já líquido."
            value={a.income} onChange={set("income")} min={500} max={40000} step={100} labelEvery={10} {...nav}
          />
        );
      case "spending":
        return (
          <AmountStep
            section="Seus gastos" light="E quanto sai" bold="por mês?" sub="Um chute está ótimo. O app acerta isso pra você depois."
            value={a.spending} onChange={set("spending")} min={300} max={40000} step={100} labelEvery={10}
            hint={<DeltaChip income={a.income} spending={a.spending} />} {...nav}
          />
        );
      case "endOfMonth":
        return (
          <ChoiceStep<EndOfMonthAnswer>
            section="Seu mês" light="Quando o mês acaba," bold="como fica sua conta?"
            value={a.endOfMonth} onChange={(v) => set("endOfMonth")(v as EndOfMonthAnswer)} {...nav}
            options={[
              { value: "sobra", label: "Sobra dinheiro" },
              { value: "zero-a-zero", label: "Fecha no zero a zero" },
              { value: "as-vezes-falta", label: "Às vezes falta" },
              { value: "vermelho", label: "Quase sempre no vermelho" },
            ]}
          />
        );
      case "creditCard":
        return (
          <ChoiceStep<CreditCardAnswer>
            section="Seu cartão" light="E o cartão de crédito," bold="como é com ele?"
            value={a.creditCard} onChange={(v) => set("creditCard")(v as CreditCardAnswer)} {...nav}
            options={[
              { value: "pago-acompanho", label: "Pago tudo e acompanho" },
              { value: "pago-nao-acompanho", label: "Pago tudo, mas não acompanho" },
              { value: "parcelo-as-vezes", label: "Às vezes parcelo a fatura" },
              { value: "dificuldade", label: "Tenho dificuldade pra pagar" },
            ]}
          />
        );
      case "debts":
        return (
          <ChoiceStep<DebtAnswer>
            section="Suas dívidas" light="Você tem" bold="dívidas hoje?"
            value={a.debts} onChange={(v) => set("debts")(v as DebtAnswer)} {...nav}
            options={[
              { value: "nao", label: "Não tenho" },
              { value: "controle", label: "Tenho, mas estão sob controle" },
              { value: "dificil", label: "Tenho e está difícil" },
            ]}
          />
        );
      case "emergency":
        return (
          <ChoiceStep<EmergencyAnswer>
            section="Imprevistos" light="Se aparecesse um gasto de R$ 1.000 amanhã," bold="o que você faria?"
            value={a.emergency} onChange={(v) => set("emergency")(v as EmergencyAnswer)} {...nav}
            options={[
              { value: "reserva", label: "Usaria minha reserva" },
              { value: "dinheiro-do-mes", label: "Tiraria do dinheiro do mês" },
              { value: "parcelaria", label: "Parcelaria no cartão" },
              { value: "nao-conseguiria", label: "Não conseguiria pagar" },
            ]}
          />
        );
      case "purpose":
        return (
          <ChoiceStep<PurposeAnswer>
            section="Seu objetivo" light="Pra que você quer" bold="juntar dinheiro?" sub="A análise muda conforme o seu objetivo."
            value={a.purpose}
            onChange={(v) => setA((prev) => ({ ...prev, purpose: v as PurposeAnswer, target: defaultTarget(v as PurposeAnswer, prev.spending) }))}
            {...nav}
            options={(() => {
              const order: PurposeAnswer[] = ["reserva", "viagem", "casa", "carro", "estudos", "futuro", "dividas", "outro"];
              // Someone with debts sees paying them off first
              const list = a.debts && a.debts !== "nao" ? ["dividas" as PurposeAnswer, ...order.filter((p) => p !== "dividas")] : order;
              return list.map((p) => ({
                value: p,
                label: PURPOSE_LABEL[p],
                hint: p === "dividas" && a.debts === "dificil" ? "Recomendado pra você" : p === "reserva" && a.debts !== "dificil" && (a.emergency === "parcelaria" || a.emergency === "nao-conseguiria") ? "Recomendado pra você" : undefined,
              }));
            })()}
          />
        );
      case "target":
        return (
          <AmountStep
            section="Seu objetivo"
            light={copy.light}
            bold={copy.bold}
            sub={purpose === "reserva" ? `O ideal é ter 6 meses dos seus gastos: ${brl0(plan.reserve)}.` : undefined}
            value={a.target} onChange={set("target")} min={500} max={200000} step={500} labelEvery={10} {...nav}
          />
        );
      case "months": return <MonthsStep value={a.months} onChange={set("months")} bold={copy.monthsBold} {...nav} />;
      case "categories": return <CategoriesStep {...nav} />;
      case "insight": return <InsightStep surplus={plan.surplus} monthlySave={plan.monthlySave} cut={plan.cut} {...nav} />;
      case "scan": return <ScanDemoStep {...nav} />;
      case "leaks":
        return (
          <ChoiceStep<string>
            multi section="Seus hábitos" light="Onde você mais" bold="gasta sem perceber?" sub="Escolha quantos quiser."
            value={a.spendDays} onChange={(v) => set("spendDays")(v as string[])} {...nav}
            options={LEAKS}
          />
        );
      case "commitment": return <CommitmentStep {...nav} />;
      case "notifications": return <NotificationStep {...nav} />;
      case "calculating": return <CalculatingStep onDone={next} />;
      case "result": return <ResultStep answers={a} plan={plan} onNext={() => (BILLING_ENABLED ? setPaywall(true) : go("signup"))} />;
      case "signup":
        return (
          <AuthPanel
            mode="signup"
            onBack={() => { go("result"); if (BILLING_ENABLED) setPaywall(true); }}
            pendingProfile={{
              displayName: a.name.trim() || undefined,
              initialScore: plan.score.score,
              initialScoreLabel: plan.score.label,
            }}
          />
        );
    }
  })();

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-black text-white" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="relative h-full overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          className="absolute inset-0"
          variants={{
            enter: (d: number) => ({ x: d > 0 ? "30%" : "-30%", opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d > 0 ? "-30%" : "30%", opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          {screen}
        </motion.div>
      </AnimatePresence>
      </div>

      {/* The paywall slides up over the result */}
      <AnimatePresence>
        {paywall && BILLING_ENABLED && (
          <motion.div
            key="paywall"
            className="absolute inset-0 z-50"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 240, damping: 32 }}
          >
            <Paywall
              name={a.name}
              onClose={() => setPaywall(false)}
              onRestore={() => navigate("/auth", { state: { mode: "login" } })}
              onPurchase={() => { setPaywall(false); go("signup"); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
