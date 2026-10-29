import { useEffect } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";
import { Check } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN } from "~/theme/tokens";

/**
 * The receipt, as it comes out of the app.
 *
 * The phone's copy of the one the web draws: a dark card with the bottom torn off,
 * "N O T I N H A" and the date across the top, what was noted line by line with
 * where it was filed, a total when there is more than one, and Willo's mark in the
 * corner with the minute it was written.
 *
 * It arrives rather than appears. A green seal pops onto the top edge with a burst
 * of short rays, the card rises into place, and its lines print one after another —
 * so the moment something is saved is something that happens, not a word that
 * flashes. It plays once, the first time it is drawn.
 */

export interface ReceiptLine {
  id: string;
  name: string;
  category: string;
  amount: number;
  type: "despesa" | "receita";
  /** "Crédito · Nubank", "Débito" — whatever it was settled on. */
  method?: string | null;
}

const CARD = "#161619";
const DIM = "rgba(255,255,255,0.46)";
const RULE = "rgba(255,255,255,0.16)";
const RAYS = 10;

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

/** A dashed rule drawn rather than bordered: a dashed border is not drawn the same on every platform. */
function Dashed() {
  return (
    <Svg width="100%" height={2} style={{ marginVertical: 2 }}>
      <Line x1="0" y1="1" x2="100%" y2="1" stroke={RULE} strokeWidth={1} strokeDasharray="3.5 3.5" />
    </Svg>
  );
}

/** The torn bottom edge. */
function TornEdge() {
  const teeth = 18;
  const w = 100 / teeth;
  let d = "M0,0 L100,0 L100,0.4";
  for (let i = teeth; i >= 1; i--) d += ` L${(i * w - w / 2).toFixed(2)},3 L${(i * w - w).toFixed(2)},0.4`;
  d += " Z";
  return (
    <Svg width="100%" height={10} viewBox="0 0 100 3" preserveAspectRatio="none" style={{ marginTop: -1 }}>
      <Path d={d} fill={CARD} />
    </Svg>
  );
}

/** One short ray, thrown outward once and gone. */
function Ray({ angle, delay }: { angle: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: t.get() < 0.15 ? t.get() / 0.15 : 1 - (t.get() - 0.15) / 0.85,
    transform: [{ rotate: `${angle}deg` }, { translateX: 30 + t.get() * 14 }, { scaleX: 0.5 + t.get() * 0.7 }],
  }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 7, height: 2.5, borderRadius: 2, backgroundColor: GREEN }, style]} />;
}

export default function ReceiptCard({ lines, when = new Date() }: { lines: ReceiptLine[]; when?: Date }) {
  const total = lines.reduce((t, l) => t + (l.type === "receita" ? l.amount : -l.amount), 0);
  const date = when.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
  const time = when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={{ width: "100%", maxWidth: 340, alignSelf: "center" }}>
      {/* The seal, sitting on the top edge. */}
      <View style={{ alignItems: "center", height: 26, zIndex: 2 }}>
        <View style={{ position: "absolute", top: -6, width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
          {Array.from({ length: RAYS }, (_, i) => (
            <Ray key={i} angle={(360 / RAYS) * i} delay={280} />
          ))}
          <Animated.View
            entering={ZoomIn.delay(140).springify().damping(11).stiffness(420)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: GREEN,
              borderWidth: 3,
              borderColor: "#0D0E10",
            }}
          >
            <Check size={24} color="#0B0B0B" strokeWidth={3.2} />
          </Animated.View>
        </View>
      </View>

      <Animated.View entering={FadeInDown.delay(60).springify().damping(17).stiffness(150)}>
        <View
          style={{
            backgroundColor: CARD,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: "rgba(255,255,255,0.09)",
            paddingHorizontal: 22,
            paddingTop: 34,
            paddingBottom: 14,
            shadowColor: "#000",
            shadowOpacity: 0.5,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 4, color: DIM }}>NOTINHA</Text>
            <Text style={{ fontSize: 12, color: DIM }}>{date}</Text>
          </View>
          <View style={{ marginTop: 14 }}>
            <Dashed />
          </View>

          {lines.map((l, i) => (
            <Animated.View key={l.id} entering={FadeIn.delay(380 + i * 150).duration(320)} style={{ paddingTop: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: "600", color: "#F6F6F4" }}>
                  {l.name}
                </Text>
                <Text style={[nums, { fontSize: 16, fontWeight: "600", color: l.type === "receita" ? GREEN : "#F6F6F4" }]}>
                  {l.type === "receita" ? "+" : "−"}
                  {money(l.amount)}
                </Text>
              </View>
              <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12.5, color: DIM }}>
                {l.method ? `${l.category} · ${l.method}` : l.category}
              </Text>
            </Animated.View>
          ))}

          {lines.length > 1 && (
            <Animated.View entering={FadeIn.delay(380 + lines.length * 150).duration(320)} style={{ marginTop: 16 }}>
              <Dashed />
              <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Text style={{ fontSize: 12.5, fontWeight: "500", color: DIM }}>Total</Text>
                <Text style={[nums, { fontSize: 20, fontWeight: "800", color: total >= 0 ? GREEN : "#F6F6F4" }]}>
                  {total >= 0 ? "+" : "−"}
                  {money(Math.abs(total))}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Willo's mark in the corner, and the minute it was written. */}
          <Animated.View entering={FadeIn.delay(520 + lines.length * 150).duration(360)} style={{ marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", letterSpacing: -0.4, color: "#F6F6F4" }}>willo</Text>
              <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 2, backgroundColor: GREEN }} />
            </View>
            <Text style={{ fontSize: 11.5, color: DIM }}>{time}</Text>
          </Animated.View>
        </View>
        <TornEdge />
      </Animated.View>
    </View>
  );
}
