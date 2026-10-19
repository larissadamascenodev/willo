import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * How far the page has travelled, and what the furniture does about it.
 *
 * On the web the nav reads `window.scrollY`, because every screen scrolls the page
 * itself. Here each screen owns its own scroller, so the screens report instead and
 * the bar listens — same rules, same thresholds.
 *
 * It takes a number rather than a scroll event because the home drives its own
 * scrolling through Reanimated, on the UI thread, and only hands back the figure.
 */

interface NavChrome {
  collapsed: boolean;
  /** The page has moved at all — what the band over the header answers to. */
  moved: boolean;
  /** Call from a screen's scroll handler with the vertical offset. */
  report: (y: number) => void;
  /** Tapping Início while already on Início unfolds the row where you are. */
  holdOpen: () => void;
}

const Ctx = createContext<NavChrome>({
  collapsed: false,
  moved: false,
  report: () => {},
  holdOpen: () => {},
});

export const useNavChrome = () => useContext(Ctx);

export function NavChromeProvider({ children }: { children: ReactNode }) {
  const [scrolledPast, setScrolledPast] = useState(false);
  const [moved, setMoved] = useState(false);
  const [held, setHeld] = useState(false);

  const report = useCallback((y: number) => {
    /* Generous, so a thumb twitch does not make the row flap. */
    setScrolledPast(y > 90);
    setMoved(y > 4);
    setHeld(false);
  }, []);

  const value = useMemo(
    () => ({ collapsed: scrolledPast && !held, moved, report, holdOpen: () => setHeld(true) }),
    [scrolledPast, moved, held, report],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
