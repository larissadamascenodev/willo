import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onConfigure: () => void;
  onSkip: () => void;
}

/**
 * One-time modal shown the first time someone lands in the app right after
 * finishing the new pre-signup onboarding (quiz -> account -> plans).
 * Invites them into the real account/card/fixed-expenses setup, but never
 * blocks — "Pular por agora" just closes it and they use the app as-is.
 */
const WelcomeToAppModal = ({ open, onConfigure, onSkip }: Props) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center px-6"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 12 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-sm rounded-[28px] bg-[#0B0B0B] p-6 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-display font-extrabold text-[20px] leading-[1.25] text-white tracking-tight">
            Vamos deixar tudo pronto?
          </h2>
          <p className="text-[14px] text-white/70 leading-relaxed mt-2">
            Cadastre sua conta, cartão e gastos fixos pra ter uma visão completa do seu dinheiro.
          </p>
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={onConfigure}
              className="w-full h-14 willo-pill text-base tracking-tight transition-transform duration-150 active:scale-[0.97]"
            >
              Configurar agora
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="w-full text-center text-[14px] text-white/70 transition-colors active:text-white"
            >
              Pular por agora
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default WelcomeToAppModal;
