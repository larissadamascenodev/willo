import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { CHALLENGE_ICON } from "~/components/desafios/parts";
import { Check, Flame } from "~/components/icons";
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
 * scene of its colour with its glyph large and quiet — delivery in a warm red, online
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
      <View style={{ position: "absolute", top: "10%", left: "10%", opacity: 0.9 }}>
        <Icon size={typeof width === "number" ? Math.max(28, width * 0.2) : 44} color={ink} strokeWidth={1.7} />
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

export const TILE_W = 172;
export const TILE_H = 236;

/** A running challenge on the shelf. */
export default function ChallengeTile({ r, width = TILE_W, height = TILE_H, onPress }: { r: Running; width?: number; height?: number; onPress: () => void }) {
  const broken = r.state === "broken";
  const share = Math.max(0, Math.min(1, r.done / r.template.days));
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={r.template.name} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={{ width, height, borderRadius: 28, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
        <ChallengeCover template={r.template} cover={r.cover} width={width} height={height} />
        <LinearGradient colors={["rgba(8,9,10,0)", "rgba(8,9,10,0.55)", "rgba(8,9,10,0.92)"]} locations={[0.25, 0.58, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        {/* The days in a row, as a small glass tag. */}
        <View style={{ position: "absolute", top: 12, left: 12, height: 28, paddingHorizontal: 10, borderRadius: 14, overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
          <BlurView intensity={40} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(18,20,26,0.3)" }} />
          <Flame size={13} color={r.streak > 0 ? "#FF9F45" : "rgba(255,255,255,0.6)"} strokeWidth={2.4} />
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#fff" }}>{r.streak}</Text>
        </View>

        {/* Today's check-in, or not yet. */}
        {r.tickedToday && (
          <View style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: GREEN }}>
            <Check size={15} color="#0B0B0B" strokeWidth={3} />
          </View>
        )}

        <View style={{ position: "absolute", left: 14, right: 14, bottom: 14 }}>
          <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "700", lineHeight: 19, color: "#fff" }}>
            {r.template.name}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12.5, color: broken ? "#FF9C9C" : "rgba(255,255,255,0.7)" }}>
            {broken ? "Quebrado. Recomece quando quiser" : `Dia ${r.done} de ${r.template.days}`}
          </Text>
          <View style={{ marginTop: 9, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.18)" }}>
            <View style={{ width: `${share * 100}%`, height: 4, borderRadius: 2, backgroundColor: broken ? RED : "#fff" }} />
          </View>
        </View>
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
      </View>
    </Pressable>
  );
}

/** A challenge not started yet, as a wide card with its picture. */
export function OfferCard({ template, cover, title, line, saves, onPress }: { template: Template; cover?: string | null; title?: string; line: string; saves?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ height: 150, borderRadius: 26, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
        <ChallengeCover template={template} cover={cover} width="100%" height="100%" />
        <LinearGradient colors={["rgba(8,9,10,0.15)", "rgba(8,9,10,0.88)"]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}>
          <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }}>
            {title ?? template.name}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            {line}
          </Text>
          {saves && (
            <View style={{ marginTop: 9, alignSelf: "flex-start", height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: "center", backgroundColor: "rgba(103,205,103,0.22)" }}>
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#8FE08F" }}>{saves}</Text>
            </View>
          )}
        </View>
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 26, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
      </View>
    </Pressable>
  );
}

