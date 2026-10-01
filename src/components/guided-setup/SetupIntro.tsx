import { motion } from "framer-motion";
import { Check, type LucideIcon } from "lucide-react";

/** Shared layout for the guided setup steps: what this step is for, then the action. */
const SetupIntro = ({ icon: Icon, title, text, bullets, action, onAction, onSkip }: {
  icon: LucideIcon;
  title: string;
  text: string;
  bullets: string[];
  action: string;
  onAction: () => void;
  onSkip: () => void;
}) => (
  <div className="flex min-h-0 flex-1 flex-col justify-center px-6">
    <motion.span
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white/[0.08]"
    >
      <Icon className="h-6 w-6 text-white" />
    </motion.span>

    <motion.h1
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 }}
      className="mt-5 text-[26px] font-extrabold leading-tight tracking-tight text-white"
    >
      {title}
    </motion.h1>
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mt-2 text-[14.5px] leading-snug text-white/66"
    >
      {text}
    </motion.p>

    <div className="mt-7 space-y-3">
      {bullets.map((b, i) => (
        <motion.div
          key={b}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.16 + i * 0.07 }}
          className="flex items-center gap-3"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-willo-green/15">
            <Check className="h-3.5 w-3.5 text-willo-green" strokeWidth={3} />
          </span>
          <span className="text-[14px] text-white/82">{b}</span>
        </motion.div>
      ))}
    </div>

    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }} className="mt-9">
      <button
        type="button"
        onClick={onAction}
        className="flex h-14 w-full items-center justify-center rounded-full bg-white text-[16px] font-bold text-[#0B0B0B] active:scale-[0.99]"
      >
        {action}
      </button>
      <button type="button" onClick={onSkip} className="mt-2 w-full py-3 text-center text-[14px] text-white/62 active:text-white">
        Pular esta etapa
      </button>
    </motion.div>
  </div>
);

export default SetupIntro;
