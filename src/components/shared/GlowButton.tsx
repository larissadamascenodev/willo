import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** "light": white pill, black text. "dark": black pill, white text. */
  variant?: "light" | "dark";
  children: ReactNode;
  className?: string;
}

/**
 * Primary call to action: a pill with a beam of light that keeps circling
 * its border, plus a soft halo that follows it — white, gray and black only.
 * Disabled buttons keep a still, dim outline.
 */
const GlowButton = forwardRef<HTMLButtonElement, Props>(({ variant = "dark", children, className, disabled, ...rest }, ref) => {
  const light = variant === "light";

  return (
    <div className={cn("relative isolate w-full", className)}>
      {/* Halo that follows the beam */}
      {!disabled && (
        <div className="pointer-events-none absolute -inset-[3px] -z-10 overflow-hidden rounded-full opacity-80 blur-[10px]">
          <div
            className="absolute left-1/2 top-1/2 aspect-square w-[260%] -translate-x-1/2 -translate-y-1/2 animate-spin"
            style={{
              animationDuration: "3.6s",
              background: "conic-gradient(from 0deg, transparent 0 58%, rgba(255,255,255,0.55) 76%, rgba(255,255,255,0.15) 86%, transparent 94%)",
            }}
          />
        </div>
      )}

      {/* Border ring */}
      <div
        className={cn(
          "relative overflow-hidden rounded-full p-[1.5px]",
          disabled ? "bg-white/[0.12]" : light ? "bg-white/40" : "bg-white/[0.16]",
        )}
      >
        {!disabled && (
          <div
            className="absolute left-1/2 top-1/2 aspect-square w-[260%] -translate-x-1/2 -translate-y-1/2 animate-spin"
            style={{
              animationDuration: "3.6s",
              background: light
                ? "conic-gradient(from 0deg, rgba(120,120,120,0.9) 0 55%, #FFFFFF 74%, rgba(160,160,160,0.9) 88%, rgba(120,120,120,0.9) 100%)"
                : "conic-gradient(from 0deg, transparent 0 55%, #FFFFFF 75%, rgba(255,255,255,0.35) 86%, transparent 95%)",
            }}
          />
        )}

        <button
          ref={ref}
          disabled={disabled}
          className={cn(
            "relative flex h-14 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold uppercase tracking-[0.22em] transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed",
            light ? "bg-white text-[#0B0B0B]" : "bg-[#0B0B0B] text-white",
            disabled && (light ? "bg-white/40 text-[#0B0B0B]/60" : "text-white/30"),
          )}
          {...rest}
        >
          {children}
        </button>
      </div>
    </div>
  );
});

GlowButton.displayName = "GlowButton";
export default GlowButton;
