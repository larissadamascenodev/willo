import { useState } from "react";
import { motion } from "framer-motion";
import { Repeat, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createTransaction } from "@/services/transactionService";
import { useAuth } from "@/contexts/AuthContext";

const CATEGORIES = ["Moradia", "Assinaturas", "Conta de Luz", "Conta de Água", "Internet", "Educação"];

interface Props {
  onDone: () => void;
  onSkip: () => void;
}

const SetupFixedExpenseStep = ({ onDone, onSkip }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !amount || saving) return;
    setSaving(true);
    try {
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      await createTransaction(
        {
          name: name.trim(),
          type: "despesa",
          amount: parseFloat(amount),
          category,
          date,
          status: "pendente",
          payment_method: "conta",
          recurrence_type: "fixa",
        },
        user.id
      );
      toast.success("Gasto fixo cadastrado!");
      onDone();
    } catch {
      toast.error("Erro ao cadastrar gasto fixo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-5">
          <Repeat className="w-6 h-6 text-white" />
        </div>
        <h1 className="font-display font-extrabold text-[24px] leading-[1.2] text-white tracking-tight">
          Cadastre um gasto fixo
        </h1>
        <p className="text-[14px] text-white/55 mt-2">
          Aluguel, assinaturas, contas... o Willo já conta com eles todo mês.
        </p>
      </motion.div>

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mt-7 space-y-3"
      >
        <Input
          placeholder="Nome (ex: Aluguel, Netflix...)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="h-14 bg-[#141414] border-white/[0.08] rounded-2xl text-[15px] text-white placeholder:text-white/40 px-5"
        />
        <Input
          placeholder="Valor mensal"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-14 bg-[#141414] border-white/[0.08] rounded-2xl text-[15px] text-white placeholder:text-white/40 px-5"
        />

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-all",
                category === c
                  ? "bg-white text-[#0B0B0B] border-white"
                  : "bg-[#141414] text-white border-white/[0.08]"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={!name.trim() || !amount || saving}
          className="w-full h-14 willo-pill text-base tracking-tight transition-transform duration-150 active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {saving ? "Cadastrando..." : "Concluir"}
          {!saving && <ArrowRight className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-center text-[14px] text-white/55 transition-colors active:text-white"
        >
          Pular esta etapa
        </button>
      </motion.form>
    </div>
  );
};

export default SetupFixedExpenseStep;
