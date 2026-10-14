import { motion } from "framer-motion";

/**
 * The assistant's face.
 *
 * Drawn here as an SVG so it inherits colour and scales cleanly, and so it can be
 * swapped for the real mark in one place. To replace it: drop the artwork in
 * src/assets, import it, and return it from Face below — everything else (the sizes,
 * the states, where it appears) stays as it is.
 *
 * It has two states, and the difference between them is the point: idle it just sits
 * there, working it blinks and breathes, so "the app is doing something" is carried by
 * the character rather than by a spinner somewhere else on the screen.
 */

function Face({ working }: { working: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden="true">
      {/* head */}
      <rect
        x="3.2" y="5.6" width="17.6" height="13.4" rx="5"
        stroke="currentColor" strokeWidth="1.7"
      />
      {/* antenna */}
      <path d="M12 5.6V3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="2.3" r="1.25" fill="currentColor" />
      {/* eyes — they blink while it is working */}
      <motion.g
        fill="currentColor"
        animate={working ? { scaleY: [1, 1, 0.12, 1] } : { scaleY: 1 }}
        transition={working
          ? { duration: 2.6, repeat: Infinity, times: [0, 0.78, 0.85, 0.92], ease: "easeInOut" }
          : { duration: 0.2 }}
        style={{ transformOrigin: "12px 11.6px" }}
      >
        <rect x="7.5" y="10.1" width="2.6" height="3" rx="1.3" />
        <rect x="13.9" y="10.1" width="2.6" height="3" rx="1.3" />
      </motion.g>
      {/* mouth */}
      <motion.path
        d="M9.4 15.6h5.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        animate={working ? { pathLength: [0.45, 1, 0.45] } : { pathLength: 1 }}
        transition={working ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      />
    </svg>
  );
}

export default function BotMark({ working = false, size = 30 }: {
  working?: boolean;
  /** Pixels. The ring and the glow scale with it. */
  size?: number;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {working && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-willo-green/30"
          animate={{ scale: [1, 1.45], opacity: [0.5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <motion.span
        className={`relative flex h-full w-full items-center justify-center rounded-full border p-[5px] ${
          working
            ? "border-willo-green/45 bg-willo-green/12 text-willo-green"
            : "border-white/12 bg-white/[0.07] text-white/70"
        }`}
        animate={working ? { y: [0, -1.5, 0] } : { y: 0 }}
        transition={working ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      >
        <Face working={working} />
      </motion.span>
    </span>
  );
}
