import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { DWELL, type InsightSlide } from "@/lib/insights";
import CalendarClock from "lucide-react-native/icons/calendar-clock";
import CreditCard from "lucide-react-native/icons/credit-card";
import Hand from "lucide-react-native/icons/hand";
import PieChart from "lucide-react-native/icons/chart-pie";
import Receipt from "lucide-react-native/icons/receipt";
import Sparkles from "lucide-react-native/icons/sparkles";
import Sun from "lucide-react-native/icons/sun";
import TrendingDown from "lucide-react-native/icons/trending-down";
import Wallet from "lucide-react-native/icons/wallet";
import { INK } from "~/theme/tokens";

/**
 * The top of the screen, spent on what the app noticed.
 *
 * Which readings exist, how they are worded and how they are ranked all come from
 * the shared module; this is the phone's half — the glyph names turned into
 * drawings, and the sentence turned into type.
 *
 * It sits on the background rather than in a card: a card here would draw an edge
 * across the top of the screen and cut the page in two. The slide's colour is washed
 * across the whole top instead and faded out well before the first card, so there is
 * no edge anywhere to read as a seam.
 *
 * Stepping by hand stops at the ends, the way a story does — tapping forward on the
 * last one should not throw you back to the first. Only the clock wraps. Stepping
 * never pauses; a finger held down does, and letting go starts the next clock.
 */

const GLYPHS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  CalendarClock, CreditCard, Hand, PieChart, Receipt, Sparkles, Sun, TrendingDown, Wallet,
};

export default function Stories({ slides }: { slides: InsightSlide[] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const i = Math.min(index, Math.max(count - 1, 0));
  const slide = slides[i];

  const step = useCallback(
    (delta: number) => setIndex((n) => Math.min(Math.max(n + delta, 0), Math.max(count - 1, 0))),
    [count],
  );

  /* The clock, which wraps where the finger does not. */
  useEffect(() => {
    if (paused || count <= 1) return;
    const t = setTimeout(() => setIndex((n) => (n + 1) % count), DWELL);
    return () => clearTimeout(t);
  }, [i, paused, count]);

  if (!slide) return null;
  const Icon = GLYPHS[slide.icon] ?? Sun;

  return (
    <View style={{ position: "relative" }}>
      {/* Where you are in the set, and how long this one has left. */}
      {count > 1 && (
        <View style={{ flexDirection: "row", gap: 4 }}>
          {slides.map((s, n) => (
            <View
              key={s.id + n}
              style={{
                flex: 1,
                height: 2.5,
                borderRadius: 999,
                overflow: "hidden",
                backgroundColor: "rgba(255,255,255,0.16)",
              }}
            >
              {n === i ? (
                <Tick key={`${s.id}-${paused}`} paused={paused} />
              ) : n < i ? (
                <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.40)" }} />
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Fixed height, so slides of different lengths do not make the page jump as
          they turn. Taller than the web's: a phone has the room, and at 138 the
          longer readings were crowding their own quip. */}
      <View style={{ height: 200, marginTop: 18 }}>
        <Animated.View key={slide.id} entering={FadeIn.duration(300)} style={{ flex: 1 }}>
          <Pressable
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            delayLongPress={180}
            onPress={(e) => step(e.nativeEvent.locationX > width * 0.38 ? 1 : -1)}
            style={{ flex: 1 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon size={15} color={slide.accent} strokeWidth={2.3} />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 10.5,
                  fontWeight: "600",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: INK.soft,
                  flexShrink: 1,
                }}
              >
                {slide.label}
              </Text>
            </View>

            <Text
              style={{
                marginTop: 12,
                fontSize: 22,
                fontWeight: "500",
                lineHeight: 28,
                letterSpacing: -0.48,
                color: "rgba(255,255,255,0.72)",
              }}
            >
              {slide.body.map((part, n) =>
                part.bold ? (
                  <Text key={n} style={{ fontWeight: "800", color: "#fff" }}>
                    {part.text}
                  </Text>
                ) : (
                  <Text key={n}>{part.text}</Text>
                ),
              )}
            </Text>

            {slide.quip ? (
              <Text style={{ marginTop: 10, fontSize: 13.5, lineHeight: 18, color: INK.softer }}>
                {slide.quip}
              </Text>
            ) : null}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

/** The bar filling for as long as this slide holds the screen. */
function Tick({ paused }: { paused: boolean }) {
  const grow = useSharedValue(paused ? 1 : 0);

  useEffect(() => {
    if (paused) {
      grow.value = 1;
      return;
    }
    grow.value = 0;
    grow.value = withTiming(1, { duration: DWELL, easing: Easing.linear });
  }, [paused, grow]);

  const style = useAnimatedStyle(() => ({ width: `${grow.value * 100}%` }));

  return (
    <Animated.View style={[{ height: "100%", backgroundColor: "rgba(255,255,255,0.75)" }, style]} />
  );
}
