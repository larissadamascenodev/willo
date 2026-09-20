import { useEffect, useRef, useState } from "react";

import { getCurrency } from "@/lib/currency";
/**
 * Animated counter that smoothly transitions between values
 */
export function useAnimatedCounter(target: number, duration = 600) {
  const [current, setCurrent] = useState(target);
  const rafRef = useRef<number>();
  const startRef = useRef<number>();
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    const diff = target - from;
    startRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - (startRef.current ?? now);
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + diff * eased;

      setCurrent(value);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  // On first render, sync immediately
  useEffect(() => {
    fromRef.current = target;
    setCurrent(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When target changes after first render, update fromRef after animation
  useEffect(() => {
    fromRef.current = current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return current;
}

export function useFormattedCounter(target: number, duration = 600) {
  const animated = useAnimatedCounter(target, duration);
  return animated.toLocaleString("pt-BR", {
    style: "currency",
    currency: getCurrency(),
    minimumFractionDigits: 2,
  });
}
