import { useEffect, useMemo } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { categoryHex } from "@/lib/categoryData";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { playCash, preloadCash } from "~/lib/sounds";
import { GREEN } from "~/theme/tokens";

/**
 * The receipt, as it comes out of the app — and as it is shared.
 *
 * It arrives rather than appears. The card rises into place; the seal on its top edge
 * draws itself — the ring closes round, then the tick is written in, stroke by stroke —
 * and the coins chime at the moment the tick starts, with a burst of short rays as it
 * finishes. Then its lines print one after another. Everything happens once, the first
 * time it is drawn.
 *
 * One entry is laid out as a payment slip: the figure large, what it was, its category,
 * how it was paid, when, and a short code. Several are a list with a total.
 */

export interface ReceiptLine {
  id: string;
  name: string;
  category: string;
  amount: number;
  type: "despesa" | "receita";
  /** "Crédito · Nubank", "Débito" — whatever it was settled on. */
  method?: string | null;
  /** Split on a card into this many instalments. */
  installments?: number | null;
}

/* A white slip: dark ink on paper, a deeper green for money in, which lime would not carry. */
const PAPER = "#FFFFFF";
const PAPER_FOOT = "#F2F3F5";
const INK = "#121317";
const DIM = "rgba(18,19,23,0.52)";
const RULE = "rgba(18,19,23,0.16)";
const IN = "#1E9E57";
const RAYS = 12;
const SEAL = 64;
const R = 26;
const RING = 2 * Math.PI * R;
const TICK = 34;
/** When the tick starts being written: the moment of the sound. */
const TICK_AT = 520;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require("../../../assets/images/willo-logo-ink.png") as number;
const LOGO_RATIO = 725 / 222;

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Dashed() {
  return (
    <Svg width="100%" height={2} style={{ marginVertical: 2 }}>
      <Line x1="0" y1="1" x2="100%" y2="1" stroke={RULE} strokeWidth={1} strokeDasharray="3.5 3.5" />
    </Svg>
  );
}

/** The torn bottom edge. */
function TornEdge() {
  const teeth = 20;
  const w = 100 / teeth;
  let d = "M0,0 L100,0 L100,0.4";
  for (let i = teeth; i >= 1; i--) d += ` L${(i * w - w / 2).toFixed(2)},3 L${(i * w - w).toFixed(2)},0.4`;
  d += " Z";
  return (
    <Svg width="100%" height={10} viewBox="0 0 100 3" preserveAspectRatio="none" style={{ marginTop: -1 }}>
      <Path d={d} fill={PAPER_FOOT} />
    </Svg>
  );
}

/** One short ray, thrown outward once the tick is done. */
function Ray({ angle, delay }: { angle: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withTiming(1, { duration: 640, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: t.get() < 0.15 ? t.get() / 0.15 : 1 - (t.get() - 0.15) / 0.85,
    transform: [{ rotate: `${angle}deg` }, { translateX: 36 + t.get() * 16 }, { scaleX: 0.5 + t.get() * 0.7 }],
  }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 8, height: 2.5, borderRadius: 2, backgroundColor: GREEN }, style]} />;
}

/** The seal: drawn, not stamped — and it is what chimes. */
function Seal({ sound, onLanded }: { sound: boolean; onLanded?: () => void }) {
  const pop = useSharedValue(0);
  const ring = useSharedValue(0);
  const tick = useSharedValue(0);

  useEffect(() => {
    if (sound) preloadCash();
    pop.set(withDelay(180, withSpring(1, { damping: 11, stiffness: 240, reduceMotion: ReduceMotion.System })));
    ring.set(withDelay(200, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) })));
    tick.set(withDelay(TICK_AT, withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) })));
    /* One moment for all of it: the tick begins, the chime, and whatever lands with them. */
    const t = setTimeout(() => {
      if (sound) playCash();
      onLanded?.();
    }, TICK_AT);
    return () => {
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pop, ring, tick, sound]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING * (1 - ring.get()) }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: TICK * (1 - tick.get()) }));
  const body = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.get() * 1.6),
    transform: [{ scale: 0.5 + pop.get() * 0.5 }, { rotate: `${-12 + pop.get() * 12}deg` }],
  }));

  return (
    <View style={{ width: SEAL, height: SEAL, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: RAYS }, (_, i) => (
        <Ray key={i} angle={(360 / RAYS) * i} delay={TICK_AT + 240} />
      ))}
      <Animated.View style={body}>
        <Svg width={SEAL} height={SEAL} viewBox={`0 0 ${SEAL} ${SEAL}`}>
          <Circle cx={SEAL / 2} cy={SEAL / 2} r={R + 4} fill="#121317" />
          <Circle cx={SEAL / 2} cy={SEAL / 2} r={R} fill="rgba(200,243,109,0.14)" />
          <AnimatedCircle
            cx={SEAL / 2}
            cy={SEAL / 2}
            r={R}
            stroke={GREEN}
            strokeWidth={3}
            fill="none"
            strokeDasharray={`${RING} ${RING}`}
            strokeLinecap="round"
            rotation={-90}
            origin={`${SEAL / 2}, ${SEAL / 2}`}
            animatedProps={ringProps}
          />
          <AnimatedPath
            d="M21 33 L29 41 L44 24"
            stroke={GREEN}
            strokeWidth={4.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${TICK} ${TICK}`}
            animatedProps={tickProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** One row of facts, printed in its turn. */
function Fact({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <Animated.View entering={FadeIn.delay(delay).duration(320)} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4.5 }}>
      <Text style={{ fontSize: 12.5, color: DIM }}>{label}</Text>
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, fontWeight: "600", color: INK, textAlign: "right" }}>
        {value}
      </Text>
    </Animated.View>
  );
}

export default function ReceiptCard({
  lines,
  when = new Date(),
  sound = true,
  onLanded,
}: {
  lines: ReceiptLine[];
  when?: Date;
  sound?: boolean;
  /** Called the moment the tick starts and the chime plays — for the notice and the sparkles. */
  onLanded?: () => void;
}) {
  const total = lines.reduce((t, l) => t + (l.type === "receita" ? l.amount : -l.amount), 0);
  const date = when.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const time = when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const code = useMemo(() => `WL-${when.getTime().toString(36).slice(-6).toUpperCase()}`, [when]);
  const single = lines.length === 1 ? lines[0] : null;

  /* The card rises, a touch large, and settles. */
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.set(withSpring(1, { damping: 16, stiffness: 150, reduceMotion: ReduceMotion.System }));
  }, [rise]);
  const card = useAnimatedStyle(() => ({
    opacity: Math.min(1, rise.get() * 1.4),
    transform: [{ translateY: (1 - rise.get()) * 60 }, { scale: 0.94 + rise.get() * 0.06 }],
  }));

  const Icon = single ? categoryIcon(single.category) : null;
  const hex = single ? (single.type === "receita" ? IN : categoryHex(single.category)) : IN;

  return (
    <View style={{ width: "100%", maxWidth: 360, alignSelf: "center" }}>
      <Animated.View style={card}>
        {/* The seal, sitting on the top edge. */}
        <View style={{ alignItems: "center", height: SEAL / 2, zIndex: 2 }}>
          <View style={{ position: "absolute", top: 0 }}>
            <Seal sound={sound} onLanded={onLanded} />
          </View>
        </View>

        <View style={{ borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" }}>
          <LinearGradient colors={[PAPER, PAPER_FOOT]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ paddingHorizontal: 22, paddingTop: SEAL / 2 + 8, paddingBottom: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 3.5, color: DIM }}>COMPROVANTE</Text>
              <Text style={{ fontSize: 11, color: DIM }}>{code}</Text>
            </View>

            {single ? (
              <>
                {/* The figure, large, and what it was. */}
                <Animated.View entering={FadeIn.delay(820).duration(380)} style={{ marginTop: 12, alignItems: "center" }}>
                  <Text style={{ fontSize: 12, color: DIM }}>{single.type === "receita" ? "Você recebeu" : single.installments ? "Você parcelou" : "Você pagou"}</Text>
                  <Text style={[nums, { marginTop: 2, fontSize: 36, fontWeight: "800", letterSpacing: -1.3, color: single.type === "receita" ? IN : INK }]}>
                    {single.type === "receita" ? "+" : "−"}
                    {money(single.amount)}
                  </Text>
                  <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {Icon && (
                      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: `${hex}22` }}>
                        <Icon size={13} color={hex} strokeWidth={2.4} />
                      </View>
                    )}
                    <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: "700", color: INK }}>{single.name}</Text>
                  </View>
                </Animated.View>
                <View style={{ marginTop: 14 }}>
                  <Dashed />
                </View>
                <View style={{ marginTop: 6 }}>
                  <Fact label="Categoria" value={single.category} delay={960} />
                  {single.method ? <Fact label={single.type === "receita" ? "Entrou em" : "Pagamento"} value={single.method} delay={1060} /> : null}
                  {single.installments ? <Fact label="Parcelas" value={`${single.installments}x de ${money(single.amount / single.installments)}`} delay={1110} /> : null}
                  <Fact label="Data" value={date} delay={1160} />
                  <Fact label="Hora" value={time} delay={1260} />
                </View>
              </>
            ) : (
              <>
                <View style={{ marginTop: 14 }}>
                  <Dashed />
                </View>
                {lines.map((l, i) => (
                  <Animated.View key={l.id} entering={FadeIn.delay(820 + i * 140).duration(320)} style={{ paddingTop: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                      <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: "600", color: INK }}>{l.name}</Text>
                      <Text style={[nums, { fontSize: 16, fontWeight: "700", color: l.type === "receita" ? IN : INK }]}>
                        {l.type === "receita" ? "+" : "−"}
                        {money(l.amount)}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12.5, color: DIM }}>{l.method ? `${l.category} · ${l.method}` : l.category}</Text>
                  </Animated.View>
                ))}
                <Animated.View entering={FadeIn.delay(820 + lines.length * 140).duration(320)} style={{ marginTop: 16 }}>
                  <Dashed />
                  <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Text style={{ fontSize: 12.5, fontWeight: "500", color: DIM }}>Total · {date}</Text>
                    <Text style={[nums, { fontSize: 20, fontWeight: "800", color: total >= 0 ? IN : INK }]}>
                      {total >= 0 ? "+" : "−"}
                      {money(Math.abs(total))}
                    </Text>
                  </View>
                </Animated.View>
              </>
            )}

            {/* Willo's mark in the corner. */}
            <Animated.View entering={FadeIn.delay(1360).duration(360)} style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Image source={LOGO} contentFit="contain" style={{ height: 20, width: 20 * LOGO_RATIO }} accessibilityLabel="Willo" />
              <Text style={{ fontSize: 11, color: DIM }}>Registrado pelo Willo</Text>
            </Animated.View>
          </View>
        </View>
        <TornEdge />
      </Animated.View>
    </View>
  );
}
