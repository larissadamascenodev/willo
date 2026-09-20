import { cn } from "@/lib/utils";
import wordmarkLight from "@/assets/logo/willo-wordmark-light.png";

type LogoSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<LogoSize, string> = {
  sm: "h-5",
  md: "h-7",
  lg: "h-14",
};

interface LogoProps {
  /** Controls height — sm for compact headers, md for standard headers, lg for login/onboarding hero. */
  size?: LogoSize;
  className?: string;
}

/** Willo wordmark rendered white — the whole app uses the dark identity. */
const Logo = ({ size = "md", className }: LogoProps) => {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <img src={wordmarkLight} alt="Willo" className={cn("w-auto", SIZE_CLASSES[size])} style={{ filter: "brightness(0) invert(1)" }} />
    </span>
  );
};

export default Logo;
