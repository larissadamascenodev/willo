import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Line as SvgLine, Path, RadialGradient, Stop } from "react-native-svg";
import type { RaioXData } from "@/hooks/useRaioX";
import Glass from "~/components/Glass";
import { ChevronRight } from "~/components/icons";
import { BOARD_FILTERS, type BoardGroup, type BoardLevel, type BoardLine } from "~/lib/radarBoard";
import { INCOME, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * The Radar: everything central about the money, on one screen, already worked out.
 *
 * The same score and the same readings as the web's Radar, with the figures that answer
 * the everyday questions beside them, filtered by what you are looking for. Each line is
 * also a question: tap it and the conversation has it, answered from these same numbers
 * with no AI in between.
 */

const LEVEL_HEX: Record<BoardLevel, string> = {
  alerta: RED,
  atencao: "#FFFFFF",
  dica: "#7CC4FF",
  conquista: INCOME,
  numero: "rgba(255,255,255,0.28)",
};

const DIAL = 196;

/** Where a reading sits on the dial: always the same place for the same reading. */
function blipAt(id: string) {
  let h = 7;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 9973;
  const angle = (h % 360) * (Math.PI / 180);
  const reach = 0.5 + ((h >> 3) % 40) / 100;
  return { x: DIAL / 2 + Math.cos(angle) * (DIAL / 2) * reach, y: DIAL / 2 + Math.sin(angle) * (DIAL / 2) * reach };
}

function Dial({ score, level, blips }: { score: number | null; level: string; blips: BoardLine[] }) {
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.set(withRepeat(withTiming(360, { duration: 5200, easing: Easing.linear }), -1, false));
  }, [turn]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
  const c = DIAL / 2;

  return (
    <View style={{ width: DIAL, height: DIAL, alignSelf: "center" }}>
      <Svg width={DIAL} height={DIAL} style={{ position: "absolute" }}>
        {[0.98, 0.68, 0.38].map((r) => (
          <Circle key={r} cx={c} cy={c} r={c * r} stroke="rgba(255,255,255,0.09)" strokeWidth={1} fill="none" />
        ))}
        <SvgLine x1={c} y1={2} x2={c} y2={DIAL - 2} stroke="rgba(255,255,255,0.05)" />
        <SvgLine x1={2} y1={c} x2={DIAL - 2} y2={c} stroke="rgba(255,255,255,0.05)" />
        {blips.map((b) => {
          const at = blipAt(b.id);
          return <Circle key={b.id} cx={at.x} cy={at.y} r={3.5} fill={LEVEL_HEX[b.level]} />;
        })}
      </Svg>
      <Animated.View style={[{ position: "absolute", width: DIAL, height: DIAL }, sweep]} pointerEvents="none">
        <Svg width={DIAL} height={DIAL}>
          <Defs>
            <RadialGradient id="sweep" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#7CC4FF" stopOpacity={0.3} />
              <Stop offset="1" stopColor="#7CC4FF" stopOpacity={0.04} />
            </RadialGradient>
          </Defs>
          <Path d={`M ${c} ${c} L ${c} ${c * 0.02} A ${c * 0.98} ${c * 0.98} 0 0 1 ${c + c * 0.69} ${c - c * 0.69} Z`} fill="url(#sweep)" />
        </Svg>
      </Animated.View>
      <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
        <Text style={[T.figureBig, { fontSize: 44 }]}>{score ?? "···"}</Text>
        <Text style={{ marginTop: 1, fontSize: 12.5, fontWeight: "600", color: INK.soft }}>{level}</Text>
      </View>
    </View>
  );
}

export default function RadarPanel({
  data,
  board,
  bottom,
  onAsk,
}: {
  data: RaioXData | null;
  board: BoardLine[];
  bottom: number;
  onAsk: (line: BoardLine) => void;
}) {
  const [filter, setFilter] = useState<"tudo" | BoardGroup>("tudo");
  const shown = useMemo(() => (filter === "tudo" ? board : board.filter((l) => l.group === filter)), [board, filter]);
  const signals = useMemo(() => board.filter((l) => l.level !== "numero"), [board]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10, paddingBottom: bottom + 24 }} showsVerticalScrollIndicator={false}>
      <Dial score={data?.report.score ?? null} level={data ? data.report.level.label : "Lendo seus números"} blips={signals} />

      {data && (
        <Text style={{ marginTop: 14, marginHorizontal: 28, textAlign: "center", fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.8)" }}>
          {data.report.headline.replace(/\s*[—–]\s*/g, ", ")}
        </Text>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, gap: 6 }}>
        {BOARD_FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={({ pressed }) => ({
                height: 34,
                justifyContent: "center",
                paddingHorizontal: 15,
                borderRadius: 17,
                backgroundColor: on ? "#fff" : "rgba(255,255,255,0.07)",
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Text style={{ fontSize: 13.5, fontWeight: on ? "700" : "500", color: on ? "#0B0B0B" : "rgba(255,255,255,0.86)" }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {shown.length > 0 ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Glass radius={22} style={{ paddingHorizontal: 15 }}>
            {shown.map((line, i) => (
              <Pressable
                key={line.id}
                onPress={() => onAsk(line)}
                accessibilityHint="Pergunta ao Willo"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                  paddingVertical: 13,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: "rgba(255,255,255,0.06)",
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LEVEL_HEX[line.level] }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={T.rowName}>
                    {line.title}
                  </Text>
                  {line.note ? (
                    <Text numberOfLines={2} style={{ marginTop: 2, fontSize: 12.5, lineHeight: 17, color: INK.soft }}>
                      {line.note}
                    </Text>
                  ) : null}
                </View>
                {line.value ? <Text style={T.rowValue}>{line.value}</Text> : null}
                <ChevronRight size={15} color={INK.faint} strokeWidth={2.2} />
              </Pressable>
            ))}
          </Glass>
          <Text style={{ marginTop: 10, textAlign: "center", fontSize: 12.5, color: INK.softer }}>Toque em uma linha e o Willo responde na hora.</Text>
        </View>
      ) : (
        <Text style={{ marginTop: 12, marginHorizontal: 28, textAlign: "center", fontSize: 14, color: INK.soft }}>{data ? "Nada por aqui agora." : ""}</Text>
      )}
    </ScrollView>
  );
}
