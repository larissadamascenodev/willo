import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { InsightSlide } from "@/lib/insights";
import { greetings, longestUnsaid, markSaid, type Greeting } from "~/lib/greeting";
import { useGroundTh } from "~/theme/groundInk";
import { INK } from "~/theme/tokens";

/**
 * Willo, speaking, at the top of the home.
 *
 * The same things he has always said, in turn: a hello by the hour with the person's name,
 * what he has noticed in their numbers (a bill gone past its day, the category that took the
 * month, what is left a day), and the things he does ("Gastou agora há pouco?"). Each line set
 * large, its key words lit in the brand's lilac, the sentence under it smaller; a new one every
 * few seconds, the old fading as the new rises.
 *
 * It sits fixed behind the page, on the background, and the cards scroll up over it. A touch
 * on it is taken by the page above it and opens the conversation on the line on show.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const HOLD_MS = 7000;
const WEEK = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
/* Longer than this does not read at this size. */
const LONGEST = 64;

interface Part {
  text: string;
  lit?: boolean;
}
export interface WilloLine extends Greeting {
  parts: Part[];
}

/** A line with no figure in it: the name is lit if it is there, otherwise its closing words. */
function litOf(title: string, name: string | null): Part[] {
  if (name && title.includes(name)) {
    const at = title.indexOf(name);
    return [{ text: title.slice(0, at) }, { text: name, lit: true }, { text: title.slice(at + name.length) }];
  }
  const words = title.split(" ");
  const keep = words.length <= 3 ? 1 : 2;
  return [{ text: `${words.slice(0, -keep).join(" ")} ` }, { text: words.slice(-keep).join(" "), lit: true }];
}

export default function HomeHero({ name, slides, onLine }: { name: string | null; slides: InsightSlide[]; onLine: (line: WilloLine) => void }) {
  const th = useGroundTh();
  const now = new Date();
  const today = `${WEEK[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;

  /* The hello and the things he does, chosen once the name is known (it gets a moment). */
  const [asks, setAsks] = useState<Greeting[] | null>(null);
  useEffect(() => {
    if (asks) return;
    if (name) {
      setAsks(greetings(name));
      return;
    }
    const t = setTimeout(() => setAsks(greetings(null)), 4000);
    return () => clearTimeout(t);
  }, [name, asks]);

  /* What he noticed, from the numbers: their figures are what is lit. Settled in its order
     once, so lines never swap places while one is on show. */
  const key = slides.map((s) => s.id + s.body.map((p) => p.text).join("")).join("|");
  const noticed = useMemo<WilloLine[]>(
    () =>
      longestUnsaid(
        slides
          .filter((s) => s.id !== "ola")
          .map((s) => {
            const title = s.body.map((p) => p.text).join("");
            return { title, sub: s.quip ?? "", ask: `Me explica melhor: ${title}`, parts: s.body.map((p) => ({ text: p.text, lit: p.bold })) };
          })
          .filter((l) => l.title.length <= LONGEST),
      ).slice(0, 6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  /* The hello, then what he noticed with something he does after every two. */
  const lines = useMemo<WilloLine[]>(() => {
    if (!asks) return [];
    const said = asks.filter((g) => g.title.length <= LONGEST).map((g) => ({ ...g, parts: litOf(g.title, name) }));
    const [hello, ...rest] = said;
    const out: WilloLine[] = hello ? [hello] : [];
    noticed.forEach((l, n) => {
      out.push(l);
      if (n % 2 === 1 && rest.length) out.push(rest.shift()!);
    });
    return [...out, ...rest];
  }, [asks, noticed, name]);

  /* The line on show is held as itself: the list grows as the numbers arrive, and a place in
     it would then point at another line. */
  const [current, setCurrent] = useState<WilloLine | null>(null);
  const latest = useRef(lines);
  latest.current = lines;
  useEffect(() => {
    if (!current && lines.length) setCurrent(lines[0]);
  }, [current, lines]);

  const shown = useSharedValue(0);
  useEffect(() => {
    if (!current) return;
    markSaid(current.title);
    onLine(current);
    shown.set(0);
    shown.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    let swap: ReturnType<typeof setTimeout>;
    const t = setTimeout(() => {
      shown.set(withTiming(0, { duration: 300 }));
      swap = setTimeout(() => {
        const list = latest.current;
        const here = list.findIndex((l) => l.title === current.title);
        if (list.length) setCurrent(list[(here + 1) % list.length]);
      }, 320);
    }, HOLD_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(swap);
    };
    // onLine only reports.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: (1 - shown.get()) * 8 }] }));

  return (
    <View style={{ paddingTop: 18, paddingBottom: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: th("#fff", "bg"), shadowColor: "#fff", shadowOpacity: 0.8, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }} />
        <Text style={{ flex: 1, fontSize: 11.5, fontWeight: "700", letterSpacing: 1.6, color: th("rgba(255,255,255,0.72)") }}>WILLO · PARA VOCÊ, AGORA</Text>
        <Text style={[nums, { fontSize: 11.5, fontWeight: "700", letterSpacing: 1.4, color: th("rgba(255,255,255,0.55)") }]}>{today}</Text>
      </View>
      {/* Its room is fixed, so the cards under it never move as the lines change. */}
      <Animated.View style={[{ marginTop: 10, height: 104 }, style]}>
        {current && (
          <>
            <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72} style={[nums, { maxWidth: 340, fontSize: 31, lineHeight: 35, fontWeight: "800", letterSpacing: -0.9, color: th("#fff") }]}>
              {current.parts.map((p, i) =>
                p.lit ? (
                  <Text key={i} style={{ color: th("#C4B5FD") }}>
                    {p.text}
                  </Text>
                ) : (
                  p.text
                ),
              )}
            </Text>
            {current.sub ? (
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[nums, { marginTop: 9, maxWidth: 340, fontSize: 14.5, lineHeight: 20, color: th(INK.soft) }]}>
                {current.sub}
              </Text>
            ) : null}
          </>
        )}
      </Animated.View>
    </View>
  );
}
