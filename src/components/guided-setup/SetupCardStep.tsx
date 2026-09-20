import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard } from "lucide-react";
import CardCreateSheet from "@/components/wallet/CardCreateSheet";
import SetupIntro from "./SetupIntro";

interface Props {
  onDone: () => void;
  onSkip: () => void;
}

/** Second step: the same "Novo cartão" sheet used in Carteira. */
const SetupCardStep = ({ onDone, onSkip }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex min-h-0 flex-1 flex-col">
      <SetupIntro
        icon={CreditCard}
        title="Agora o cartão de crédito"
        text="Com o fechamento e o vencimento, o Willo monta cada fatura e avisa antes de vencer."
        bullets={["Fatura montada sozinha", "Parcelas acompanhadas até o fim", "Aviso antes de pagar juros"]}
        action="Cadastrar meu cartão"
        onAction={() => setOpen(true)}
        onSkip={onSkip}
      />
      <CardCreateSheet open={open} onClose={() => setOpen(false)} onCreated={onDone} />
    </motion.div>
  );
};

export default SetupCardStep;
