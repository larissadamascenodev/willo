import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { TextStyle } from "react-native";
import { th, thIn, type Role, type ThemeMode } from "~/theme/theme";

/**
 * The ink of what sits straight on the background, outside the cards.
 *
 * On a photo of one's own, the words on the ground — what Willo says at the top of
 * the home, the row above it — follow the photo's veil rather than the app's theme:
 * black on a light veil, white on a dark one. The cards keep the theme's ink.
 *
 * The weaker the veil, the more of the photo shows through behind the letters, so
 * they get a soft halo of the opposite colour, strongest when the veil is faint and
 * gone when it is heavy: the words stay sharp to read at any strength.
 *
 * Without a provider, or with no photo, it is the theme's ink as everywhere else.
 */

export interface GroundLook {
  /** The veil's tone: "light" asks for black ink, "dark" for white. */
  tone: ThemeMode;
  /** How strong the veil is, 0 to 0.85. */
  amount: number;
}

const GroundInk = createContext<GroundLook | null>(null);

export function GroundInkProvider({ look, children }: { look: GroundLook | null; children: ReactNode }) {
  return <GroundInk.Provider value={look}>{children}</GroundInk.Provider>;
}

/** A th() for text on the ground. */
export function useGroundTh() {
  const look = useContext(GroundInk);
  const mode = look?.tone ?? null;
  return useCallback(<T,>(color: T, role: Role = "fg"): T => (mode ? thIn(mode, color, role) : th(color, role)), [mode]);
}

/** The halo behind letters on a photo: stronger as the veil is fainter. */
export function useGroundHalo(): TextStyle {
  const look = useContext(GroundInk);
  return useMemo(() => {
    if (!look) return {};
    const faint = 1 - Math.min(1, Math.max(0, look.amount / 0.85));
    const alpha = 0.3 + 0.55 * faint;
    return {
      textShadowColor: look.tone === "dark" ? `rgba(0,0,0,${alpha.toFixed(2)})` : `rgba(255,255,255,${alpha.toFixed(2)})`,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 4 + 8 * faint,
    };
  }, [look]);
}
