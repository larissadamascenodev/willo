import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { greetings, layOut, longestUnsaid, markSaid, type Greeting } from "~/lib/greeting";
import { face } from "~/lib/chatFont";
import { INK } from "~/theme/tokens";

import { useGroundTh } from "~/theme/groundInk";
/**
 * What he says under the sphere: a word at a time as it arrives, then the next thing
 * after a while. The first line is the hello, chosen once for each time the screen opens.
 */

const HOLD_MS = 7000;
const WORD_MS = 75;
const TITLE = 20;
const SUB = 14;

function Word({ text, delay, size }: { text: string; delay: number; size: number }) {
  const th = useGroundTh();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [shown, delay]);
  const style = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: (1 - shown.get()) * 7 }] }));
  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: size, ...face(700), letterSpacing: -0.4, color: th("#fff") }}>{text}</Text>
    </Animated.View>
  );
}

function Rising({ delay, children }: { delay: number; children: ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withDelay(delay, withTiming(1, { duration: 420, reduceMotion: ReduceMotion.System })));
  }, [shown, delay]);
  const style = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function GreetingLine({
  name,
  readings = [],
  onPick,
  onLine,
  align = "center",
  room: roomProp,
  titleSize = TITLE,
}: {
  name: string | null;
  /** What he has noticed in the numbers, mixed in. */
  readings?: Greeting[];
  /** The line on show was touched. */
  onPick?: (line: Greeting) => void;
  /** The line on show changed, for a screen that takes the touch itself. */
  onLine?: (line: Greeting) => void;
  /** Centred under the sphere, or set beside it, flush left. */
  align?: "center" | "left";
  /** The width the words have, when it is not the screen's. */
  room?: number;
  titleSize?: number;
}) {
  const th = useGroundTh();
  /* Chosen once, when the name is known, so the hello does not change under the reader's
     eyes as things load. The name gets a moment to arrive. */
  const [chosen, setChosen] = useState<Greeting[] | null>(null);
  useEffect(() => {
    if (chosen) return;
    if (name) {
      setChosen(greetings(name));
      return;
    }
    const t = setTimeout(() => setChosen(greetings(null)), 4000);
    return () => clearTimeout(t);
  }, [name, chosen]);
  /* Their order is settled once: lines must not swap places while one is on show. */
  const titles = readings.map((r) => r.title).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const noticed = useMemo(() => longestUnsaid(readings).slice(0, 6), [titles]);

  /* The hello, then what he has noticed with something to ask after every two. */
  const lines: Greeting[] = [];
  if (chosen) {
    const asks = chosen.slice(1);
    lines.push(chosen[0]);
    noticed.forEach((r, n) => {
      lines.push(r);
      if (n % 2 === 1 && asks.length) lines.push(asks.shift()!);
    });
    lines.push(...asks);
  }
  const [at, setAt] = useState(0);
  const out = useSharedValue(1);
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (lines.length === 0) return;
    let swap: ReturnType<typeof setTimeout>;
    const t = setTimeout(() => {
      out.set(withTiming(0, { duration: 260 }));
      swap = setTimeout(() => {
        setAt((n) => (n + 1) % lines.length);
        out.set(1);
      }, 280);
    }, HOLD_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(swap);
    };
  }, [at, lines.length, out]);
  const fading = useAnimatedStyle(() => ({ opacity: out.get() }));

  const shownTitle = lines.length ? lines[at % lines.length].title : null;
  useEffect(() => {
    if (shownTitle) markSaid(shownTitle);
  }, [shownTitle]);

  const current = lines.length ? lines[at % lines.length] : null;
  const reportLine = useRef(onLine);
  reportLine.current = onLine;
  useEffect(() => {
    if (current) reportLine.current?.(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownTitle]);

  if (!current) return null;
  const line = current;
  /* Bold at this size runs about half its size a letter; the sub line, a little less. */
  const left = align === "left";
  const room = roomProp ?? width - 44;
  const title = layOut(line.title, Math.floor(room / (titleSize * 0.58)), titleSize);
  const sub = layOut(line.sub, Math.floor(room / (SUB * 0.54)), SUB);
  let spoken = 0;
  return (
    <Animated.View key={at} style={[{ alignSelf: "stretch" }, fading]}>
      <Pressable onPress={() => onPick?.(line)} accessibilityRole={onPick ? "button" : undefined} style={{ alignItems: left ? "flex-start" : "center", paddingHorizontal: left ? 0 : 22 }}>
      {left ? (
        /* Beside the sphere the column is narrow: the words flow on as many lines as they
           need, at one size, instead of being squeezed into two. */
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: titleSize * 0.25, rowGap: 1 }}>
          {line.title.split(" ").map((w, i) => (
            <Word key={i} text={w} delay={spoken++ * WORD_MS} size={titleSize} />
          ))}
        </View>
      ) : (
        title.lines.map((text) => (
          <View key={text} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: title.size * 0.25 }}>
            {text.split(" ").map((w, i) => (
              <Word key={i} text={w} delay={spoken++ * WORD_MS} size={title.size} />
            ))}
          </View>
        ))
      )}
      <Rising delay={line.title.split(" ").length * WORD_MS + 120}>
        <Text numberOfLines={left ? 2 : undefined} style={{ marginTop: 4, fontSize: sub.size, lineHeight: sub.size * 1.36, ...face(500), color: th(INK.soft), textAlign: left ? "left" : "center" }}>{left ? line.sub : sub.lines.join("\n")}</Text>
      </Rising>
      </Pressable>
    </Animated.View>
  );
}
