import { useState } from "react";
import { motion } from "framer-motion";
import { Landmark } from "lucide-react";
import AccountCreateSheet from "@/components/wallet/AccountCreateSheet";
import SetupIntro from "./SetupIntro";

interface Props {
  onDone: () => void;
  onSkip: () => void;
}

/** First step: the same "Nova conta" sheet used in Carteira, so it looks and works the same everywhere. */
const SetupAccountStep = ({ onDone, onSkip }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex min-h-0 flex-1 flex-col">
      <SetupIntro
        icon={Landmark}
        title="Vamos criar sua primeira conta"
        text="É onde seu saldo fica. Pode ser o banco que você mais usa, ou o dinheiro na carteira."
        bullets={["Saldo sempre atualizado", "Cada gasto sai da conta certa", "Você pode criar outras depois"]}
        action="Criar minha conta"
        onAction={() => setOpen(true)}
        onSkip={onSkip}
      />
      <AccountCreateSheet open={open} onClose={() => setOpen(false)} onCreated={onDone} />
    </motion.div>
  );
};

export default SetupAccountStep;
