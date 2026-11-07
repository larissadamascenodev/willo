import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import WilloBot from "~/components/willo/WilloBot";
import { Check, ChevronLeft, Trophy } from "~/components/icons";

/**
 * The pieces every onboarding screen is made of. The onboarding is always dark, like
 * the sign-in: it is the first thing anyone sees, before they have chosen a theme.
 */

export const C = {
  bg: "#0D0E10",
  card: "#16181D",
  line: "rgba(255,255,255,0.08)",
  soft: "rgba(255,255,255,0.68)",
  softer: "rgba(255,255,255,0.5)",
  fill: "rgba(255,255,255,0.06)",
  green: "#67CD67",
  orange: "#FF9A3C",
  teal: "#3FE0B8",
  violet: "#A066FF",
  blue: "#7CC4FF",
  lilac: "#B9B0FF",
  red: "#F87171",
  gold: "#F2C14E",
};

export type IconC = (p: { size?: number; color?: string; strokeWidth?: number }) => ReactNode;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const tap = () => void Haptics.selectionAsync().catch(() => undefined);

/** A soft coloured light behind the top of a screen. */
export function Aura({ hex, top = -220, height = 520 }: { hex: string; top?: number; height?: number }) {
  const id = `aura-${hex.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <Svg pointerEvents="none" width="100%" height={height} style={{ position: "absolute", left: 0, right: 0, top }}>
      <Defs>
        <RadialGradient id={id} cx="0.4" cy="0.5" rx="0.75" ry="0.5">
          <Stop offset="0" stopColor={hex} stopOpacity={0.26} />
          <Stop offset="1" stopColor={hex} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Back, the section's name and how far along: the top of every step. */
export function Header({ section, progress, onBack }: { section: string; progress: number; onBack: () => void }) {
  const p = useSharedValue(progress);
  useEffect(() => {
    p.set(withTiming(progress, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [p, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${p.get() * 100}%` }));
  return (
    <View style={{ paddingHorizontal: 20, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={onBack} accessibilityLabel="Voltar" hitSlop={8} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", opacity: pressed ? 0.6 : 1 })}>
          <ChevronLeft size={20} color="#fff" strokeWidth={2.4} />
        </Pressable>
        <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 2, color: "rgba(255,255,255,0.62)" }}>{section}</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
        <Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: "#fff" }, bar]} />
      </View>
    </View>
  );
}

/** How big a two-line title can be and still sit in two or three lines. */
export function titleSize(...lines: string[]) {
  const longest = Math.max(...lines.map((l) => l.length));
  return longest <= 20 ? 32 : longest <= 26 ? 29 : longest <= 32 ? 26 : 24;
}

/** Text that writes itself out, line after line. */
export function useTyping(lines: string[], speed = 22) {
  const key = lines.join("|");
  const total = lines.join("").length;
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const t = setInterval(() => {
      setN((v) => {
        if (v >= total) {
          clearInterval(t);
          return v;
        }
        return v + 1;
      });
    }, speed);
    return () => clearInterval(t);
  }, [key, total, speed]);
  const parts: string[] = [];
  let used = 0;
  for (const l of lines) {
    parts.push(l.slice(0, Math.max(0, n - used)));
    used += l.length;
  }
  return { parts, done: n >= total };
}

/**
 * Willo asks. His head speaks while what he says writes itself out in his bubble;
 * then the question itself writes out large under it, and the answers rise in.
 */
export function Ask({ lead, title, strong, children }: { lead: string; title: string; strong: string; children?: ReactNode }) {
  const { parts, done } = useTyping([lead, title, strong]);
  const size = titleSize(title, strong);
  return (
    <View>
      <View style={{ paddingHorizontal: 22, paddingTop: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 56, height: 56 }}>
            <WilloBot size={56} mode={done ? "idle" : "speaking"} />
          </View>
          <View style={{ flex: 1, minHeight: 46, justifyContent: "center", borderRadius: 20, borderBottomLeftRadius: 6, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 11 }}>
            <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "500", color: "#fff" }}>{parts[0] || " "}</Text>
          </View>
        </View>
        <Text style={{ marginTop: 22, minHeight: size * 2.4, fontSize: size, lineHeight: size * 1.18, fontWeight: "300", letterSpacing: -0.8, color: "#fff" }}>
          {parts[1]}
          {parts[2] ? "\n" : ""}
          <Text style={{ fontWeight: "800" }}>{parts[2]}</Text>
        </Text>
      </View>
      {done && children ? (
        <Animated.View entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))} style={{ paddingHorizontal: 20, paddingTop: 18 }}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** A title with a light first line and a bold second, for the screens that show rather than ask. */
export function Title({ title, strong, line }: { title: string; strong: string; line?: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(460)} style={{ paddingHorizontal: 24, paddingTop: 22, gap: 10 }}>
      <Text style={{ fontSize: titleSize(title, strong), lineHeight: titleSize(title, strong) * 1.18, fontWeight: "300", letterSpacing: -0.8, color: "#fff" }}>
        {title}
        {"\n"}
        <Text style={{ fontWeight: "800" }}>{strong}</Text>
      </Text>
      {line ? <Text style={{ fontSize: 15, lineHeight: 21, color: C.soft }}>{line}</Text> : null}
    </Animated.View>
  );
}

/** One answer: white when chosen, glass when not. */
export function Choice({ label, sub, on, onPress, icon, tile, style }: { label: string; sub?: string; on: boolean; onPress: () => void; icon?: ReactNode; tile?: { Icon: IconC; hex: string }; style?: ViewStyle }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: 56,
          borderRadius: 18,
          borderCurve: "continuous",
          paddingHorizontal: 14,
          paddingVertical: 11,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: on ? "#fff" : C.fill,
          borderWidth: 1,
          borderColor: on ? "#fff" : C.line,
          transform: [{ scale: pressed ? 0.975 : 1 }],
        },
        style,
      ]}
    >
      {tile ? <IconTile Icon={tile.Icon} hex={tile.hex} size={40} solid={on} /> : icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15.5, fontWeight: on ? "700" : "600", color: on ? "#0B0B0B" : "#fff" }}>{label}</Text>
        {sub ? <Text style={{ marginTop: 2, fontSize: 12.5, lineHeight: 17, color: on ? "rgba(11,11,11,0.6)" : C.softer }}>{sub}</Text> : null}
      </View>
      {on ? (
        <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#0B0B0B" }}>
          <Check size={13} color="#fff" strokeWidth={3.2} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** A square answer with its icon above and its name under: the goals. */
export function Tile({ label, Icon, hex, on, width, onPress }: { label: string; Icon: IconC; hex: string; on: boolean; width: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width,
        height: 112,
        borderRadius: 22,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingHorizontal: 6,
        backgroundColor: on ? "#fff" : C.fill,
        borderWidth: 1,
        borderColor: on ? "#fff" : C.line,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <IconTile Icon={Icon} hex={hex} size={44} solid={on} />
      <Text numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 15.5, fontWeight: on ? "800" : "600", color: on ? "#0B0B0B" : "#fff", textAlign: "center" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A row of options in one rounded track, the chosen one lifted out in white. */
export function Segments<T extends string | number>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: "row", padding: 4, gap: 4, borderRadius: 18, backgroundColor: C.fill, borderWidth: 1, borderColor: C.line }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={String(o.id)}
            onPress={() => {
              tap();
              onChange(o.id);
            }}
            style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#fff" : "transparent", opacity: pressed ? 0.8 : 1 })}
          >
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: on ? "800" : "600", color: on ? "#0B0B0B" : "rgba(255,255,255,0.8)" }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A small pill answer, for choosing several. */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        height: 40,
        paddingHorizontal: 15,
        borderRadius: 20,
        justifyContent: "center",
        backgroundColor: on ? "#fff" : C.fill,
        borderWidth: 1,
        borderColor: on ? "#fff" : C.line,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Text style={{ fontSize: 14, fontWeight: on ? "700" : "600", color: on ? "#0B0B0B" : "#fff" }}>{label}</Text>
    </Pressable>
  );
}

export function Label({ children }: { children: string }) {
  return <Text style={{ fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.66)", marginBottom: 9 }}>{children}</Text>;
}

const cents = (v: number) => (v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A value in reais, typed from the right like a bank app. */
export function MoneyInput({ value, onChange, big = false, autoFocus = false }: { value: number; onChange: (v: number) => void; big?: boolean; autoFocus?: boolean }) {
  return (
    <View style={{ height: big ? 68 : 58, borderRadius: 18, borderCurve: "continuous", borderWidth: 1, borderColor: value > 0 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.14)", backgroundColor: C.fill, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ fontSize: big ? 20 : 17, fontWeight: "700", color: C.softer }}>R$</Text>
      <TextInput
        value={cents(Math.round(value * 100))}
        onChangeText={(t) => onChange(Number(t.replace(/\D/g, "") || "0") / 100)}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        selectionColor="#fff"
        style={{ flex: 1, fontSize: big ? 28 : 21, fontWeight: "800", letterSpacing: -0.6, color: "#fff", padding: 0 }}
      />
    </View>
  );
}

/**
 * The way forward: a dark pill in a white ring, a light passing across it now and
 * then, the way a premium app's button catches the eye.
 */
export function Cta({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const lit = useSharedValue(disabled ? 0 : 1);
  const kick = useSharedValue(1);
  useEffect(() => {
    if (disabled) {
      x.set(0);
      lit.set(withTiming(0, { duration: 200 }));
      return;
    }
    lit.set(withTiming(1, { duration: 320 }));
    kick.set(withSequence(withTiming(1.035, { duration: 160, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 9, stiffness: 220 })));
    x.set(0);
    x.set(withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withDelay(1500, withTiming(1, { duration: 0 }))), -1, false));
  }, [disabled, x, lit, kick]);
  const shine = useAnimatedStyle(() => ({ opacity: lit.get(), transform: [{ translateX: -110 + x.get() * (w + 220) }, { rotate: "18deg" }] }));
  const ring = useAnimatedStyle(() => ({
    borderColor: `rgba(255,255,255,${0.22 + lit.get() * 0.7})`,
    shadowOpacity: lit.get() * 0.28,
    transform: [{ scale: kick.get() }],
  }));
  const ink = useAnimatedStyle(() => ({ opacity: 0.4 + lit.get() * 0.6 }));
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <Animated.View style={[{ height: 58, borderRadius: 29, borderCurve: "continuous", borderWidth: 1.5, backgroundColor: "#121317", alignItems: "center", justifyContent: "center", overflow: "hidden", shadowColor: "#fff", shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }, ring]}>
        {w > 0 && (
          <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -20, bottom: -20, left: 0, width: 70 }, shine]}>
            <LinearGradient colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Animated.View>
        )}
        <Animated.Text style={[{ fontSize: 14.5, fontWeight: "800", letterSpacing: 2.2, color: "#fff" }, ink]}>{label.toUpperCase()}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/** A card the way the app draws them. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ borderRadius: 24, borderCurve: "continuous", backgroundColor: C.card, borderWidth: 1, borderColor: C.line, padding: 18 }, style]}>{children}</View>;
}

export function Eyebrow({ children, color = "rgba(255,255,255,0.6)" }: { children: string; color?: string }) {
  return <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 1.6, color }}>{children}</Text>;
}

/** An icon on a tile of its own colour, lit from the top corner. */
export function IconTile({ Icon, hex, size = 44, solid = false }: { Icon: IconC; hex: string; size?: number; solid?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, borderCurve: "continuous", overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: solid ? "rgba(0,0,0,0.06)" : `${hex}40` }}>
      <LinearGradient colors={solid ? [`${hex}`, `${hex}CC`] : [`${hex}55`, `${hex}14`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} />
      <Icon size={size * 0.46} color={solid ? "#0B0B0B" : hex} strokeWidth={2.1} />
    </View>
  );
}

/* ── The evolution curve ──────────────────────────────────────────────────── */

const SAMPLES = 36;

/**
 * Where you are and where you are going, as a line that draws itself: up for a dream
 * filling, down for a debt emptying. Dots light along it as it passes, and the end is
 * a trophy.
 */
export function Evolution({
  dir,
  from,
  to,
  fromLabel = "AGORA",
  toLabel = "SUA META",
  marks,
  accent,
  play = true,
}: {
  play?: boolean;
  dir: "up" | "down";
  from: string;
  to: string;
  fromLabel?: string;
  toLabel?: string;
  marks: string[];
  accent: string;
}) {
  const [w, setW] = useState(0);
  const H = 150;
  const pad = 18;
  const p = useSharedValue(0);
  useEffect(() => {
    if (play) p.set(withDelay(200, withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.cubic) })));
  }, [p, play]);

  const { d, area, len, pts } = useMemo(() => {
    if (w <= 0) return { d: "", area: "", len: 1, pts: [] as { x: number; y: number }[] };
    const all: { x: number; y: number }[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const v = dir === "up" ? 1 - Math.pow(1 - t, 1.9) : Math.pow(1 - t, 1.6);
      all.push({ x: pad + t * (w - pad * 2), y: H - pad - v * (H - pad * 2) });
    }
    let L = 0;
    for (let i = 1; i < all.length; i++) L += Math.hypot(all[i].x - all[i - 1].x, all[i].y - all[i - 1].y);
    const path = all.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" ");
    const fill = `${path} L${(w - pad).toFixed(1)} ${H} L${pad} ${H} Z`;
    const dots = [0.25, 0.5, 0.75].map((t) => all[Math.round(t * SAMPLES)]);
    return { d: path, area: fill, len: L, pts: dots };
  }, [w, dir]);

  const line = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.get()) }));
  const shade = useAnimatedProps(() => ({ opacity: p.get() * 0.9 }));
  const end = dir === "up" ? { x: w - pad, y: pad } : { x: w - pad, y: H - pad };

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingHorizontal: 18, paddingTop: 16 }}>
        <View style={{ gap: 3, flexShrink: 1 }}>
          <Eyebrow>{fromLabel}</Eyebrow>
          <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: "800", color: "#fff", letterSpacing: -0.4 }}>{from}</Text>
        </View>
        <View style={{ gap: 3, alignItems: "flex-end", flexShrink: 1 }}>
          <Eyebrow color={accent}>{toLabel}</Eyebrow>
          <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: "800", color: accent, letterSpacing: -0.4 }}>{to}</Text>
        </View>
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H, marginTop: 6 }}>
        {w > 0 && (
          <>
            <Svg width={w} height={H} style={{ position: "absolute" }}>
              <Defs>
                <SvgGradient id={`evo-${dir}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={accent} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={accent} stopOpacity={0} />
                </SvgGradient>
                <SvgGradient id={`evo-line-${dir}`} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#fff" stopOpacity={0.9} />
                  <Stop offset="1" stopColor={accent} stopOpacity={1} />
                </SvgGradient>
              </Defs>
              <AnimatedPath d={area} fill={`url(#evo-${dir})`} animatedProps={shade} />
              <AnimatedPath d={d} stroke={`url(#evo-line-${dir})`} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={`${len} ${len}`} animatedProps={line} />
            </Svg>
            <Dot x={pad} y={dir === "up" ? H - pad : pad} at={0} p={p} color="#fff" />
            {pts.map((q, i) => (
              <Dot key={i} x={q.x} y={q.y} at={(i + 1) * 0.25} p={p} color="#fff" />
            ))}
            <TrophyDot x={end.x} y={end.y} p={p} accent={accent} />
          </>
        )}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 }}>
        {marks.map((m, i) => (
          <Text key={m + i} style={{ fontSize: 11, fontWeight: i === marks.length - 1 ? "800" : "600", color: i === marks.length - 1 ? "#fff" : C.softer }}>
            {m}
          </Text>
        ))}
      </View>
    </Card>
  );
}

function Dot({ x, y, at, p, color }: { x: number; y: number; at: number; p: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const on = p.get() >= at ? 1 : 0;
    return { opacity: on, transform: [{ scale: on ? 1 : 0.3 }] };
  });
  return <Animated.View style={[{ position: "absolute", left: x - 6, top: y - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: C.bg, borderWidth: 3, borderColor: color }, style]} />;
}

function TrophyDot({ x, y, p, accent }: { x: number; y: number; p: SharedValue<number>; accent: string }) {
  const style = useAnimatedStyle(() => {
    const on = p.get() >= 0.98 ? 1 : 0;
    return { opacity: on, transform: [{ scale: on ? 1 : 0.2 }] };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: x - 17, top: y - 17, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: accent, shadowColor: accent, shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }, style]}>
      <Trophy size={17} color="#0B0B0B" strokeWidth={2.4} />
    </Animated.View>
  );
}

/* ── The journey ──────────────────────────────────────────────────────────── */

/**
 * The financial profile as a climb: the five stages as steps rising left to right,
 * the line drawing itself up to where the person is now, Willo standing on that step,
 * and the next one lit as where he takes them.
 */
export function Journey({ stages, at, play = true }: { stages: string[]; at: number; play?: boolean }) {
  const [w, setW] = useState(0);
  const H = 176;
  const pad = 26;
  const p = useSharedValue(0);
  useEffect(() => {
    if (play) p.set(withDelay(200, withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) })));
  }, [p, play]);
  const n = stages.length;
  const pos = (i: number) => ({ x: pad + (i / (n - 1)) * (w - pad * 2), y: H - pad - 26 - (i / (n - 1)) * (H - pad * 2 - 40) });
  const { d, len } = useMemo(() => {
    if (w <= 0) return { d: "", len: 1 };
    const pts = Array.from({ length: n }, (_, i) => pos(i));
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return { d: pts.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" "), len: L };
    // pos depends on w and n only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, n]);
  const reach = n > 1 ? at / (n - 1) : 0;
  const line = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.get() * reach) }));
  const here = w > 0 ? pos(at) : { x: 0, y: 0 };
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
      {w > 0 && (
        <>
          <Svg width={w} height={H} style={{ position: "absolute" }}>
            <Path d={d} stroke="rgba(255,255,255,0.14)" strokeWidth={3} strokeDasharray="2 7" strokeLinecap="round" fill="none" />
            <AnimatedPath d={d} stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={`${len} ${len}`} animatedProps={line} />
          </Svg>
          {stages.map((s, i) => {
            const q = pos(i);
            const done = i < at;
            const now = i === at;
            const next = i === at + 1;
            return (
              <View key={s} style={{ position: "absolute", left: q.x - 7, top: q.y - 7 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: done || now ? "#fff" : C.bg, borderWidth: 2.5, borderColor: next ? "rgba(255,255,255,0.85)" : done || now ? "#fff" : "rgba(255,255,255,0.25)" }} />
              </View>
            );
          })}
          <Willoat x={here.x} y={here.y} p={p} />
          {stages.map((s, i) => {
            const q = pos(i);
            const now = i === at;
            const next = i === at + 1;
            return (
              <Text key={`l-${s}`} numberOfLines={2} style={{ position: "absolute", left: Math.min(Math.max(q.x - 40, 0), w - 80), top: q.y + 12, width: 80, textAlign: "center", fontSize: 10, lineHeight: 12, fontWeight: now || next ? "800" : "600", color: now ? "#fff" : next ? "#fff" : C.softer }}>
                {s}
              </Text>
            );
          })}
        </>
      )}
    </View>
  );
}

function Willoat({ x, y, p }: { x: number; y: number; p: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: p.get() >= 0.95 ? 1 : 0, transform: [{ translateY: p.get() >= 0.95 ? 0 : 8 }] }));
  return (
    <Animated.View style={[{ position: "absolute", left: x - 21, top: y - 50, width: 42, height: 42 }, style]}>
      <WilloBot size={42} />
    </Animated.View>
  );
}

/* ── The loading ring ─────────────────────────────────────────────────────── */

/** A light ring filling round to a hundred, the number in its middle. */
export function Ring({ p, size = 196, label }: { p: SharedValue<number>; size?: number; label: string }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const L = 2 * Math.PI * r;
  const props = useAnimatedProps(() => ({ strokeDashoffset: L * (1 - p.get()) }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center", shadowColor: "#fff", shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke="#fff" strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={`${L} ${L}`} animatedProps={props} />
      </Svg>
      <Text style={{ fontSize: 46, fontWeight: "800", letterSpacing: -1.5, color: "#fff", fontVariant: ["tabular-nums"] }}>{label}</Text>
    </View>
  );
}

/** Something that springs in when it appears. */
export function Pop({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const s = useSharedValue(0.6);
  const o = useSharedValue(0);
  useEffect(() => {
    s.set(withDelay(delay, withSpring(1, { damping: 12, stiffness: 180 })));
    o.set(withDelay(delay, withTiming(1, { duration: 260 })));
  }, [s, o, delay]);
  const style = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ scale: s.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
