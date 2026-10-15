import { motion } from "framer-motion";

/**
 * Willo, drawn rather than photographed.
 *
 * The rendered artwork carries its own near-black ground with the glow baked into it,
 * which means it always arrives with a plate around its head — fine on a dark screen,
 * a dark square on a light one, and in both cases a second background competing with
 * the first. Drawn as a line he has no ground at all and whatever is behind simply
 * shows through, which is what lets him sit in a piece of glass.
 *
 * The dollar in the right eye is knocked out rather than painted over, so it reads as
 * a cut in the eye the way it does in the artwork, and stays transparent wherever the
 * mark is placed.
 *
 * He is drawn in white, not in his colours. At this size the gradient reads as a smudge
 * rather than as a rainbow, and a mark that has to work on a bar, in a header and over
 * a photograph is better off being one solid thing. The disc carries a blur: translucent
 * enough to be glass, opaque enough that the page does not read through his face.
 */

export default function BotMark({ working = false, size = 34 }: {
  working?: boolean;
  /** Pixels, including the disc it sits in. */
  size?: number;
}) {
  // One mask per instance: two marks on screen must not share an id.
  const gid = `willo-bot-${size}-${working ? "w" : "i"}`;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size }}
    >
      {/* The disc he lives in: glass, not a plate — but solid enough to be a face and
          not a window onto whatever is scrolling past underneath. */}
      <span
        className={`absolute inset-0 rounded-full border backdrop-blur-xl transition-colors ${
          working ? "border-white/30 bg-white/[0.22]" : "border-white/18 bg-white/[0.15]"
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
        className={`relative ${working ? "text-willo-green" : "text-white"}`}
        style={{ width: size * 0.64, height: size * 0.64 }}
        aria-hidden="true"
        animate={working ? { y: [0, -1.2, 0] } : { y: 0 }}
        transition={working ? { duration: 1.7, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25 }}
      >
        <defs>
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
          stroke="currentColor"
          strokeWidth="2.6"
        />
        {/* antenna */}
        <path d="M16 7.5V4.4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="16" cy="2.8" r="1.7" fill="currentColor" />
        {/* eyes — the right one wears the dollar */}
        <rect x="9.4" y="12.4" width="5.2" height="8.4" rx="2.6" fill="currentColor" />
        <rect
          x="17.4"
          y="12.4"
          width="5.2"
          height="8.4"
          rx="2.6"
          fill="currentColor"
          mask={`url(#${gid}-eye)`}
        />
      </motion.svg>
    </span>
  );
}
