import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { CHALLENGE_ICON } from "~/components/desafios/parts";
import { Check, Flame, Sparkles } from "~/components/icons";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import type { IconKey, Running, Template } from "~/lib/challenges";
import { coverUrl, ensureCover } from "~/lib/challengeCovers";
import { GREEN, RED } from "~/theme/tokens";

/**
 * A challenge's picture, and the tall card it sits on.
 *
 * The card is drawn the way a caixinha is: the picture filling it, a dark veil rising
 * from the foot so the words read, a small glass tag in the corner (here, the flame
 * and the days in a row), and the name, the day and a thin bar at the bottom.
 *
 * The picture is the challenge's own photo once one has been made; until then, a
 * scene of its colour with its glyph large and quiet in the corner — delivery in a warm red, online
 * shopping in violet, rides in blue — so a shelf of them never reads as one card.
 */

const TINT: Record<IconKey, [string, string, string]> = {
  delivery: ["#7A2E1C", "#3A160E", "#F08A5D"],
  online: ["#4B2A7A", "#1F1236", "#B79BF2"],
  car: ["#1D3E6E", "#0D1B33", "#8FC7FF"],
  pen: ["#2F3A4A", "#14181F", "#C9D3E0"],
  calendar: ["#1E4E5A", "#0C2128", "#7FD3E0"],
  bag: ["#6E2450", "#2E0F22", "#F0A3CC"],
  coffee: ["#5A3A22", "#24170D", "#E3B48A"],
  lunch: ["#4F5A1E", "#20250C", "#D6E08A"],
  tv: ["#2E2A6E", "#121030", "#ABA6F5"],
  bus: ["#1E5A6E", "#0B2530", "#8FD8F0"],
  flag: ["#3A3F47", "#16181C", "#D5DAE2"],
};

export function ChallengeCover({ template, cover, width, height }: { template: Template; cover?: string | null; width: number | string; height: number | string }) {
  /* The photo goes over the drawn scene: while it loads, or when there is none yet,
     the scene shows. With none yet, it is asked for, and shown once made. */
  const address = cover ?? coverUrl(template);
  const [src, setSrc] = useState<string>(address);
  const [failed, setFailed] = useState(false);
  /* Keyed on the address, not the template object, which a made-up challenge rebuilds. */
  useEffect(() => {
    setSrc(address);
    setFailed(false);
  }, [address]);

  const onMissing = () => {
    setFailed(true);
    if (cover) return;
    void ensureCover(template).then((url) => {
      if (url) {
        setSrc(`${url}?v=${Date.now()}`);
        setFailed(false);
      }
    });
  };

  const [a, b, ink] = TINT[template.icon];
  const Icon = CHALLENGE_ICON[template.icon];
  return (
    <View style={{ width: width as number, height: height as number, overflow: "hidden" }}>
      <LinearGradient colors={[a, b]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: "absolute", top: "6%", right: "-14%", opacity: 0.22 }}>
        <Icon size={typeof width === "number" ? width * 0.9 : 220} color={ink} strokeWidth={1.2} />
      </View>
      {!failed && (
        <Image
          source={{ uri: src }}
          contentFit="cover"
          transition={300}
          cachePolicy="disk"
          onError={onMissing}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
    </View>
  );
}

export const TILE_W = 184;
export const TILE_H = 248;

/** A small glass panel over a picture. */
function GlassPanel({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ borderRadius: 18, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }, style]}>
      <BlurView intensity={36} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(14,15,18,0.38)" }} />
      {children}
    </View>
  );
}

/** A thin ring that fills with the days done. */
function MiniRing({ size, value, color }: { size: number; value: number; color: string }) {
  const r = (size - 3) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <SvgCircle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={3} fill="none" />
      {v > 0 && <SvgCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} />}
    </Svg>
  );
}

const KIND_LABEL = { abstain: "O Willo confere", record: "O Willo confere", bills: "O Willo confere", manual: "Check-in diário" } as const;
const DIFF_DOTS = { facil: 1, medio: 2, dificil: 3 } as const;

/** A running challenge on the shelf: its picture, and a glass panel with where it stands. */
export default function ChallengeTile({ r, width = TILE_W, height = TILE_H, onPress }: { r: Running; width?: number; height?: number; onPress: () => void }) {
  const broken = r.state === "broken";
  const share = r.done / r.template.days;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={r.template.name} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={{ width, height, borderRadius: 30, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
        <ChallengeCover template={r.template} cover={r.cover} width={width} height={height} />
        <LinearGradient colors={["rgba(8,9,10,0.25)", "rgba(8,9,10,0)", "rgba(8,9,10,0.55)"]} locations={[0, 0.35, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        <View style={{ position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" }}>
          <GlassPanel style={{ borderRadius: 14 }}>
            <View style={{ height: 28, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Flame size={13} color={r.streak > 0 ? "#FF9F45" : "rgba(255,255,255,0.6)"} strokeWidth={2.4} />
              <Text style={{ fontSize: 12.5, fontWeight: "800", color: "#fff" }}>{r.streak}</Text>
            </View>
          </GlassPanel>
          {r.tickedToday && (
            <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: GREEN }}>
              <Check size={15} color="#0B0B0B" strokeWidth={3} />
            </View>
          )}
        </View>

        <GlassPanel style={{ position: "absolute", left: 8, right: 8, bottom: 8 }}>
          <View style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: "800", lineHeight: 18, letterSpacing: -0.2, color: "#fff" }}>
                {r.template.name}
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 11.5, fontWeight: "600", color: broken ? "#FF9C9C" : "rgba(255,255,255,0.7)" }}>
                {broken ? "Quebrou · recomece" : `Dia ${r.done} de ${r.template.days}`}
              </Text>
            </View>
            <View style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
              <MiniRing size={34} value={share} color={broken ? RED : "#FFFFFF"} />
              <Text style={{ position: "absolute", fontSize: 9.5, fontWeight: "800", color: "#fff" }}>{Math.round(share * 100)}%</Text>
            </View>
          </View>
        </GlassPanel>
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 30, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
      </View>
    </Pressable>
  );
}

/** A suggested challenge, large: its picture, why it is suggested, what it saves and how the month would close. */
export function HeroOffer({ template, cover, reason, saves, month, onPress }: { template: Template; cover?: string | null; reason: string; saves: string; month: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={template.name} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ height: 236, borderRadius: 30, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
        <ChallengeCover template={template} cover={cover} width="100%" height="100%" />
        <LinearGradient colors={["rgba(8,9,10,0.3)", "rgba(8,9,10,0)", "rgba(8,9,10,0.7)"]} locations={[0, 0.35, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        <GlassPanel style={{ position: "absolute", top: 14, left: 14, borderRadius: 14 }}>
          <View style={{ height: 28, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Sparkles size={13} color="#FFE29A" strokeWidth={2.2} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>Para você</Text>
          </View>
        </GlassPanel>

        <View style={{ position: "absolute", left: 18, right: 18, bottom: 84 }}>
          <Text numberOfLines={1} style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>
            {template.name}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 13, color: "rgba(255,255,255,0.78)" }}>
            {reason}
          </Text>
        </View>

        <GlassPanel style={{ position: "absolute", left: 10, right: 10, bottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.62)" }}>Você economiza</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2, fontSize: 16, fontWeight: "800", color: "#8FE08F" }}>{saves}</Text>
            </View>
            <View style={{ width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.14)" }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.62)" }}>Seu mês fecha com</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2, fontSize: 16, fontWeight: "800", color: "#fff" }}>{month}</Text>
            </View>
            <View style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: "center", backgroundColor: "#FFFFFF" }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#0B0B0B" }}>Começar</Text>
            </View>
          </View>
        </GlassPanel>
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 30, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
      </View>
    </Pressable>
  );
}

/** A running challenge, wide: its picture behind, the words on the left, the ring on the right, a mark per day below. */
export function ActiveCard({ r, onPress }: { r: Running; onPress: () => void }) {
  const broken = r.state === "broken";
  const share = Math.max(0, Math.min(1, r.done / r.template.days));
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={r.template.name} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ height: 168, borderRadius: 28, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
        <ChallengeCover template={r.template} cover={r.cover} width="100%" height="100%" />
        <LinearGradient colors={["rgba(8,9,10,0.92)", "rgba(8,9,10,0.7)", "rgba(8,9,10,0.25)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        <View style={{ position: "absolute", top: 16, left: 16, right: 16, bottom: 16 }}>
          <View style={{ flex: 1, flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,159,69,0.18)" }}>
                  <Flame size={12} color="#FF9F45" strokeWidth={2.4} />
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#FFB877" }}>{r.streak}</Text>
                </View>
                <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: r.tickedToday ? "rgba(103,205,103,0.2)" : "rgba(255,255,255,0.12)" }}>
                  {r.tickedToday && <Check size={11} color="#8FE08F" strokeWidth={3} />}
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: r.tickedToday ? "#8FE08F" : "rgba(255,255,255,0.8)" }}>{r.tickedToday ? "Check-in feito" : "Falta o check-in"}</Text>
                </View>
              </View>
              <Text numberOfLines={2} style={{ marginTop: 10, fontSize: 19, fontWeight: "800", lineHeight: 23, letterSpacing: -0.5, color: "#fff" }}>
                {r.template.name}
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 13, fontWeight: "500", color: broken ? "#FF9C9C" : "rgba(255,255,255,0.72)" }}>
                {broken ? "Quebrou · toque para recomeçar" : `Dia ${Math.min(r.done + (r.tickedToday ? 0 : 1), r.template.days)} de ${r.template.days}`}
              </Text>
            </View>
            <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
              <MiniRing size={64} value={share} color={broken ? RED : "#FFFFFF"} />
              <Text style={{ position: "absolute", fontSize: 14, fontWeight: "800", color: "#fff" }}>{Math.round(share * 100)}%</Text>
            </View>
          </View>
          {/* One mark per day of the challenge. */}
          <View style={{ flexDirection: "row", gap: r.template.days > 15 ? 2 : 3 }}>
            {Array.from({ length: r.template.days }).map((_, i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < r.done ? (broken ? RED : "#FFFFFF") : "rgba(255,255,255,0.18)" }} />
            ))}
          </View>
        </View>
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
      </View>
    </Pressable>
  );
}

/**
 * A suggested challenge as a media card: the picture on top with its tags, and under it
 * a clean panel in the page's own colours — name, why, what it saves, how the month
 * closes, and the button. Nothing laid over anything.
 */
export function SuggestionCard({
  template,
  cover,
  reason,
  saves,
  month,
  ink,
  soft,
  panel,
  rule,
  buttonBg,
  buttonInk,
  onPress,
}: {
  template: Template;
  cover?: string | null;
  reason: string;
  saves: string;
  month: string;
  ink: string;
  soft: string;
  panel: string;
  rule: string;
  buttonBg: string;
  buttonInk: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={template.name} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ borderRadius: 28, borderCurve: "continuous", overflow: "hidden", backgroundColor: panel, borderWidth: 1, borderColor: rule }}>
        <View style={{ height: 150 }}>
          <ChallengeCover template={template} cover={cover} width="100%" height="100%" />
          <LinearGradient colors={["rgba(8,9,10,0.35)", "rgba(8,9,10,0)", "rgba(8,9,10,0.35)"]} locations={[0, 0.5, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" }}>
            <GlassPanel style={{ borderRadius: 14 }}>
              <View style={{ height: 28, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Sparkles size={13} color="#FFE29A" strokeWidth={2.2} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>Para você</Text>
              </View>
            </GlassPanel>
            <GlassPanel style={{ borderRadius: 14 }}>
              <Text style={{ paddingHorizontal: 11, height: 28, lineHeight: 28, fontSize: 12, fontWeight: "700", color: "#fff" }}>{template.days} dias</Text>
            </GlassPanel>
          </View>
        </View>
        <View style={{ padding: 16 }}>
          <Text numberOfLines={2} style={{ fontSize: 19, fontWeight: "800", letterSpacing: -0.5, lineHeight: 23, color: ink }}>
            {template.name}
          </Text>
          <Text numberOfLines={2} style={{ marginTop: 4, fontSize: 13.5, lineHeight: 19, color: soft }}>
            {reason}
          </Text>
          <View style={{ marginTop: 14, flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: soft }}>Você economiza</Text>
              <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 18, fontWeight: "800", letterSpacing: -0.4, color: "#4FB84F" }}>
                {saves}
              </Text>
            </View>
            <View style={{ width: 1, marginHorizontal: 14, backgroundColor: rule }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: soft }}>Seu mês fecha com</Text>
              <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 18, fontWeight: "800", letterSpacing: -0.4, color: ink }}>
                {month}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: 16, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: buttonBg }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: buttonInk }}>Começar desafio</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** A running challenge as a portrait card, in the same shape as the list of all challenges, for a carousel. */
export function ActivePortrait({ r, width, onPress }: { r: Running; width: number; onPress: () => void }) {
  const height = Math.round(width * 1.32);
  const broken = r.state === "broken";
  const share = Math.max(0, Math.min(1, r.done / r.template.days));
  const day = Math.min(r.done + (r.tickedToday ? 0 : 1), r.template.days);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={r.template.name} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={{ width, height, borderRadius: 26, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
        <ChallengeCover template={r.template} cover={r.cover} width={width} height={height} />
        <LinearGradient colors={["rgba(8,9,10,0.2)", "rgba(8,9,10,0)", "rgba(8,9,10,0.62)", "rgba(8,9,10,0.95)"]} locations={[0, 0.3, 0.62, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        <View style={{ position: "absolute", top: 10, left: 10, right: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <GlassPanel style={{ borderRadius: 13 }}>
            <View style={{ height: 26, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Flame size={12} color={r.streak > 0 ? "#FF9F45" : "rgba(255,255,255,0.6)"} strokeWidth={2.4} />
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>{r.streak}</Text>
            </View>
          </GlassPanel>
          {r.tickedToday && (
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: GREEN }}>
              <Check size={14} color="#0B0B0B" strokeWidth={3} />
            </View>
          )}
        </View>

        <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
          <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "800", lineHeight: 19, letterSpacing: -0.2, color: "#fff" }}>
            {r.template.name}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 11.5, fontWeight: "600", color: broken ? "#FF9C9C" : "rgba(255,255,255,0.7)" }}>
            {broken ? "Quebrou · recomece" : r.tickedToday ? `Dia ${day} de ${r.template.days} · feito` : `Dia ${day} de ${r.template.days} · falta o check-in`}
          </Text>
          <View style={{ marginTop: 9, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.2)" }}>
            <View style={{ width: `${Math.max(share, 0.03) * 100}%`, height: 4, borderRadius: 2, backgroundColor: broken ? RED : "#FFFFFF" }} />
          </View>
        </View>
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 26, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
      </View>
    </Pressable>
  );
}

/** One of all the challenges, as a portrait card for a two-column grid. */
export function GridOffer({ template, cover, width, saves, onPress }: { template: Template; cover?: string | null; width: number; saves?: string; onPress: () => void }) {
  const height = Math.round(width * 1.28);
  const dots = DIFF_DOTS[template.difficulty];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={template.name} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={{ width, height, borderRadius: 26, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
        <ChallengeCover template={template} cover={cover} width={width} height={height} />
        <LinearGradient colors={["rgba(8,9,10,0)", "rgba(8,9,10,0.6)", "rgba(8,9,10,0.94)"]} locations={[0.3, 0.62, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        <GlassPanel style={{ position: "absolute", top: 10, left: 10, borderRadius: 12 }}>
          <Text style={{ paddingHorizontal: 9, paddingVertical: 5, fontSize: 11.5, fontWeight: "800", color: "#fff" }}>{template.days} dias</Text>
        </GlassPanel>

        <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
          <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: "800", lineHeight: 18, letterSpacing: -0.2, color: "#fff" }}>
            {template.name}
          </Text>
          <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ flexDirection: "row", gap: 2 }}>
              {[1, 2, 3].map((n) => (
                <View key={n} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: n <= dots ? "#FFFFFF" : "rgba(255,255,255,0.25)" }} />
              ))}
            </View>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, color: "rgba(255,255,255,0.66)" }}>
              {saves ?? KIND_LABEL[template.kind]}
            </Text>
          </View>
        </View>
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 26, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
      </View>
    </Pressable>
  );
}
