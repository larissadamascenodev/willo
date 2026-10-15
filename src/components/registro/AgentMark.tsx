import type { LucideIcon } from "lucide-react";

/**
 * An agent's face: Willo's head in its own colour, with the one thing it watches
 * pinned to it.
 *
 * They are the same silhouette on purpose. A team of four unrelated mascots is four
 * things to learn; the same head in four colours is one thing you already know, four
 * times — and it says they are all him, which is true, because they are all the same
 * assistant looking at different parts of the money.
 */
export default function AgentMark({ hex, icon: Icon, size = 56 }: {
  /** The agent's colour. Fills the head and tints everything around it. */
  hex: string;
  /** What it watches, worn as a badge. */
  icon: LucideIcon;
  size?: number;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 32" fill="none" className="h-full w-full" aria-hidden="true">
        {/* head */}
        <rect x="3.4" y="6.6" width="25.2" height="19.2" rx="8.4" fill={hex} />
        {/* eyes, knocked out of the fill so the ground shows through them */}
        <rect x="10.1" y="12.6" width="4.1" height="6.8" rx="2.05" fill="#0B0C10" />
        <rect x="17.8" y="12.6" width="4.1" height="6.8" rx="2.05" fill="#0B0C10" />
      </svg>

      <span
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full ring-2 ring-[#0B0C10]"
        style={{ width: size * 0.42, height: size * 0.42, background: hex }}
      >
        <Icon
          className="text-[#0B0C10]"
          style={{ width: size * 0.24, height: size * 0.24 }}
          strokeWidth={2.6}
        />
      </span>
    </span>
  );
}
