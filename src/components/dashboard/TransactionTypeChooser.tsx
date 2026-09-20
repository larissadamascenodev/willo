import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowRightLeft } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (type: "receita" | "despesa" | "transferencia") => void;
}

const TransactionTypeChooser = ({ open, onClose, onSelect }: Props) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            className="flex gap-3 p-2"
          >
            {/* Despesa */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect("despesa")}
              className="flex flex-col items-center gap-3 w-28 py-6 rounded-2xl bg-card border border-border/30 shadow-2xl hover:border-destructive/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-destructive/15 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-destructive" />
              </div>
              <span className="text-xs font-bold text-foreground">Despesa</span>
            </motion.button>

            {/* Receita */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect("receita")}
              className="flex flex-col items-center gap-3 w-28 py-6 rounded-2xl bg-card border border-border/30 shadow-2xl hover:border-primary/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-willo-green" />
              </div>
              <span className="text-xs font-bold text-foreground">Receita</span>
            </motion.button>

            {/* Transferência */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect("transferencia")}
              className="flex flex-col items-center gap-3 w-28 py-6 rounded-2xl bg-card border border-border/30 shadow-2xl hover:border-sky-500/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-sky-500/15 flex items-center justify-center">
                <ArrowRightLeft className="w-6 h-6 text-sky-400" />
              </div>
              <span className="text-xs font-bold text-foreground">Transferir</span>
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TransactionTypeChooser;
