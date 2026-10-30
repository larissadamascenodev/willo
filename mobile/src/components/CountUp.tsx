import { useEffect, useRef, useState } from "react";
import { Text, type TextProps } from "react-native";
import { money } from "~/lib/money";

/**
 * A figure that travels to its new value instead of jumping.
 *
 * Moving between invoices can change a number by thousands; read as a jump, it is just
 * a different number. Counted there over a moment — fast at first, settling at the end —
 * it reads as the same thing having changed, and by how much.
 */

const MS = 520;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export default function CountUp({
  value,
  format = money,
  ...text
}: { value: number; format?: (v: number) => string } & TextProps) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    const start = from.current;
    if (start === value) return;
    const began = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - began) / MS);
      const v = start + (value - start) * ease(t);
      from.current = v;
      setShown(v);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value]);

  return <Text {...text}>{format(shown)}</Text>;
}
