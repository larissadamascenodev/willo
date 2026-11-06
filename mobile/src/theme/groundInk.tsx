import { createContext, useCallback, useContext, type ReactNode } from "react";
import { th, thIn, type Role, type ThemeMode } from "~/theme/theme";

/**
 * The ink of what sits straight on the background, outside the cards.
 *
 * On a photo of one's own, the words on the ground — what Willo says at the top of
 * the home, the row above it — follow the photo's veil: white on a dark veil, black
 * on a light one. In the dark theme the veil is always dark; in the light theme it
 * can be either. The cards keep the theme's ink. Without a veil to follow, it is the
 * theme's ink as everywhere else.
 */

const GroundInk = createContext<ThemeMode | null>(null);

export function GroundInkProvider({ mode, children }: { mode: ThemeMode | null; children: ReactNode }) {
  return <GroundInk.Provider value={mode}>{children}</GroundInk.Provider>;
}

/** A th() for text on the ground. */
export function useGroundTh() {
  const mode = useContext(GroundInk);
  return useCallback(<T,>(color: T, role: Role = "fg"): T => (mode ? thIn(mode, color, role) : th(color, role)), [mode]);
}
