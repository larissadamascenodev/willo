import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { planVsActual } from "@/lib/plan/financialPlan";
import Surface from "~/components/Surface";
import AgentMark from "~/components/willo/AgentMark";
import { ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { usePlan } from "~/lib/usePlan";
import { useActivePlan } from "~/lib/activePlan";
import { BUCKET_HEX } from "~/app/plano";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Meu Plano Financeiro, on the home.
 *
 * With a plan chosen, the month against it: each part of the plan as a thin bar of how
 * much of it is used. Without one, the method Willo recommends and why, as the way in.
 */
export default function PlanoCard() {
  const router = useRouter();
  const { loading, methods, current, profile } = usePlan();
  const active = useActivePlan();
  const chosen = active ? methods.find((m) => m.id === active.method) : null;
  const best = methods[0];

  if (loading || !profile) return null;

  return (
    <Surface onPress={() => router.push("/plano" as never)} style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text numberOfLines={1} style={[T.cardLabel, { flex: 1 }]}>
          Meu plano <Text style={{ color: INK.faint }}>·</Text> {chosen ? chosen.label : "recomendado"}
        </Text>
        <ChevronRight size={16} color={INK.faint} />
      </View>

      {chosen && current ? (
        <View style={{ marginTop: 14, gap: 12 }}>
          {planVsActual(chosen, current).map((r, i) => (
            <View key={r.label}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>{r.label}</Text>
                <Text style={{ fontSize: 13, color: r.over ? RED : INK.soft }}>{r.over ? `passou ${money(-r.left)}` : `restam ${money(r.left)}`}</Text>
              </View>
              <View style={{ marginTop: 6, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" }}>
                <View
                  style={{
                    width: `${r.planned > 0 ? Math.min(r.spent / r.planned, 1) * 100 : 0}%`,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: r.over ? RED : BUCKET_HEX[chosen.allocations[i]?.bucket ?? "livre"],
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : best ? (
        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <AgentMark hex="#5EEAD4" size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", letterSpacing: -0.3, color: "#fff" }}>{best.label}</Text>
            <Text numberOfLines={2} style={{ marginTop: 2, fontSize: 12.5, lineHeight: 17, color: INK.soft }}>{best.why}</Text>
          </View>
        </View>
      ) : null}
    </Surface>
  );
}
