import { motion } from "framer-motion";
import botSrc from "@/assets/willo-bot.webp";

/**
 * Willo himself.
 *
 * The artwork arrives on its own near-black ground with the glow painted into it. On a
 * dark screen it is composited with `screen`, so the black goes to nothing and only the
 * rim light survives and he sits on whatever is behind him. On paper that same blend
 * erases him entirely — screen against white is white — so there he keeps his own night
 * as a small plate, which is how the brand sheet draws him anyway. Both live in CSS,
 * because only CSS can see which theme is on. A circular mask would clip the corners of
 * a rounded-square head, so the frame is a rounded square too.
 *
 * Two states, and the difference between them is the point: idle he just sits there,
 * working he breathes and the room picks up his colours — so "the app is doing
 * something" is carried by the character rather than by a spinner somewhere else.
 */
export default function BotMark({ working = false, size = 34 }: {
  working?: boolean;
  /** Pixels. The glow scales with it. */
  size?: number;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {working && (
        <motion.span
          aria-hidden="true"
          className="absolute rounded-full blur-md"
          style={{
            inset: -size * 0.22,
            background:
              "conic-gradient(from 0deg, #F87171, #FBBF24, #C8F36D, #34D399, #38BDF8, #818CF8, #F472B6, #F87171)",
          }}
          animate={{ rotate: 360, opacity: [0.32, 0.55, 0.32] }}
          transition={{
            rotate: { duration: 3.2, repeat: Infinity, ease: "linear" },
            opacity: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      )}
      <motion.img
        src={botSrc}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="willo-bot-img relative h-full w-full select-none rounded-[26%] object-cover"
        style={{ opacity: working ? 1 : 0.92 }}
        animate={working ? { y: [0, -1.8, 0], scale: [1, 1.04, 1] } : { y: 0, scale: 1 }}
        transition={working
          ? { duration: 1.7, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.25 }}
      />
    </span>
  );
}
