import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * The veil over a page's picture: dark behind the words written on it, then the
 * picture coming back and fading into the page.
 *
 * Going straight from dark to a light page leaves a grey smear between them. So the
 * two are done apart: the dark lifts off quickly just under the words, letting the
 * picture show again, while the page's own colour rises slowly over it — the picture
 * dissolves into the page, the way it does with no dark at all. Both run on eased
 * curves of many steps, so neither has an edge.
 */

const STEPS = 12;
const ease = (t: number) => t * t * (3 - 2 * t); // smoothstep

/** `fade` is the height, at the foot, where the picture dissolves into the page. */
export default function HeroVeil({ height, fade, ground, light }: { height: number; fade: number; ground: string; light: boolean }) {
  const veil = Math.round(height * 0.7);
  const end = 1 - fade / veil;
  /* Dark: rising behind the words, then lifting off in the first part of the fade. */
  const dark: string[] = [];
  const darkAt: number[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    darkAt.push(t * end);
    dark.push(`rgba(8,9,10,${(0.9 * ease(Math.min(1, t / 0.55))).toFixed(3)})`);
  }
  const lift = light ? 0.55 : 1;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    darkAt.push(end + t * (1 - end) * lift);
    dark.push(`rgba(8,9,10,${(light ? 0.9 * (1 - ease(t)) : 0.9 + 0.1 * t).toFixed(3)})`);
  }
  if (light) {
    darkAt.push(1);
    dark.push("rgba(8,9,10,0)");
  }
  /* The page's colour, rising slowly over the whole fade. */
  const [r, g, b] = rgbOf(ground);
  const page: string[] = [];
  const pageAt: number[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    pageAt.push(t);
    page.push(`rgba(${r},${g},${b},${ease(t).toFixed(3)})`);
  }

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: veil }}>
      <LinearGradient colors={dark as [string, string, ...string[]]} locations={darkAt as [number, number, ...number[]]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <LinearGradient colors={page as [string, string, ...string[]]} locations={pageAt as [number, number, ...number[]]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: fade }} />
    </View>
  );
}

function rgbOf(c: string): [number, number, number] {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(/[ ,/]+/).map(Number);
    return [r, g, b];
  }
  const n = parseInt(c.replace("#", "").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
