import { useEffect, useRef, type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from "react-native-svg";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { face } from "~/lib/chatFont";
import { INK } from "~/theme/tokens";

/** The Radar's shared vocabulary: one colour of light, and coral only when something is at risk. */
export const ICE = "#BFE3FF";
export const SKY = "#7CC4FF";
export const RISK = "#FF8A7A";
export const FAINT = "rgba(255,255,255,0.08)";
export const NUMS = { fontVariant: ["tabular-nums"] } as const;

export const clean = (s: string) => s.replace(/\s*[—–]\s*/g, ", ").trim();

export type SectorKey = "consumo" | "habitos" | "compromissos" | "futuro" | "saude" | "simular";

export const SECTORS: { key: SectorKey; label: string }[] = [
  { key: "consumo", label: "Consumo" },
  { key: "habitos", label: "Hábitos" },
  { key: "compromissos", label: "Compromissos" },
  { key: "futuro", label: "Futuro" },
  { key: "saude", label: "Saúde" },
  { key: "simular", label: "Simular" },
];

const STEP = 60;

function wedge(cx: number, cy: number, r: number, inner: number) {
  const point = (rad: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
  };
  return `M${point(inner, -STEP / 2)}L${point(r, -STEP / 2)}A${r} ${r} 0 0 1 ${point(r, STEP / 2)}L${point(inner, STEP / 2)}A${inner} ${inner} 0 0 0 ${point(inner, -STEP / 2)}Z`;
}

/**
 * The instrument itself: a dial of six sectors with Willo at its centre. Touching a sector
 * swings the light round to it. The dots are what each sector has to tell: coral when
 * something needs attention, ice when it is only worth a look.
 */
export function Scope({ selected, onSelect, blips }: { selected: SectorKey; onSelect: (key: SectorKey) => void; blips: Partial<Record<SectorKey, { risk: number; note: number }>> }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 28, 320);
  const c = size / 2;
  const r = c - 3;
  const core = r * 0.31;
  const index = SECTORS.findIndex((s) => s.key === selected);

  /* Round by the shorter way. */
  const turned = useRef(index * STEP);
  const angle = useSharedValue(index * STEP);
  useEffect(() => {
    const target = index * STEP;
    const now = turned.current;
    const diff = ((target - now + 540) % 360) - 180;
    turned.current = now + diff;
    angle.set(withTiming(turned.current, { duration: 520, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [index, angle]);
  const light = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));

  return (
    <View style={{ width: size, height: size, alignSelf: "center" }}>
      <View pointerEvents="none" style={{ position: "absolute", width: size, height: size }}>
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          {[1, 0.66].map((k) => (
            <Circle key={k} cx={c} cy={c} r={r * k} stroke="rgba(255,255,255,0.1)" strokeWidth={1} fill="none" />
          ))}
          {SECTORS.map((_, i) => {
            const a = ((i * STEP - STEP / 2 - 90) * Math.PI) / 180;
            return <Line key={i} x1={c + core * Math.cos(a)} y1={c + core * Math.sin(a)} x2={c + r * Math.cos(a)} y2={c + r * Math.sin(a)} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />;
          })}
          {/* Tick marks round the rim, as on any dial. */}
          {Array.from({ length: 72 }).map((_, i) => {
            const a = (i * 5 * Math.PI) / 180;
            const long = i % 6 === 0;
            return <Line key={i} x1={c + (r - (long ? 7 : 3)) * Math.cos(a)} y1={c + (r - (long ? 7 : 3)) * Math.sin(a)} x2={c + r * Math.cos(a)} y2={c + r * Math.sin(a)} stroke="rgba(255,255,255,0.22)" strokeWidth={0.7} />;
          })}
        </Svg>

        <Animated.View style={[{ position: "absolute", width: size, height: size }, light]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="scope-light" cx="50%" cy="50%" r="50%">
                <Stop offset="0.3" stopColor={SKY} stopOpacity={0.05} />
                <Stop offset="1" stopColor={SKY} stopOpacity={0.34} />
              </RadialGradient>
            </Defs>
            <Path d={wedge(c, c, r, core)} fill="url(#scope-light)" stroke={ICE} strokeOpacity={0.5} strokeWidth={1} />
          </Svg>
        </Animated.View>

        {SECTORS.map((s, i) => {
          const a = ((i * STEP - 90) * Math.PI) / 180;
          const on = s.key === selected;
          const b = blips[s.key];
          const dots = [...Array(Math.min(b?.risk ?? 0, 3)).fill(RISK), ...Array(Math.min(b?.note ?? 0, 3 - Math.min(b?.risk ?? 0, 3))).fill(ICE)] as string[];
          return (
            <View key={s.key} style={{ position: "absolute", left: c + r * 0.66 * Math.cos(a) - 50, top: c + r * 0.66 * Math.sin(a) - 16, width: 100, height: 32, alignItems: "center", justifyContent: "center" }}>
              <Text numberOfLines={1} style={{ fontSize: size < 300 ? 11 : 12, letterSpacing: -0.1, ...face(on ? 800 : 600), color: on ? "#fff" : "rgba(255,255,255,0.62)" }}>
                {s.label}
              </Text>
              {dots.length > 0 && (
                <View style={{ marginTop: 4, flexDirection: "row", gap: 3 }}>
                  {dots.map((hex, n) => (
                    <View key={n} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: hex }} />
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ position: "absolute", left: c - core, top: c - core, width: core * 2, height: core * 2, alignItems: "center", justifyContent: "center" }}>
          <ParticleOrb size={core * 2} />
        </View>
      </View>

      {/* Each sector its own place to touch. */}
      {SECTORS.map((s, i) => {
        const a = ((i * STEP - 90) * Math.PI) / 180;
        return (
          <Pressable
            key={s.key}
            onPress={() => onSelect(s.key)}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            accessibilityState={{ selected: s.key === selected }}
            style={{ position: "absolute", left: c + r * 0.66 * Math.cos(a) - 52, top: c + r * 0.66 * Math.sin(a) - 38, width: 104, height: 76 }}
          />
        );
      })}
    </View>
  );
}

/** What the sector found, said as a sentence. The sentence comes first, the figures after. */
export function Finding({ children, note, risk }: { children: string; note?: string | null; risk?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
      <Text style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.6, ...face(700), color: risk ? RISK : "#fff" }}>{clean(children)}</Text>
      {note ? <Text style={{ marginTop: 6, fontSize: 14.5, lineHeight: 20, ...face(500), color: INK.soft }}>{clean(note)}</Text> : null}
    </View>
  );
}

export function Heading({ children }: { children: string }) {
  return <Text style={{ marginTop: 28, marginBottom: 10, paddingHorizontal: 20, fontSize: 15, letterSpacing: -0.2, ...face(700), color: "#fff" }}>{children}</Text>;
}

/** A plain row on the page: name, what it means under it, and its figure. */
export function Row({ title, note, value, risk, first, onPress, children }: { title: string; note?: string | null; value?: string | null; risk?: boolean; first?: boolean; onPress?: () => void; children?: ReactNode }) {
  const body = (
    <View style={{ paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: FAINT }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
        <Text style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, ...face(600), color: "#fff" }}>{clean(title)}</Text>
        {value ? <Text style={{ fontSize: 15, ...face(700), ...NUMS, color: risk ? RISK : "#fff" }}>{value}</Text> : null}
      </View>
      {note ? <Text style={{ marginTop: 3, fontSize: 13.5, lineHeight: 19, ...face(500), color: INK.soft }}>{clean(note)}</Text> : null}
      {children}
    </View>
  );
  return (
    <View style={{ paddingHorizontal: 20 }}>
      {onPress ? (
        <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
          {body}
        </Pressable>
      ) : (
        body
      )}
    </View>
  );
}

/** A choice of a few, as lit words on a line. */
export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (key: T) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 18, paddingHorizontal: 20, paddingTop: 14 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} hitSlop={8}>
            <Text style={{ fontSize: 14, ...face(on ? 700 : 500), color: on ? "#fff" : INK.softer }}>{o.label}</Text>
            <View style={{ marginTop: 5, height: 2, borderRadius: 1, backgroundColor: on ? ICE : "transparent" }} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** A small action under a reading. */
export function Action({ label, onPress, strong, disabled }: { label: string; onPress: () => void; strong?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: 42,
        paddingHorizontal: 16,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: strong ? "#fff" : "rgba(255,255,255,0.08)",
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 14, ...face(700), color: strong ? "#08090A" : "#fff" }}>{label}</Text>
    </Pressable>
  );
}

export function Limitation({ children }: { children: string }) {
  return <Text style={{ marginTop: 12, paddingHorizontal: 20, fontSize: 13, lineHeight: 18, ...face(500), color: INK.softer }}>{children}</Text>;
}
