import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, User, Wallet, Receipt, CreditCard, Repeat, X, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Profile } from "@/hooks/useProfile";

interface Props {
  profile: Profile;
  onUpdateName: (name: string) => Promise<void>;
  onGoToAccounts: () => void;
  onCreateTransaction: () => void;
  onGoToCard: () => void;
  onCreateFixedExpense: () => void;
}

const RING_C = 2 * Math.PI * 17;

const OnboardingCard = ({ profile, onUpdateName, onGoToAccounts, onCreateTransaction, onGoToCard, onCreateFixedExpense }: Props) => {
  const [showNameModal, setShowNameModal] = useState(false);
  const [name, setName] = useState(profile.display_name ?? "");
  const [saving, setSaving] = useState(false);

  const steps = [
    { id: "name", label: "Adicionar nome", icon: User, done: profile.has_completed_profile, action: () => setShowNameModal(true) },
    { id: "account", label: "Criar conta", icon: Wallet, done: profile.has_account, action: onGoToAccounts },
    { id: "transaction", label: "Adicionar transação", icon: Receipt, done: profile.has_transactions, action: onCreateTransaction },
    { id: "card", label: "Adicionar cartão", icon: CreditCard, done: profile.has_card, action: onGoToCard },
    { id: "fixed-expenses", label: "Cadastrar gastos fixos", icon: Repeat, done: profile.has_fixed_expenses, action: onCreateFixedExpense },
  ];

  const sortedSteps = [...steps].sort((a, b) => {
    if (a.done && !b.done) return 1;
    if (!a.done && b.done) return -1;
    return 0;
  });

  const completedCount = sortedSteps.filter((s) => s.done).length;
  const allDone = completedCount === sortedSteps.length;
  const nextStep = steps.find((s) => !s.done);

  if (allDone) return null;

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onUpdateName(name.trim());
    setSaving(false);
    setShowNameModal(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[26px] bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.08] p-4"
      >
        {/* Header: progress ring + title */}
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 shrink-0">
            <svg viewBox="0 0 40 40" className="w-11 h-11 -rotate-90">
              <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
              <motion.circle
                cx="20" cy="20" r="17" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${RING_C}` }}
                animate={{ strokeDasharray: `${(completedCount / sortedSteps.length) * RING_C} ${RING_C}` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white tabular-nums">
              {completedCount}/{sortedSteps.length}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-white leading-tight">Complete sua conta</h3>
            <p className="text-[12px] text-white/62 leading-tight mt-0.5">
              Faltam {sortedSteps.length - completedCount} {sortedSteps.length - completedCount === 1 ? "etapa" : "etapas"} para aproveitar tudo
            </p>
          </div>
        </div>

        {/* Next step CTA */}
        {nextStep && (
          <button
            onClick={nextStep.action}
            className="mt-4 w-full flex items-center gap-3 rounded-full bg-white text-[#0B0B0B] p-1.5 pr-4 active:scale-[0.98] transition-transform shadow-[0_10px_30px_-14px_rgba(255,255,255,0.35)]"
          >
            <span className="w-9 h-9 rounded-full bg-[#0B0B0B] text-white flex items-center justify-center shrink-0">
              <nextStep.icon className="w-4 h-4" />
            </span>
            <span className="flex-1 text-left text-[14px] font-bold">{nextStep.label}</span>
            <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
          </button>
        )}

        {/* Remaining steps */}
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {sortedSteps.filter((s) => s.id !== nextStep?.id).map((s) => {
            const StepIcon = s.icon;
            return (
              <button
                key={s.id}
                onClick={s.done ? undefined : s.action}
                disabled={s.done}
                className={cn(
                  "flex items-center gap-2 shrink-0 rounded-full border pl-1 pr-3 py-1 transition-colors",
                  s.done
                    ? "border-white/[0.05] bg-transparent cursor-default"
                    : "border-white/[0.08] bg-white/[0.05] hover:bg-white/[0.08]"
                )}
              >
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  s.done ? "bg-willo-green/15 text-willo-green" : "bg-white/[0.08] text-white/82"
                )}>
                  {s.done ? <Check className="w-3 h-3" strokeWidth={3} /> : <StepIcon className="w-3 h-3" />}
                </span>
                <span className={cn("text-[12px] font-medium whitespace-nowrap", s.done ? "text-white/50 line-through" : "text-white/80")}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Name modal */}
      <AnimatePresence>
        {showNameModal && !profile.has_completed_profile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => setShowNameModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-card border border-border/20 shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Seu nome</h3>
                </div>
                <button onClick={() => setShowNameModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Como você gostaria de ser chamado?</p>
              <Input
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background border-border/30 h-11 text-sm"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && name.trim() && handleSaveName()}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowNameModal(false)}
                  className="flex-1 h-10 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveName}
                  disabled={!name.trim() || saving}
                  className="flex-1 h-10 text-xs font-semibold"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OnboardingCard;
