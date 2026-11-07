import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Check, Flame, Sparkles } from "~/components/icons";
import { DIFFICULTY_LABEL, type IconKey, type Running, type Template } from "~/lib/challenges";
import ChallengeArt, { sceneOf } from "~/components/desafios/ChallengeArt";
import { GREEN, RED } from "~/theme/tokens";

/**
 * A challenge's picture, and the cards it sits on.
 *
 * The cards are drawn the way a caixinha is: the picture filling it, a dark veil rising
 * from the foot so the words read, a small glass tag in the corner (here, the flame and
 * the days in a row), and the name, the figure that matters, large, and a thin bar.
 *
 * The picture is a scene drawn for its kind — a pot on the stove for cooking at home,
 * a bicycle at night for no ride apps — so a shelf of them never reads as one card.
 */

/* Each scene's colours; the last, its light one, is what the bar of how far along takes. */
const TINT: Record<IconKey, [string, string, string]> = {
  delivery: ["#7A2E1C", "#3A160E", "#FF9A6B"],
  online: ["#4B2A7A", "#1F1236", "#C9A8FF"],
  car: ["#1D3E6E", "#0D1B33", "#9CCBFF"],
  pen: ["#2F3A4A", "#14181F", "#DCE6F5"],
  calendar: ["#1E4E5A", "#0C2128", "#9BE7F2"],
  bag: ["#6E2450", "#2E0F22", "#FFB8DA"],
  coffee: ["#5A3A22", "#24170D", "#FFD9A8"],
  lunch: ["#4F5A1E", "#20250C", "#E2F08A"],
  tv: ["#2E2A6E", "#121030", "#B9B4FF"],
  bus: ["#1E5A6E", "#0B2530", "#FFE1A6"],
  flag: ["#3A3F47", "#16181C", "#FFB877"],
};

/** The scene's light colour: the bar of how far along takes it. */
export const accentOf = (t: Template) => TINT[sceneOf(t)][2];

export function ChallengeCover({ template, cover, width, height }: { template: Template; cover?: string | null; width: number | string; height: number | string }) {
  /* The drawn scene of its kind; a picture of its own, when it has one, goes over it. */
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [cover]);
  return (
    <View style={{ width: width as number, height: height as number, overflow: "hidden" }}>
      <ChallengeArt scene={sceneOf(template)} />
      {cover && !failed && (
        <Image
          source={{ uri: cover }}
          contentFit="cover"
          transition={300}
          cachePolicy="disk"
          onError={() => setFailed(true)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
    </View>
  );
}

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

/** A small glass tag over a picture, the same as a caixinha's. */
function GlassTag({ children, edge = "rgba(255,255,255,0.18)" }: { children: React.ReactNode; edge?: string }) {
  return (
    <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: edge }}>
      <BlurView intensity={40} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(18,20,26,0.3)" }} />
      {/* Raised over the glass, or a drawn icon is painted under it. */}
      <View style={{ zIndex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>{children}</View>
    </View>
  );
}

/* The caixinha's veil: clear at the top, rising dark from the foot so the words read. */
const VEIL = ["rgba(8,9,10,0)", "rgba(8,9,10,0.55)", "rgba(8,9,10,0.92)"] as const;
const VEIL_AT = [0.3, 0.62, 1] as const;

/** The edge drawn over the picture, not on the clipped frame, so no bright fringe shows. */
const Edge = ({ radius }: { radius: number }) => (
  <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
);

const KIND_LABEL = { abstain: "O Willo confere", record: "O Willo confere", bills: "O Willo confere", manual: "Check-in diário" } as const;
const DIFF_DOTS = { facil: 1, medio: 2, dificil: 3 } as const;

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
        <View style={{ height: 160 }}>
          <ChallengeCover template={template} cover={cover} width="100%" height="100%" />
          <LinearGradient colors={["rgba(8,9,10,0.3)", "rgba(8,9,10,0)", "rgba(8,9,10,0.3)"]} locations={[0, 0.5, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
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

/**
 * A running challenge, drawn as a caixinha is: all picture, the flame in a glass tag in
 * the corner, and across the foot its name, the day it is on, large, what is left of
 * today, and a thin bar of how far along.
 */
export function ActivePortrait({ r, width, onPress }: { r: Running; width: number; onPress: () => void }) {
  const height = Math.round(width * 1.32);
  const broken = r.state === "broken";
  const share = Math.max(0, Math.min(1, r.done / r.template.days));
  const day = Math.min(r.done + (r.tickedToday ? 0 : 1), r.template.days);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={r.template.name} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={{ width, height, borderRadius: 28, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
        <ChallengeCover template={r.template} cover={r.cover} width={width} height={height} />
        <LinearGradient colors={VEIL} locations={VEIL_AT} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        <View style={{ position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <GlassTag edge={r.streak > 0 ? "rgba(255,159,69,0.45)" : undefined}>
            <Flame size={12} color={r.streak > 0 ? "#FF9F45" : "rgba(255,255,255,0.6)"} strokeWidth={2.4} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>{r.streak}</Text>
          </GlassTag>
          {r.tickedToday && (
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: GREEN }}>
              <Check size={14} color="#0B0B0B" strokeWidth={3} />
            </View>
          )}
        </View>

        <View style={{ position: "absolute", left: 14, right: 14, bottom: 14 }}>
          <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: "600", lineHeight: 17, color: "rgba(255,255,255,0.86)" }}>
            {r.template.name}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 22, fontWeight: "800", letterSpacing: -0.8, color: "#fff" }}>
            {broken ? "Quebrou" : `Dia ${day}`}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: broken ? "#FF9C9C" : r.tickedToday ? "rgba(255,255,255,0.6)" : "#FFB877" }}>
            {broken ? "toque para recomeçar" : r.tickedToday ? `de ${r.template.days} · feito hoje` : `de ${r.template.days} · falta o check-in`}
          </Text>
          <View style={{ marginTop: 10, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.18)" }}>
            <View style={{ width: `${Math.max(share, 0.03) * 100}%`, height: 4, borderRadius: 2, backgroundColor: broken ? RED : accentOf(r.template) }} />
          </View>
        </View>
        <Edge radius={28} />
      </View>
    </Pressable>
  );
}

/** One of all the challenges, as a caixinha-style card for a two-column grid: how long and how hard over the picture, its name and what it saves across the foot. */
export function GridOffer({ template, cover, width, saves, onPress }: { template: Template; cover?: string | null; width: number; saves?: string; onPress: () => void }) {
  const height = Math.round(width * 1.42);
  const dots = DIFF_DOTS[template.difficulty];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={template.name} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={{ width, height, borderRadius: 28, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
        <ChallengeCover template={template} cover={cover} width={width} height={height} />
        <LinearGradient colors={["rgba(8,9,10,0)", "rgba(8,9,10,0.6)", "rgba(8,9,10,0.94)"]} locations={[0.45, 0.72, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        <View style={{ position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" }}>
          <GlassTag>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>{template.days} dias</Text>
          </GlassTag>
          <GlassTag>
            <View style={{ flexDirection: "row", gap: 2.5 }}>
              {[1, 2, 3].map((n) => (
                <View key={n} style={{ width: 4, height: 4 + n * 2.5, borderRadius: 2, alignSelf: "flex-end", backgroundColor: n <= dots ? "#FFFFFF" : "rgba(255,255,255,0.3)" }} />
              ))}
            </View>
          </GlassTag>
        </View>

        <View style={{ position: "absolute", left: 14, right: 14, bottom: 14 }}>
          <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: "600", lineHeight: 17, color: "rgba(255,255,255,0.88)" }}>
            {template.name}
          </Text>
          {saves ? (
            <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.62)" }}>
              Economiza <Text style={{ fontSize: 17, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>{saves.replace(/,00$/, "")}</Text>
            </Text>
          ) : (
            <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
              {KIND_LABEL[template.kind]} · {DIFFICULTY_LABEL[template.difficulty]}
            </Text>
          )}
        </View>
        <Edge radius={28} />
      </View>
    </Pressable>
  );
}
