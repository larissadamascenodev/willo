import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/**
 * Whether the bottom row is folded.
 *
 * On the web the nav reads `window.scrollY`, because every screen scrolls the page
 * itself. Here each screen owns its own scroller, so the screens report instead and
 * the bar listens — same rule, same threshold, same reason: once the page has moved
 * far enough that an open invitation would be in the way, it folds into the nav.
 */

interface NavChrome {
  collapsed: boolean;
  /** The page has moved at all — what the band over the header answers to. */
  moved: boolean;
  /** Hand to any screen's ScrollView: onScroll={onScroll}. */
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Tapping Início while already on Início unfolds the row where you are. */
  holdOpen: () => void;
}

const Ctx = createContext<NavChrome>({
  collapsed: false,
  moved: false,
  onScroll: () => {},
  holdOpen: () => {},
});

export const useNavChrome = () => useContext(Ctx);

export function NavChromeProvider({ children }: { children: ReactNode }) {
  const [scrolledPast, setScrolledPast] = useState(false);
  const [moved, setMoved] = useState(false);
  const [held, setHeld] = useState(false);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    /* Generous, so a thumb twitch does not make the row flap. */
    const y = e.nativeEvent.contentOffset.y;
    setScrolledPast(y > 90);
    setMoved(y > 4);
    setHeld(false);
  }, []);

  const value = useMemo(
    () => ({ collapsed: scrolledPast && !held, moved, onScroll, holdOpen: () => setHeld(true) }),
    [scrolledPast, moved, held, onScroll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
