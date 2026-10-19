import { useEffect, useRef, useState } from "react";
import { Text, type TextProps } from "react-native";
import { money } from "~/lib/money";

/**
 * A figure that counts to where it lands.
 *
 * The web runs its totals up from the last one over six tenths of a second, eased
 * out, so a number that changes is seen to change rather than simply being
 * different the next time you look. On first render it arrives at its value — a
 * balance counting up from zero every time you open the app would be theatre.
 */
export default function Money({
  value,
  duration = 600,
  ...rest
}: { value: number; duration?: number } & TextProps) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      from.current = value;
      setShown(value);
      return;
    }

    const start = Date.now();
    const origin = from.current;
    const diff = value - origin;
    if (diff === 0) return;

    const step = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      /* Ease out cubic, the same curve the browser uses. */
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(origin + diff * eased);
      if (progress < 1) frame.current = requestAnimationFrame(step);
      else from.current = value;
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  return <Text {...rest}>{money(shown)}</Text>;
}
