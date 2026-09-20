import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/shared/Logo";
import SetupAccountStep from "@/components/guided-setup/SetupAccountStep";
import SetupCardStep from "@/components/guided-setup/SetupCardStep";
import SetupFixedExpenseStep from "@/components/guided-setup/SetupFixedExpenseStep";
import SetupFixedIncomeStep from "@/components/guided-setup/SetupFixedIncomeStep";
import SetupDoneStep from "@/components/guided-setup/SetupDoneStep";

const TOTAL_STEPS = 5;

/**
 * Guided real-data setup — conta -> cartão -> gasto fixo -> receita fixa ->
 * concluído.
 * Reached from WelcomeToAppModal's "Configurar agora" button (and can be
 * revisited any time). Every step is skippable; nothing here is required to
 * use the app — it just gets someone's real data in faster than hunting for
 * "Nova conta" buttons across /gestao on their own.
 */
const GuidedSetup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const finish = () => navigate("/");

  const goBack = () => {
    if (step === 0) navigate("/");
    else setStep((s) => s - 1);
  };

  return (
    <div
      className="h-[100dvh] willo-bg flex flex-col relative overflow-hidden"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button
          type="button"
          onClick={goBack}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={false}
            animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <div className="shrink-0">
          <Logo size="sm" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="flex-1 flex flex-col min-h-0"
        >
          {step === 0 && <SetupAccountStep onDone={goNext} onSkip={goNext} />}
          {step === 1 && <SetupCardStep onDone={goNext} onSkip={goNext} />}
          {step === 2 && <SetupFixedExpenseStep onDone={goNext} onSkip={goNext} />}
          {step === 3 && <SetupFixedIncomeStep onDone={goNext} onSkip={goNext} />}
          {step === 4 && <SetupDoneStep onDone={finish} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default GuidedSetup;
