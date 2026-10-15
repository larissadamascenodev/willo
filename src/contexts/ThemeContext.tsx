import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Which way up the app is.
 *
 * The choice is written to `data-theme` on the document element, which is what every
 * token and every glass surface keys off, and remembered per device. It is deliberately
 * not stored on the profile: a theme is about the room the phone is in, not about the
 * person, and someone who reads on a bright balcony and a dark sofa should not have the
 * two devices arguing.
 *
 * "system" follows the phone. It is the default, because an app that ignores the
 * setting the whole device already made is the one thing a theme can get wrong before
 * it has drawn anything.
 */

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "willo:theme";

interface ThemeValue {
  /** What the person picked. */
  choice: ThemeChoice;
  /** What that actually resolves to right now. */
  theme: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeValue>({
  choice: "system",
  theme: "dark",
  setChoice: () => {},
});

function readStored(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // Private mode and blocked storage both land here; the default is fine.
  }
  return "system";
}

const prefersLight = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStored);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => (prefersLight() ? "light" : "dark"));

  // Follow the phone while the choice is "system" — and keep following it after,
  // so switching back costs nothing.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const theme: ResolvedTheme = choice === "system" ? systemTheme : choice;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    // Native controls, scrollbars and form widgets follow this rather than our tokens.
    root.style.colorScheme = theme;
    // The status bar and the area behind a rubber-band scroll read the body's colour.
    const bar = document.querySelector('meta[name="theme-color"]');
    if (bar) bar.setAttribute("content", theme === "light" ? "#f4f4f6" : "#080808");
  }, [theme]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember it is survivable; not applying it would not be.
    }
  }, []);

  const value = useMemo(() => ({ choice, theme, setChoice }), [choice, theme, setChoice]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);
