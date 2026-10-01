/**
 * The page's backdrop: folds of dark silk, lit along their edges.
 *
 * Drawn rather than tinted, because the glass surfaces on top need something with
 * structure behind them — a flat fill blurs to the same flat fill and the glass
 * disappears. It is fixed and non-interactive, so it stays put while the page
 * scrolls over it, and `slice` keeps the curves filling any screen shape.
 */
const SilkBackdrop = () => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#06080c]">
    <svg
      className="h-full w-full"
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="silk-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1b2534" />
          <stop offset="100%" stopColor="#0a0f17" />
        </linearGradient>
        <linearGradient id="silk-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#141c28" />
          <stop offset="100%" stopColor="#080c13" />
        </linearGradient>
        <linearGradient id="silk-c" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#111823" />
          <stop offset="100%" stopColor="#05070b" />
        </linearGradient>
        {/* The lit edge: brightest where the fold turns, fading off to the sides */}
        <linearGradient id="edge-warm" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9fb8d6" stopOpacity="0" />
          <stop offset="38%" stopColor="#c3d6ee" stopOpacity="0.5" />
          <stop offset="72%" stopColor="#8fa8c6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#8fa8c6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="edge-cool" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#9fb8d6" stopOpacity="0" />
          <stop offset="34%" stopColor="#b6cbe6" stopOpacity="0.4" />
          <stop offset="78%" stopColor="#7e95b2" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#7e95b2" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="glow-tl" cx="0.18" cy="0.06" r="0.72">
          <stop offset="0%" stopColor="#2d3d55" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2d3d55" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="390" height="844" fill="#06080c" />
      <rect width="390" height="844" fill="url(#glow-tl)" />

      {/* Upper fold, sweeping down from the left shoulder */}
      <path d="M-40,-40 L430,-40 L430,96 C318,52 232,196 96,186 C34,181 -8,214 -40,246 Z" fill="url(#silk-a)" />
      <path
        d="M430,96 C318,52 232,196 96,186 C34,181 -8,214 -40,246"
        fill="none"
        stroke="url(#edge-warm)"
        strokeWidth="1.1"
      />

      {/* A thin thread running just inside it, the second highlight on a fold */}
      <path
        d="M430,150 C322,112 240,250 108,242 C46,238 4,268 -40,300"
        fill="none"
        stroke="url(#edge-cool)"
        strokeWidth="0.8"
        opacity="0.6"
      />

      {/* Middle ribbon, turning the other way */}
      <path d="M-40,470 C88,372 214,500 430,386 L430,616 C236,706 96,578 -40,662 Z" fill="url(#silk-b)" />
      <path
        d="M-40,470 C88,372 214,500 430,386"
        fill="none"
        stroke="url(#edge-cool)"
        strokeWidth="1"
      />

      {/* The broad fold the content settles onto */}
      <path d="M-40,690 C112,598 258,742 430,628 L430,884 L-40,884 Z" fill="url(#silk-c)" />
      <path
        d="M-40,690 C112,598 258,742 430,628"
        fill="none"
        stroke="url(#edge-warm)"
        strokeWidth="1.1"
      />

      {/* Settles the foot of the page so the floating bar reads against something calm */}
      <rect y="700" width="390" height="144" fill="#05070b" opacity="0.55" />
    </svg>
  </div>
);

export default SilkBackdrop;
