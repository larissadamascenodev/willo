import { useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { greetings, type Greeting } from "~/lib/greeting";
import { INK } from "~/theme/tokens";

/**
 * What he says under the sphere: a word at a time as it arrives, then the next thing
 * after a while. The first line is the hello, chosen once for each time the screen opens.
 */

const HOLD_MS = 7000;
const WORD_MS = 75;

function Word({ text, delay }: { text: string; delay: number }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [shown, delay]);
  const style = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: (1 - shown.get()) * 7 }] }));
  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>{text}</Text>
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

export default function GreetingLine({ name, notice }: { name: string | null; notice?: string | null }) {
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
  const lines = chosen ? (notice ? [chosen[0], { title: "Vi uma coisa no Radar.", sub: notice }, ...chosen.slice(1)] : chosen) : [];
  const [at, setAt] = useState(0);
  const out = useSharedValue(1);

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

  if (lines.length === 0) return null;
  const line = lines[at % lines.length];
  const words = line.title.split(" ");
  return (
    <Animated.View key={at} style={[{ alignItems: "center", paddingHorizontal: 22 }, fading]}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 5 }}>
        {words.map((w, i) => (
          <Word key={i} text={w} delay={i * WORD_MS} />
        ))}
      </View>
      <Rising delay={words.length * WORD_MS + 120}>
        <Text numberOfLines={2} style={{ marginTop: 4, fontSize: 14, lineHeight: 19, color: INK.soft, textAlign: "center" }}>
          {line.sub}
        </Text>
      </Rising>
    </Animated.View>
  );
}
