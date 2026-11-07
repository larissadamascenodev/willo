import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { usePlan } from "~/lib/usePlan";
import { useActivePlan } from "~/lib/activePlan";
import { PLAN_GUIDE } from "~/lib/planGuide";
import { HEALTH_HEX, HEALTH_LABEL, planStatus } from "~/lib/planStatus";
import { BUCKET_HEX, PlanIcon, SplitBar } from "~/app/plano";

/**
 * Meu Plano, on the home, dressed in the plan's own colour.
 *
 * With a plan in use: its name, whether the month is inside it, what is still free to
 * spend and how much that is a day, a bar of how much is used, and the one thing Willo
 * would say about it now. Without one: the plan that fits best, how well, and what it
 * is, as the way in. The card is dark in both themes, like a card from a wallet.
 */
export default function PlanoCard() {
  const router = useRouter();
  const { loading, methods, current, profile } = usePlan();
  const active = useActivePlan();
  const chosen = active ? methods.find((m) => m.id === active.method) : null;
  const best = methods[0];

  if (loading || !profile || profile.incomeAvg <= 0) return null;
  const plan = chosen ?? best;
  if (!plan) return null;
  const g = PLAN_GUIDE[plan.id];
  const status = chosen && current ? planStatus(chosen, current) : null;
  const spendable = status ? status.rows.filter((r) => !r.saving) : [];
  const planned = spendable.reduce((s, r) => s + r.planned, 0);
  const used = planned > 0 ? spendable.reduce((s, r) => s + r.spent, 0) / planned : 0;
  const note = status?.alerts[0];

  return (
    <Pressable onPress={() => router.push("/plano" as never)} accessibilityRole="button" accessibilityLabel="Meu plano" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <View style={{ borderRadius: 26, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
        <LinearGradient colors={[g.hue[2], "#0E0F14"]} start={{ x: 0, y: 0 }} end={{ x: 0.95, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <LinearGradient colors={[`${g.hue[1]}4D`, "transparent"]} start={{ x: 1, y: 0 }} end={{ x: 0.35, y: 0.75 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <PlanIcon icon={g.icon} hue={g.hue} size={34} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.1, color: "rgba(255,255,255,0.58)" }}>{status ? "MEU PLANO" : "PLANO PARA VOCÊ"}</Text>
              <Text numberOfLines={2} style={{ marginTop: 2, fontSize: 17, lineHeight: 21, fontWeight: "800", letterSpacing: -0.3, color: "#fff" }}>{plan.label}</Text>
            </View>
            {status ? (
              <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(10,11,13,0.45)" }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: HEALTH_HEX[status.health] }} />
                <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#fff" }}>{HEALTH_LABEL[status.health]}</Text>
              </View>
            ) : null}
          </View>

          {status ? (
            <>
              <View style={{ marginTop: 16, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 12.5, color: "rgba(255,255,255,0.62)" }}>Livre este mês</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 1, fontSize: 28, fontWeight: "800", letterSpacing: -1, color: "#fff" }}>{money(status.free)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: "#fff" }}>{money(status.perDay)}</Text>
                  <Text style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>por dia · {status.daysLeft} {status.daysLeft === 1 ? "dia" : "dias"}</Text>
                </View>
              </View>
              <View style={{ marginTop: 12, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.14)" }}>
                <View style={{ width: `${Math.min(1, used) * 100}%`, height: 6, borderRadius: 3, backgroundColor: used > 1 ? "#F87171" : g.hue[0] }} />
              </View>
              {note && (
                <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: note.tone === "ok" ? "#67CD67" : note.tone === "warn" ? "#F5B83D" : "#F87171" }} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{note.title}</Text>
                  <ChevronRight size={15} color="rgba(255,255,255,0.5)" />
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={{ marginTop: 12, fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.8)" }}>{g.tagline}</Text>
              <View style={{ marginTop: 14 }}>
                <SplitBar plan={plan} height={6} onDark />
              </View>
              <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6 }}>
                {plan.allocations
                  .filter((a) => a.share > 0)
                  .slice(0, 4)
                  .map((a) => (
                    <View key={a.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: BUCKET_HEX[a.bucket] }} />
                      <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                        {a.label} <Text style={{ fontWeight: "800", color: "#fff" }}>{Math.round(a.share * 100)}%</Text>
                      </Text>
                    </View>
                  ))}
              </View>
              <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>Combina com você</Text>
                  <Text style={{ marginTop: 1, fontSize: 17, fontWeight: "800", letterSpacing: -0.3, color: "#fff" }}>{plan.fit}%</Text>
                </View>
                <View style={{ height: 32, paddingLeft: 14, paddingRight: 10, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.14)" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Ver plano</Text>
                  <ChevronRight size={14} color="#fff" />
                </View>
              </View>
            </>
          )}
        </View>
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 26, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
      </View>
    </Pressable>
  );
}
