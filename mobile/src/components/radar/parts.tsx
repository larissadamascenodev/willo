import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from "react-native-svg";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { SURFACE_FILL } from "~/components/Surface";
import { face } from "~/lib/chatFont";
import { INK } from "~/theme/tokens";

import { th } from "~/theme/theme";
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
export function Scope({
  selected,
  onSelect,
  blips,
  size: wanted,
}: {
  selected: SectorKey;
  onSelect: (key: SectorKey) => void;
  blips: Partial<Record<SectorKey, { risk: number; note: number }>>;
  /** A smaller dial where the screen has less room for it (the welcome). */
  size?: number;
}) {
  const { width } = useWindowDimensions();
  const size = wanted ?? Math.min(width - 28, 320);
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
            <Circle key={k} cx={c} cy={c} r={r * k} stroke={th("rgba(255,255,255,0.1)")} strokeWidth={1} fill="none" />
          ))}
          {SECTORS.map((_, i) => {
            const a = ((i * STEP - STEP / 2 - 90) * Math.PI) / 180;
            return <Line key={i} x1={c + core * Math.cos(a)} y1={c + core * Math.sin(a)} x2={c + r * Math.cos(a)} y2={c + r * Math.sin(a)} stroke={th("rgba(255,255,255,0.1)")} strokeWidth={1} />;
          })}
          {/* Tick marks round the rim, as on any dial. */}
          {Array.from({ length: 72 }).map((_, i) => {
            const a = (i * 5 * Math.PI) / 180;
            const long = i % 6 === 0;
            return <Line key={i} x1={c + (r - (long ? 7 : 3)) * Math.cos(a)} y1={c + (r - (long ? 7 : 3)) * Math.sin(a)} x2={c + r * Math.cos(a)} y2={c + r * Math.sin(a)} stroke={th("rgba(255,255,255,0.22)")} strokeWidth={0.7} />;
          })}
        </Svg>

        <Animated.View style={[{ position: "absolute", width: size, height: size }, light]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="scope-light" cx="50%" cy="50%" r="50%">
                <Stop offset="0.3" stopColor={th(SKY, "grad")} stopOpacity={0.05} />
                <Stop offset="1" stopColor={th(SKY, "grad")} stopOpacity={0.34} />
              </RadialGradient>
            </Defs>
            <Path d={wedge(c, c, r, core)} fill="url(#scope-light)" stroke={th(ICE)} strokeOpacity={0.5} strokeWidth={1} />
          </Svg>
        </Animated.View>

        {SECTORS.map((s, i) => {
          const a = ((i * STEP - 90) * Math.PI) / 180;
          const on = s.key === selected;
          const b = blips[s.key];
          const dots = [...Array(Math.min(b?.risk ?? 0, 3)).fill(RISK), ...Array(Math.min(b?.note ?? 0, 3 - Math.min(b?.risk ?? 0, 3))).fill(ICE)] as string[];
          return (
            <View key={s.key} style={{ position: "absolute", left: c + r * 0.66 * Math.cos(a) - 50, top: c + r * 0.66 * Math.sin(a) - 16, width: 100, height: 32, alignItems: "center", justifyContent: "center" }}>
              <Text numberOfLines={1} style={{ fontSize: size < 300 ? 11 : 12, letterSpacing: -0.1, ...face(on ? 800 : 600), color: th(on ? "#fff" : "rgba(255,255,255,0.62)") }}>
                {s.label}
              </Text>
              {dots.length > 0 && (
                <View style={{ marginTop: 4, flexDirection: "row", gap: 3 }}>
                  {dots.map((hex, n) => (
                    <View key={n} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: th(hex, "bg") }} />
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

/** The shades a chart uses in order: white through blue to grey, never a colour of its own. */
export const SHADES = ["#FFFFFF", "#BFE3FF", "#7CC4FF", "#5A8FC4", "#8FA6BA", "#55606B"];
/** How far a card stands from the screen's edge. */
export const CARD_INSET = 16;

/* Rows know whether they are in a card: the card already holds the margin. */
const InCard = createContext(false);

/** What the sector found, in one sentence. The sentence comes first, the figures after. */
export function Finding({ children, note, risk }: { children: string; note?: string | null; risk?: boolean }) {
  return (
    <View style={{ paddingHorizontal: CARD_INSET + 4, paddingTop: 18, paddingBottom: 4 }}>
      <Text style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.5, ...face(700), color: th(risk ? RISK : "#fff") }}>{clean(children)}</Text>
      {note ? <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 19, ...face(500), color: th(INK.soft) }}>{clean(note)}</Text> : null}
    </View>
  );
}

/** One subject, in one piece of the app's glass. */
export function Card({ title, note, right, children }: { title: string; note?: string | null; right?: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 12, marginHorizontal: CARD_INSET, padding: 16, borderRadius: 22, borderCurve: "continuous", borderWidth: 1, borderColor: th("rgba(255,255,255,0.10)", "line"), backgroundColor: th(SURFACE_FILL, "bg") }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ flexShrink: 1, fontSize: 15.5, letterSpacing: -0.2, ...face(700), color: th("#fff") }}>{title}</Text>
        {right ? <Text numberOfLines={1} style={{ fontSize: 14, ...face(700), ...NUMS, color: th(INK.soft) }}>{right}</Text> : null}
      </View>
      {note ? <Text style={{ marginTop: 3, fontSize: 13, lineHeight: 18, ...face(500), color: th(INK.softer) }}>{clean(note)}</Text> : null}
      <View style={{ marginTop: 14 }}>
        <InCard.Provider value>{children}</InCard.Provider>
      </View>
    </View>
  );
}

/** A plain row: name, what it means under it, and its figure. */
export function Row({ title, note, value, risk, first, onPress, children }: { title: string; note?: string | null; value?: string | null; risk?: boolean; first?: boolean; onPress?: () => void; children?: ReactNode }) {
  const inCard = useContext(InCard);
  const body = (
    <View style={{ paddingVertical: 11, borderTopWidth: first ? 0 : 1, borderTopColor: th(FAINT, "line"), paddingTop: first && inCard ? 0 : 11 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
        <Text style={{ flex: 1, minWidth: 0, fontSize: 14.5, lineHeight: 20, ...face(600), color: th("#fff") }}>{clean(title)}</Text>
        {value ? <Text style={{ fontSize: 14.5, ...face(700), ...NUMS, color: th(risk ? RISK : "#fff") }}>{value}</Text> : null}
      </View>
      {note ? <Text style={{ marginTop: 2, fontSize: 13, lineHeight: 18, ...face(500), color: th(INK.soft) }}>{clean(note)}</Text> : null}
      {children}
    </View>
  );
  return (
    <View style={{ paddingHorizontal: inCard ? 0 : 20 }}>
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

/** Figures side by side. */
export function Tiles({ children }: { children: ReactNode }) {
  return <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>{children}</View>;
}

export function Tile({ label, value, note, risk, dot }: { label: string; value: string; note?: string; risk?: boolean; dot?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 16, borderCurve: "continuous", backgroundColor: th(SURFACE_FILL, "bg"), borderWidth: 1, borderColor: th("rgba(255,255,255,0.08)", "line") }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th(dot, "bg") }} /> : null}
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, ...face(500), color: th(INK.soft) }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ marginTop: 5, fontSize: 17, letterSpacing: -0.3, ...face(700), ...NUMS, color: th(risk ? RISK : "#fff") }}>{value}</Text>
      {note ? <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, ...face(500), color: th(INK.softer) }}>{note}</Text> : null}
    </View>
  );
}

/** A bar of how much; the tick is what is usual. */
export function Meter({ share, tick, risk }: { share: number; tick?: number; risk?: boolean }) {
  return (
    <View style={{ marginTop: 8, height: 6, borderRadius: 3, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
      <View style={{ width: `${Math.min(Math.max(share, 0), 1) * 100}%`, height: 6, borderRadius: 3, backgroundColor: th(risk ? RISK : SKY, "bg") }} />
      {tick !== undefined && <View style={{ position: "absolute", left: `${Math.min(tick, 1) * 100}%`, top: -3, width: 2, height: 12, borderRadius: 1, backgroundColor: th("#fff", "bg") }} />}
    </View>
  );
}

/** A coloured dot, what it stands for and, on the right, how much. */
export function Key({ hex, label, value }: { hex: string; label: string; value?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: th(hex, "bg") }} />
      <Text numberOfLines={1} style={{ flexShrink: 1, flexGrow: value ? 1 : 0, fontSize: 13, ...face(500), color: th("rgba(255,255,255,0.84)") }}>{label}</Text>
      {value ? <Text style={{ fontSize: 13, ...face(700), ...NUMS, color: th("#fff") }}>{value}</Text> : null}
    </View>
  );
}

/** A ring in parts, with what they add up to in the middle. */
export function Donut({ slices, size, centre, caption, risk }: { slices: { label: string; value: number; hex: string }[]; size: number; centre: string; caption: string; risk?: boolean }) {
  const stroke = 13;
  const r = (size - stroke) / 2;
  const around = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const gap = slices.length > 1 ? 3 : 0;
  let start = 0;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        {slices.map((s) => {
          const length = (s.value / total) * around;
          const offset = -start;
          start += length;
          return <Circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={th(s.hex)} strokeWidth={stroke} strokeDasharray={`${Math.max(length - gap, 1)} ${around}`} strokeDashoffset={offset} />;
        })}
      </Svg>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ maxWidth: size - stroke * 2 - 8, fontSize: 18, letterSpacing: -0.4, ...face(800), ...NUMS, color: th(risk ? RISK : "#fff") }}>{centre}</Text>
      <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 11, ...face(500), color: th(INK.softer) }}>{caption}</Text>
    </View>
  );
}

/** Columns side by side, the one that matters lit, with an optional figure under it and a tick. */
export function Bars({ items, height = 92 }: { items: { key: string; label: string; value: number; top?: string; on?: boolean; risk?: boolean; tick?: number }[]; height?: number }) {
  const peak = Math.max(...items.map((i) => Math.max(i.value, i.tick ?? 0)), 1);
  const room = height;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
      {items.map((i) => (
        <View key={i.key} style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
          <View style={{ width: "100%", height: Math.max(3, (i.value / peak) * room), borderRadius: 5, backgroundColor: th(i.risk ? RISK : i.on ? SKY : "rgba(255,255,255,0.16)", "bg") }}>
            {i.tick !== undefined && <View style={{ position: "absolute", left: -2, right: -2, bottom: (i.tick / peak) * room - 1, height: 2, backgroundColor: th("#fff", "bg") }} />}
          </View>
          <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 12, ...face(i.on ? 700 : 500), color: th(i.on ? "#fff" : INK.softer) }}>{i.label}</Text>
          {i.top ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 1, fontSize: 11, ...face(600), ...NUMS, color: th(i.risk ? RISK : INK.soft) }}>{i.top}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** A choice of a few, in one pill. */
export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (key: T) => void }) {
  return (
    <View style={{ marginTop: 14, marginHorizontal: CARD_INSET, padding: 3, flexDirection: "row", borderRadius: 19, backgroundColor: th(SURFACE_FILL, "bg"), borderWidth: 1, borderColor: th("rgba(255,255,255,0.08)", "line") }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={{ flex: 1, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: th(on ? "rgba(255,255,255,0.14)" : "transparent", "bg") }}>
            <Text numberOfLines={1} style={{ fontSize: 13.5, ...face(on ? 700 : 500), color: th(on ? "#fff" : INK.soft) }}>{o.label}</Text>
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
        backgroundColor: th(strong ? "#fff" : "rgba(255,255,255,0.08)", "bg"),
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 14, ...face(700), color: th(strong ? "#08090A" : "#fff") }}>{label}</Text>
    </Pressable>
  );
}

export function Limitation({ children }: { children: string }) {
  const inCard = useContext(InCard);
  return <Text style={{ marginTop: 12, paddingHorizontal: inCard ? 0 : CARD_INSET + 4, fontSize: 12.5, lineHeight: 17, ...face(500), color: th(INK.softer) }}>{children}</Text>;
}
