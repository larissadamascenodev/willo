import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { AlertTriangle, Check, Undo2 } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * The slip the entries land on while they are being worked out — the phone's copy
 * of the web's Notinha.
 *
 * Everything else on the screen is a conversation, which scrolls away. The receipt
 * stays and fills in, so at any moment the person can see what the app believes it
 * heard and which lines are already in the books. Glass rather than paper, with a
 * torn edge to carry the idea; while a line is still being read the whole slip
 * breathes instead of growing a spinner.
 *
 * Once it is all in the books it can be taken back from the slip itself — the
 * quickest way to undo a sentence that was heard wrong.
 */

export type NotinhaStatus = "reading" | "asking" | "saving" | "saved" | "error" | "undone";

export interface NotinhaLine {
  id: string;
  name: string;
  sub: string;
  amount: number;
  type: "despesa" | "receita";
  status: NotinhaStatus;
}

const FILL = "rgba(255,255,255,0.062)";
const DASH = "rgba(255,255,255,0.13)";

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const subtitleFor = (line: NotinhaLine) => {
  if (line.status === "reading") return line.sub ? `${line.sub} · na fila` : "na fila";
  if (line.status === "saving") return "salvando…";
  if (line.status === "error") return "não consegui salvar";
  if (line.status === "asking") return line.sub ? `${line.sub} · falta uma coisa` : "falta uma coisa";
  if (line.status === "undone") return "desfeito";
  return line.sub;
};

/** The torn bottom edge, drawn so it renders the same everywhere. */
function TornEdge() {
  const teeth = 26;
  const w = 100 / teeth;
  let d = "M0,0 L100,0 L100,0.5";
  for (let i = teeth; i >= 1; i--) d += ` L${(i * w - w / 2).toFixed(2)},3 L${(i * w - w).toFixed(2)},0.5`;
  d += " Z";
  return (
    <Svg width="100%" height={9} viewBox="0 0 100 3" preserveAspectRatio="none" style={{ marginTop: -1 }}>
      <Path d={d} fill={FILL} />
    </Svg>
  );
}

function StatusMark({ status }: { status: NotinhaStatus }) {
  if (status === "saved") {
    return (
      <Animated.View
        entering={ZoomIn.springify().damping(14).stiffness(420)}
        style={{ width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: GREEN }}
      >
        <Check size={11} color="#0B0B0B" strokeWidth={3.4} />
      </Animated.View>
    );
  }
  if (status === "error") return <AlertTriangle size={17} color={RED} strokeWidth={2.4} />;
  if (status === "undone") return <Undo2 size={16} color={INK.faint} strokeWidth={2.2} />;
  return (
    <View
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        borderColor: status === "asking" ? "rgba(200,243,109,0.7)" : "rgba(255,255,255,0.2)",
      }}
    />
  );
}

export default function Notinha({ lines, onUndo }: { lines: NotinhaLine[]; onUndo?: () => void }) {
  const [undoing, setUndoing] = useState(false);
  const busy = lines.some((l) => l.status === "reading" || l.status === "saving");
  const breath = useSharedValue(1);

  useEffect(() => {
    breath.set(
      busy
        ? withRepeat(
            withSequence(
              withTiming(0.72, { duration: 700, easing: Easing.inOut(Easing.quad) }),
              withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
            ),
            -1,
            false,
            undefined,
            ReduceMotion.System,
          )
        : withSpring(1),
    );
  }, [busy, breath]);

  const breathing = useAnimatedStyle(() => ({ opacity: breath.get() }));

  if (lines.length === 0) return null;

  const allSaved = lines.every((l) => l.status === "saved");
  const allUndone = lines.every((l) => l.status === "undone");
  const total = lines.reduce((t, l) => t + (l.type === "receita" ? l.amount : -l.amount), 0);

  return (
    <Animated.View entering={FadeInDown.duration(380)} layout={LinearTransition.duration(260)}>
      <Animated.View
        style={[
          {
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: "rgba(255,255,255,0.09)",
            backgroundColor: FILL,
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 14,
          },
          breathing,
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 2.4, textTransform: "uppercase", color: INK.soft }}>
            Notinha
          </Text>
          <Text style={[nums, { fontSize: 12, color: INK.softer }]}>
            {lines.length} {lines.length === 1 ? "registro" : "registros"}
          </Text>
        </View>

        <View style={{ marginTop: 12, borderTopWidth: 1, borderStyle: "dashed", borderColor: DASH }} />

        {lines.map((line) => (
          <Animated.View
            key={line.id}
            entering={FadeIn.duration(280)}
            layout={LinearTransition.duration(260)}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 }}
          >
            <View style={{ paddingTop: 2 }}>
              <StatusMark status={line.status} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  letterSpacing: -0.2,
                  color: line.status === "saved" ? "#fff" : line.status === "undone" ? INK.faint : "rgba(255,255,255,0.7)",
                  textDecorationLine: line.status === "undone" ? "line-through" : "none",
                }}
              >
                {line.name}
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: INK.softer }}>
                {subtitleFor(line)}
              </Text>
            </View>
            <Text
              style={[
                nums,
                {
                  fontSize: 16,
                  fontWeight: "700",
                  letterSpacing: -0.3,
                  color: line.status === "saved" ? (line.type === "receita" ? GREEN : "#fff") : line.status === "undone" ? INK.faint : INK.soft,
                  textDecorationLine: line.status === "undone" ? "line-through" : "none",
                },
              ]}
            >
              {line.type === "receita" ? "+" : "−"}
              {money(line.amount)}
            </Text>
          </Animated.View>
        ))}

        {allUndone && (
          <View style={{ borderTopWidth: 1, borderStyle: "dashed", borderColor: DASH, paddingTop: 12 }}>
            <Text style={{ fontSize: 13, color: INK.softer }}>Desfeito — nada disso ficou salvo.</Text>
          </View>
        )}

        {allSaved && (
          <Animated.View
            entering={FadeIn.delay(120).duration(300)}
            style={{
              borderTopWidth: 1,
              borderStyle: "dashed",
              borderColor: DASH,
              paddingTop: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Check size={13} color={GREEN} strokeWidth={3} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: GREEN }}>Salvo no Willo</Text>
              {lines.length > 1 && (
                <Text style={[nums, { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.75)" }]}>
                  {" · "}
                  {total >= 0 ? "+" : "−"}
                  {money(Math.abs(total))}
                </Text>
              )}
            </View>
            {onUndo && (
              <Pressable
                onPress={() => {
                  if (undoing) return;
                  setUndoing(true);
                  onUndo();
                }}
                hitSlop={8}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.07)",
                  opacity: undoing ? 0.5 : pressed ? 0.7 : 1,
                })}
              >
                <Undo2 size={13} color="rgba(255,255,255,0.8)" strokeWidth={2.2} />
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>Desfazer</Text>
              </Pressable>
            )}
          </Animated.View>
        )}
      </Animated.View>
      <TornEdge />
    </Animated.View>
  );
}
