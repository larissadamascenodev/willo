import { useEffect } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface Props {
  onDone: () => void;
}

const DONE_MS = 3000;

const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  x: (i * 41) % 100,
  delay: 0.25 + (i % 7) * 0.05,
  rot: (i * 57) % 360,
  color: ["#FFFFFF", "#C8F36D", "#9A9AA0", "#FFFFFF"][i % 4],
  w: 5 + (i % 3) * 2,
}));

/** Closing beat of the guided setup: the check lands, rings ripple out, then the app opens. */
const SetupDoneStep = ({ onDone }: Props) => {
  useEffect(() => {
    const id = setTimeout(onDone, DONE_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0">
        {CONFETTI.map((c, i) => (
          <motion.span
            key={i}
            className="absolute top-0 rounded-[2px]"
            style={{ left: `${c.x}%`, width: c.w, height: c.w * 1.6, background: c.color }}
            initial={{ y: -40, rotate: c.rot, opacity: 1 }}
            animate={{ y: 620, rotate: c.rot + 540, opacity: 0 }}
            transition={{ duration: 2.2, delay: c.delay, ease: "easeIn" }}
          />
        ))}
      </div>

      <div className="relative flex h-24 w-24 items-center justify-center">
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border-2 border-willo-green"
            initial={{ scale: 0.7, opacity: 0.7 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.1, delay: 0.25 + i * 0.25, ease: "easeOut" }}
          />
        ))}
        <motion.span
          className="flex h-20 w-20 items-center justify-center rounded-full bg-willo-green"
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 14 }}
        >
          <motion.svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="#0B0B0B" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5 L10 17.5 L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.25 }} />
          </motion.svg>
        </motion.span>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-7">
        <p className="text-[26px] font-extrabold leading-tight tracking-tight text-white">Tudo pronto!</p>
        <p className="mt-2 text-[14.5px] leading-snug text-white/66">
          Seu Willo já está de pé. A partir de agora é só registrar e acompanhar.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-8 h-1 w-32 overflow-hidden rounded-full bg-white/10"
      >
        <motion.div
          className="h-full rounded-full bg-white"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: (DONE_MS - 900) / 1000, ease: "linear" }}
        />
      </motion.div>
      <p className="mt-2 text-[12px] text-white/45">Abrindo seu painel…</p>
    </div>
  );
};

export default SetupDoneStep;
