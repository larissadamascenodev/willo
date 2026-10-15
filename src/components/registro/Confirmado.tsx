import { motion } from "framer-motion";
import { Check } from "lucide-react";
import BotMark from "./BotMark";

/**
 * The moment something lands.
 *
 * "Anotado" as a line of text in the thread read like any other sentence, and the one
 * thing a person needs to feel here is that it is done — they are about to put the
 * phone away. So it arrives as an event: the mark springs in, a short burst goes out
 * from it, and Willo is standing next to it.
 *
 * The burst is drawn rather than looped, and the whole thing settles in under a
 * second, because it has to be celebratory the first time and invisible the hundredth.
 */

const RAYS = 8;

export default function Confirmado({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-2.5"
    >
      <BotMark size={30} />

      <div className="relative flex items-center gap-2 rounded-full border border-willo-green/30 bg-willo-green/[0.10] py-2 pl-2 pr-4 backdrop-blur-xl">
        <span className="relative flex h-[22px] w-[22px] items-center justify-center">
          {/* The burst: short rays thrown outward once, then gone. */}
          {Array.from({ length: RAYS }, (_, i) => {
            const angle = (360 / RAYS) * i;
            return (
              <motion.span
                key={i}
                aria-hidden="true"
                className="absolute h-[2px] w-[5px] rounded-full bg-willo-green"
                style={{ transform: `rotate(${angle}deg) translateX(11px)` }}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.7], x: [0, 5, 8] }}
                transition={{ duration: 0.55, delay: 0.14, ease: "easeOut" }}
              />
            );
          })}

          <motion.span
            className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-willo-green"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 620, damping: 18, delay: 0.06 }}
          >
            <motion.span
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.18, duration: 0.2 }}
            >
              <Check className="h-[13px] w-[13px] text-[#0B0B0B]" strokeWidth={3.6} />
            </motion.span>
          </motion.span>
        </span>

        <motion.span
          className="text-[14.5px] font-semibold tracking-[-0.01em] text-willo-green-ink"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.16, duration: 0.26 }}
        >
          {text}
        </motion.span>
      </div>
    </motion.div>
  );
}
