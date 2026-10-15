import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The way out of a page.
 *
 * Sections are switched between and carry the nav; pages are entered and left, and the
 * only thing they need is this. It is a disc rather than a bare arrow so it holds its
 * own over a card, a photograph or a chart — the three things that tend to sit directly
 * underneath it.
 *
 * It goes back in history by default rather than to a fixed route, because the same page
 * is reached from several places and the right answer is always "where you came from".
 */
export default function BackButton({ to, className, style }: {
  /** Overrides history, for a page that can be deep-linked into. */
  to?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (to ? navigate(to) : navigate(-1))}
      aria-label="Voltar"
      style={style}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] backdrop-blur-md transition-transform active:scale-95",
        className,
      )}
    >
      <ArrowLeft className="h-[20px] w-[20px] text-white" strokeWidth={2.2} />
    </button>
  );
}
