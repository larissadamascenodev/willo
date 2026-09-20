import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Wallet, Receipt, ArrowRight, ChevronRight, Check, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { createAccount, createTransaction } from "@/services/transactionService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { currencySymbol } from "@/lib/currency";
interface OnboardingFlowProps {
  onComplete: () => void;
  onRefetch: () => Promise<void>;
}

const ACCOUNT_TYPES = [
  { value: "checking", label: "Conta Corrente", icon: "🏦" },
  { value: "savings", label: "Poupança", icon: "🐷" },
  { value: "cash", label: "Carteira/Dinheiro", icon: "💵" },
  { value: "investment", label: "Investimento", icon: "📈" },
];

const EXPENSE_CATEGORIES = [
  "Alimentação", "Transporte", "Moradia", "Saúde", "Educação",
  "Lazer", "Assinaturas", "Vestuário", "Supermercado",
];

const OnboardingFlow = ({ onComplete, onRefetch }: OnboardingFlowProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState(0); // 0=name, 1=account, 2=transaction
  const [saving, setSaving] = useState(false);

  // Step 0 - Name
  const [name, setName] = useState("");

  // Step 1 - Account
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [accountBalance, setAccountBalance] = useState("");

  // Step 2 - Transaction
  const [txName, setTxName] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("Alimentação");
  const [txType, setTxType] = useState<"despesa" | "receita">("despesa");

  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);

  const handleSaveName = useCallback(async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      await supabase
        .from("profiles" as any)
        .update({ display_name: name.trim(), has_completed_profile: true } as any)
        .eq("id", user.id);
      setStep(1);
    } catch {
      toast.error("Erro ao salvar nome");
    } finally {
      setSaving(false);
    }
  }, [user, name]);

  const handleCreateAccount = useCallback(async () => {
    if (!user || !accountName.trim()) return;
    setSaving(true);
    try {
      const result = await createAccount(user.id, {
        name: accountName.trim(),
        type: accountType as any,
        initial_balance: parseFloat(accountBalance) || 0,
      });
      setCreatedAccountId(result.id);
      toast.success("Conta criada! 🎉");
      setStep(2);
    } catch {
      toast.error("Erro ao criar conta");
    } finally {
      setSaving(false);
    }
  }, [user, accountName, accountType, accountBalance]);

  const handleCreateTransaction = useCallback(async () => {
    if (!user || !txName.trim() || !txAmount) return;
    setSaving(true);
    try {
      await createTransaction(
        {
          name: txName.trim(),
          type: txType,
          amount: parseFloat(txAmount) || 0,
          category: txCategory,
          date: new Date().toISOString().split("T")[0],
          status: "pago",
          account_id: createdAccountId,
          payment_method: "conta",
          recurrence_type: "unica",
        },
        user.id
      );
      toast.success("Transação criada! 🎉");
      await onRefetch();
      onComplete();
    } catch {
      toast.error("Erro ao criar transação");
    } finally {
      setSaving(false);
    }
  }, [user, txName, txAmount, txCategory, txType, createdAccountId, onRefetch, onComplete]);

  const handleSkipAccount = useCallback(() => {
    setStep(2);
  }, []);

  const handleSkipTransaction = useCallback(async () => {
    await onRefetch();
    onComplete();
  }, [onRefetch, onComplete]);

  const stepVariants = {
    enter: { opacity: 0, x: 60 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -60 },
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-6">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/50" : "w-4 bg-muted-foreground/20"
            )}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 0: Name */}
        {step === 0 && (
          <motion.div
            key="step-name"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm space-y-6 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Qual é o seu nome?</h2>
              <p className="text-sm text-muted-foreground mt-1">Vamos personalizar sua experiência</p>
            </div>
            <Input
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-center text-base h-12 bg-card border-border/30"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && name.trim() && handleSaveName()}
            />
            <Button
              onClick={handleSaveName}
              disabled={!name.trim() || saving}
              className="w-full h-11 text-sm font-semibold gap-2"
            >
              {saving ? "Salvando..." : "Continuar"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}

        {/* Step 1: Account */}
        {step === 1 && (
          <motion.div
            key="step-account"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm space-y-5 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Adicione sua conta</h2>
              <p className="text-sm text-muted-foreground mt-1">Para controlar seus gastos e receitas</p>
            </div>
            <div className="space-y-3 text-left">
              <Input
                placeholder="Nome da conta (ex: Nubank)"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="h-11 bg-card border-border/30 text-sm"
                autoFocus
              />
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger className="h-11 bg-card border-border/30 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={`Saldo inicial (${currencySymbol()})`}
                type="number"
                inputMode="decimal"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
                className="h-11 bg-card border-border/30 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Button
                onClick={handleCreateAccount}
                disabled={!accountName.trim() || saving}
                className="w-full h-11 text-sm font-semibold gap-2"
              >
                {saving ? "Criando..." : "Criar conta"}
                <ArrowRight className="w-4 h-4" />
              </Button>
              <button
                onClick={handleSkipAccount}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Pular esta etapa
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Transaction */}
        {step === 2 && (
          <motion.div
            key="step-transaction"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm space-y-5 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
              <Receipt className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Primeira transação</h2>
              <p className="text-sm text-muted-foreground mt-1">Registre seu primeiro lançamento</p>
            </div>

            {/* Type selector */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setTxType("despesa")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                  txType === "despesa" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-muted/10 text-muted-foreground border border-border/20"
                )}
              >
                Despesa
              </button>
              <button
                onClick={() => setTxType("receita")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                  txType === "receita" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-muted/10 text-muted-foreground border border-border/20"
                )}
              >
                Receita
              </button>
            </div>

            <div className="space-y-3 text-left">
              <Input
                placeholder="Descrição (ex: Almoço)"
                value={txName}
                onChange={(e) => setTxName(e.target.value)}
                className="h-11 bg-card border-border/30 text-sm"
                autoFocus
              />
              <Input
                placeholder={`Valor (${currencySymbol()})`}
                type="number"
                inputMode="decimal"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                className="h-11 bg-card border-border/30 text-sm"
              />
              <Select value={txCategory} onValueChange={setTxCategory}>
                <SelectTrigger className="h-11 bg-card border-border/30 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Button
                onClick={handleCreateTransaction}
                disabled={!txName.trim() || !txAmount || saving}
                className="w-full h-11 text-sm font-semibold gap-2"
              >
                {saving ? "Salvando..." : "Adicionar transação"}
                <Check className="w-4 h-4" />
              </Button>
              <button
                onClick={handleSkipTransaction}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Pular e ir para o app
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom branding */}
      <div className="absolute bottom-8 flex items-center gap-1.5 text-muted-foreground/40">
        <Sparkles className="w-3 h-3" />
        <span className="text-[10px]">Willo</span>
      </div>
    </div>
  );
};

export default OnboardingFlow;
