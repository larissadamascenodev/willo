import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import {
  greetings,
  layOut,
  longestUnsaid,
  markSaid,
  type Greeting,
} from "~/lib/greeting";
import { face } from "~/lib/chatFont";
import { INK } from "~/theme/tokens";

import { useGroundTh } from "~/theme/groundInk";
/**
 * What he says under the sphere: a word at a time as it arrives, then the next thing
 * after a while. The first line is the hello, chosen once for each time the screen opens.
 */

const HOLD_MS = 7000;
/** Beside the sphere: the readings short enough to be read whole there. */
const SHORT_TITLE = 52;
const WORD_MS = 75;
const TITLE = 20;
const SUB = 14;

function Word({
  text,
  delay,
  size,
}: {
  text: string;
  delay: number;
  size: number;
}) {
  const th = useGroundTh();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(
      withDelay(
        delay,
        withTiming(1, {
          duration: 380,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }),
      ),
    );
  }, [shown, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * 7 }],
  }));
  return (
    <Animated.View style={style}>
      <Text
        style={{
          fontSize: size,
          lineHeight: Math.round(size * 1.22),
          ...face(700),
          letterSpacing: -size * 0.024,
          color: th("#fff"),
        }}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

function Rising({ delay, children }: { delay: number; children: ReactNode }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(
      withDelay(
        delay,
        withTiming(1, { duration: 420, reduceMotion: ReduceMotion.System }),
      ),
    );
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
  maxHeight,
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
  /** Beside the sphere: the height there is. What does not fit is set smaller, never cut. */
  maxHeight?: number;
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
  const noticed = useMemo(
    () =>
      longestUnsaid(
        align === "left"
          ? readings.filter((r) => r.title.length <= SHORT_TITLE)
          : readings,
      ).slice(0, 6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [titles, align],
  );

  /* The hello, then what he has noticed with something to ask after every two. */
  const lines = useMemo(() => {
    const out: Greeting[] = [];
    if (!chosen) return out;
    const asks = chosen.slice(1);
    out.push(chosen[0]);
    noticed.forEach((r, n) => {
      out.push(r);
      if (n % 2 === 1 && asks.length) out.push(asks.shift()!);
    });
    out.push(...asks);
    return out;
  }, [chosen, noticed]);
  /* The line on show is held as itself, not as a place in the list: the list grows when the
     readings arrive, and a place in it then pointed at another line — the sentence being
     typed was swapped mid-word for a different one. The list is only consulted when it is
     time for the next. */
  const [current, setCurrent] = useState<Greeting | null>(null);
  const [at, setAt] = useState(0);
  /* How many steps smaller the line on show had to be set to fit; each new line starts over. */
  const [shrink, setShrink] = useState(0);
  /* The line's drawn height. Kept, not only acted on as it is measured: the room beside
     the sphere is often measured after the line, and a line measured first was never
     made to fit — it ran past the foot and was cut. */
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    setShrink(0);
    setDrawn(0);
  }, [at]);
  useEffect(() => {
    if (align !== "left" || !maxHeight || !drawn) return;
    if (drawn > maxHeight + 0.5 && shrink < 12) setShrink((n) => n + 1);
  }, [drawn, maxHeight, shrink, align]);
  const latest = useRef(lines);
  latest.current = lines;
  const out = useSharedValue(1);
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!current && lines.length) setCurrent(lines[0]);
  }, [current, lines]);

  useEffect(() => {
    if (!current) return;
    let swap: ReturnType<typeof setTimeout>;
    const t = setTimeout(() => {
      out.set(withTiming(0, { duration: 320 }));
      swap = setTimeout(() => {
        const list = latest.current;
        if (list.length) {
          const here = list.findIndex((l) => l.title === current.title);
          setCurrent(list[(here + 1) % list.length]);
        }
        setAt((n) => n + 1);
        out.set(withTiming(1, { duration: 200 }));
      }, 340);
    }, HOLD_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(swap);
    };
  }, [current, out]);
  const fading = useAnimatedStyle(() => ({ opacity: out.get() }));

  const shownTitle = current?.title ?? null;
  useEffect(() => {
    if (shownTitle) markSaid(shownTitle);
  }, [shownTitle]);

  const reportLine = useRef(onLine);
  reportLine.current = onLine;
  useEffect(() => {
    if (current) reportLine.current?.(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownTitle]);

  if (!current) return null;
  const line = current;
  /* The guess below is only a start: the line is measured once drawn, and while it
     overflows the room it has, the line under it goes first, then the title gets smaller,
     a step at a time. A word is never cut off. */
  const onMeasured = (h: number) => setDrawn(h);
  /* Bold at this size runs about half its size a letter; the sub line, a little less. */
  const left = align === "left";
  const room = roomProp ?? width - 44;
  /* Beside the sphere the words have a narrow column and a fixed height: a long sentence
     is set smaller so it keeps to three lines, and the line under it then gets one line
     instead of two — nothing is cut off at the foot. */
  const fit = (() => {
    if (!left) return { size: titleSize, subLines: 2, subFits: true };
    const perLine = (size: number) => Math.floor(room / (size * 0.56));
    let size = titleSize;
    while (
      size > 14.5 &&
      Math.ceil((line.title.length * 1.12) / perLine(size)) > 3
    )
      size -= 0.5;
    const rows = Math.ceil((line.title.length * 1.12) / perLine(size));
    const subLines = rows >= 3 ? 1 : 2;
    /* The line under it shows whole or not at all: half a sentence ending in dots reads as a fault. */
    const subFits =
      !!line.sub &&
      line.sub.length * 1.1 <= subLines * Math.floor(room / (13 * 0.52));
    return {
      size: Math.max(13, size - Math.max(0, shrink - 1) * 0.75),
      subLines,
      subFits: subFits && shrink === 0,
    };
  })();
  const title = layOut(
    line.title,
    Math.floor(room / (titleSize * 0.58)),
    titleSize,
  );
  const sub = layOut(line.sub, Math.floor(room / (SUB * 0.54)), SUB);
  let spoken = 0;
  return (
    <Animated.View key={at} style={[{ alignSelf: "stretch" }, fading]}>
      <Pressable
        onPress={() => onPick?.(line)}
        onLayout={(e) => onMeasured(e.nativeEvent.layout.height)}
        accessibilityRole={onPick ? "button" : undefined}
        style={{
          alignItems: left ? "flex-start" : "center",
          paddingHorizontal: left ? 0 : 22,
        }}
      >
        {left ? (
          /* Beside the sphere the column is narrow: the words flow on as many lines as they
           need, at one size, instead of being squeezed into two. */
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              columnGap: fit.size * 0.25,
            }}
          >
            {line.title.split(" ").map((w, i) => (
              <Word
                key={i}
                text={w}
                delay={spoken++ * WORD_MS}
                size={fit.size}
              />
            ))}
          </View>
        ) : (
          title.lines.map((text) => (
            <View
              key={text}
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                columnGap: title.size * 0.25,
              }}
            >
              {text.split(" ").map((w, i) => (
                <Word
                  key={i}
                  text={w}
                  delay={spoken++ * WORD_MS}
                  size={title.size}
                />
              ))}
            </View>
          ))
        )}
        {(!left || fit.subFits) && (
          <Rising delay={line.title.split(" ").length * WORD_MS + 120}>
            <Text
              numberOfLines={undefined}
              style={{
                marginTop: 4,
                fontSize: left ? 13 : sub.size,
                lineHeight: left ? 17.5 : sub.size * 1.36,
                ...face(500),
                color: th(INK.soft),
                textAlign: left ? "left" : "center",
              }}
            >
              {left ? line.sub : sub.lines.join("\n")}
            </Text>
          </Rising>
        )}
      </Pressable>
    </Animated.View>
  );
}
