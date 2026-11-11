import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Surface from "~/components/Surface";
import { ChevronRight } from "~/components/icons";
import { STAGES, type Journey } from "~/lib/journey";
import { useJourney } from "~/lib/useJourney";
import { th } from "~/theme/theme";
import { GREEN, INK } from "~/theme/tokens";
/* The height of a half card on the board (WidgetBoard.COMPACT_H). */
const COMPACT_H = 208;

/**
 * Sua Jornada on the home: the stage, how far to the next one, and the mini-meta that
 * matters most now. Small, it keeps the stage and the bar. It opens the journey.
 */

const AMBER = "#F5B544";

export default function JornadaCard({ size = "full" }: { size?: "half" | "full" }) {
  const router = useRouter();
  const { journey } = useJourney();
  const open = () => router.push("/jornada" as never);

  if (!journey) return <Surface style={{ height: size === "half" ? COMPACT_H : 168 }}><View /></Surface>;
  return size === "half" ? <Half j={journey} onPress={open} /> : <Full j={journey} onPress={open} />;
}

function Path({ j, dot = 10 }: { j: Journey; dot?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {STAGES.map((s, i) => {
        const past = i < j.index;
        const here = i === j.index;
        return (
          <View key={s} style={{ flexDirection: "row", alignItems: "center", flex: i < STAGES.length - 1 ? 1 : 0 }}>
            <View
              style={{
                width: here ? dot + 4 : dot,
                height: here ? dot + 4 : dot,
                borderRadius: dot,
                backgroundColor: past ? th(GREEN) : here ? th("#fff", "bg") : "transparent",
                borderWidth: past || here ? 0 : 2,
                borderColor: th("rgba(255,255,255,0.28)", "line"),
              }}
            />
            {i < STAGES.length - 1 && <View style={{ flex: 1, height: 2, marginHorizontal: 3, borderRadius: 1, backgroundColor: past ? th(GREEN) : th("rgba(255,255,255,0.12)", "line") }} />}
          </View>
        );
      })}
    </View>
  );
}

function Bar({ value, hex = GREEN }: { value: number; hex?: string }) {
  return (
    <View style={{ height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.1)", "bg") }}>
      <View style={{ width: `${Math.max(4, Math.round(value * 100))}%`, height: 6, borderRadius: 3, backgroundColor: th(hex) }} />
    </View>
  );
}

function Full({ j, onPress }: { j: Journey; onPress: () => void }) {
  const goal = j.goals[0];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <Surface>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, color: th(INK.soft) }}>Sua jornada{j.estimated ? " · estimada" : ""}</Text>
            <ChevronRight size={16} color={th(INK.faint)} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: th("#fff") }}>
              {j.stage}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: th(INK.soft) }}>{j.points} pts</Text>
          </View>
          <Path j={j} />
          {j.next ? (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, color: th(INK.soft) }}>Para {j.next}</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: th("#fff") }}>{Math.round(j.toNext * 100)}%</Text>
              </View>
              <Bar value={j.toNext} />
            </View>
          ) : null}
          {goal && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.07)", "line") }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th(goal.tone === "urgente" ? AMBER : GREEN) }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14.5, fontWeight: "700", color: th("#fff") }}>{goal.title}</Text>
                <Text style={{ marginTop: 1, fontSize: 12.5, color: th(INK.soft) }}>{goal.detail}</Text>
              </View>
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: th(GREEN) }}>+{goal.points}</Text>
            </View>
          )}
        </View>
      </Surface>
    </Pressable>
  );
}

function Half({ j, onPress }: { j: Journey; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <Surface style={{ height: COMPACT_H }}>
        <View style={{ flex: 1, padding: 14, justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, color: th(INK.soft) }}>Jornada</Text>
            <ChevronRight size={15} color={th(INK.faint)} />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1, color: th(INK.softer) }}>
              ETAPA {j.index + 1} DE {STAGES.length}
            </Text>
            <Text numberOfLines={2} style={{ fontSize: 20, lineHeight: 23, fontWeight: "800", letterSpacing: -0.5, color: th("#fff") }}>
              {j.stage}
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            <Path j={j} dot={7} />
            <Text numberOfLines={1} style={{ fontSize: 12.5, color: th(INK.soft) }}>
              {j.next ? `${Math.round(j.toNext * 100)}% para ${j.next}` : `${j.points} pts`}
            </Text>
          </View>
        </View>
      </Surface>
    </Pressable>
  );
}
