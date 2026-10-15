import { motion } from "framer-motion";

/**
 * Willo, drawn rather than photographed.
 *
 * The rendered artwork carries its own near-black ground with the glow baked into it,
 * which means it always arrives with a plate around its head — fine on a dark screen,
 * a dark square on a light one, and in both cases a second background competing with
 * the first. Drawn as a line it has no ground at all: the stroke takes the colours
 * straight from the mark and whatever is behind simply shows through, which is what
 * lets it sit in a piece of glass.
 *
 * The dollar in the right eye is knocked out rather than painted over, so it reads as
 * a cut in the eye the way it does in the artwork, and stays transparent wherever the
 * mark is placed.
 */

export default function BotMark({ working = false, size = 34 }: {
  working?: boolean;
  /** Pixels, including the disc it sits in. */
  size?: number;
}) {
  // One gradient per instance: two marks on screen must not share an id.
  const gid = `willo-bot-${size}-${working ? "w" : "i"}`;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size }}
    >
      {/* The translucent disc it lives in: glass, not a plate. */}
      <span
        className={`absolute inset-0 rounded-full border transition-colors ${
          working ? "border-white/25 bg-white/[0.12]" : "border-white/15 bg-white/[0.07]"
        }`}
      />

      {working && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border border-willo-green/50"
          animate={{ scale: [1, 1.22], opacity: [0.7, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      <motion.svg
        viewBox="0 0 32 32"
        fill="none"
        className="relative"
        style={{ width: size * 0.64, height: size * 0.64 }}
        aria-hidden="true"
        animate={working ? { y: [0, -1.2, 0] } : { y: 0 }}
        transition={working ? { duration: 1.7, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25 }}
      >
        <defs>
          <linearGradient id={gid} x1="2" y1="28" x2="30" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#F87171" />
            <stop offset="0.22" stopColor="#FBBF24" />
            <stop offset="0.45" stopColor="#C8F36D" />
            <stop offset="0.68" stopColor="#38BDF8" />
            <stop offset="1" stopColor="#A78BFA" />
          </linearGradient>
          {/* The dollar is a hole in the eye, not a mark on top of it. */}
          <mask id={`${gid}-eye`}>
            <rect x="17.4" y="12.4" width="5.2" height="8.4" rx="2.6" fill="#fff" />
            <text
              x="20"
              y="19"
              textAnchor="middle"
              fontSize="7.8"
              fontWeight="800"
              fill="#000"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            >
              $
            </text>
          </mask>
        </defs>

        {/* head */}
        <rect
          x="2.7"
          y="7.5"
          width="26.6"
          height="19.2"
          rx="7.8"
          stroke={`url(#${gid})`}
          strokeWidth="2.6"
        />
        {/* antenna */}
        <path d="M16 7.5V4.4" stroke={`url(#${gid})`} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="16" cy="2.8" r="1.7" fill={`url(#${gid})`} />
        {/* eyes — the right one wears the dollar */}
        <rect x="9.4" y="12.4" width="5.2" height="8.4" rx="2.6" fill={`url(#${gid})`} />
        <rect
          x="17.4"
          y="12.4"
          width="5.2"
          height="8.4"
          rx="2.6"
          fill={`url(#${gid})`}
          mask={`url(#${gid}-eye)`}
        />
      </motion.svg>
    </span>
  );
}
