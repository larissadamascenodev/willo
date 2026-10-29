import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { isReserveGoal, type Goal } from "@/services/goalService";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { deadlineIn, monthYear, paceOf } from "~/lib/cofrinho";
import { goalPreset } from "~/lib/goalIcon";
import { Sparkles } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";

/**
 * What the person's month leaves room for, held against this cofrinho.
 *
 * Reads the same projection the rest of the app does: the average of what each of the
 * coming months is expected to have left over. It is drawn rather than told: one meter
 * that is the month's spare money, filled by what this cofrinho already takes of it,
 * and the date it arrives on at that pace. Under it, the nearest ways to ask a little
 * more of each month, each one already saying when it would arrive — choosing one
 * fills the meter a little further and moves the date, and only the button under it
 * changes anything.
 */

const STEPS = [100, 250, 500];

/** "#22D3EE" → "rgba(34,211,238,a)". */
const tint = (hex: string, a: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const short = (deadline: string) => monthYear(deadline).replace(/ de /, " ").replace(/ \d{2}(\d{2})$/, "/$1");

export default function GoalAnalysis({
  goal,
  onApply,
}: {
  goal: Goal;
  onApply: (plan: { monthly: number; deadline: string }) => Promise<void> | void;
}) {
  const { projections } = useFinancialProjection();
  const [pick, setPick] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const hex = goalPreset(goal).hex;

  const remaining = Math.max(Number(goal.target_amount) - Number(goal.current_amount), 0);
  const pace = paceOf(goal);

  /* What a month is expected to leave over, from the next few of them. */
  const room = useMemo(() => {
    const ahead = projections.slice(0, 3).map((p) => Number(p.delta) || 0);
    if (ahead.length === 0) return null;
    return Math.max(Math.round(ahead.reduce((s, v) => s + v, 0) / ahead.length), 0);
  }, [projections]);

  /* What is already being put in each month: what the date asks for, or what was set. */
  const base = !pace.open ? pace.monthly : Number(goal.monthly_contribution) || 0;
  const monthsAt = (monthly: number) => (monthly > 0 ? Math.ceil(remaining / monthly) : 0);
  const arrivesOn = (monthly: number) => deadlineIn(monthsAt(monthly));

  const options =
    room === null || room <= base
      ? []
      : [
          ...STEPS.filter((s) => base + s <= room).map((s) => ({ monthly: base + s, label: `+${money(s)}` })),
          { monthly: room, label: "Toda a sobra" },
        ]
          /* "All of it" can land on one of the steps; say it once. */
          .filter((o, i, all) => all.findIndex((x) => x.monthly === o.monthly) === i)
          .slice(0, 3);

  const chosen = options.find((o) => o.monthly === pick) ?? null;
  const sooner = chosen && base > 0 ? Math.max(monthsAt(base) - monthsAt(chosen.monthly), 0) : 0;

  /* The meter: the plan's share of the spare money, and the chosen one's past it. */
  const planShare = room && room > 0 ? Math.min(base / room, 1) : base > 0 ? 1 : 0;
  const chosenShare = chosen && room && room > 0 ? Math.min(chosen.monthly / room, 1) : planShare;
  const plan = useSharedValue(0);
  const extra = useSharedValue(0);
  useEffect(() => {
    plan.set(withTiming(planShare, { duration: 900, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [planShare, plan]);
  useEffect(() => {
    extra.set(withTiming(chosenShare, { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [chosenShare, extra]);
  const planFill = useAnimatedStyle(() => ({ width: `${plan.get() * 100}%` }));
  const extraFill = useAnimatedStyle(() => ({ width: `${extra.get() * 100}%` }));

  if (remaining <= 0) return null;

  const apply = async () => {
    if (!chosen || saving) return;
    setSaving(true);
    try {
      await onApply({ monthly: chosen.monthly, deadline: arrivesOn(chosen.monthly) });
      setPick(null);
    } finally {
      setSaving(false);
    }
  };

  const showing = chosen?.monthly ?? base;
  const usesAll = options.length === 0 && (room ?? 0) > 0 && base > 0;

  return (
    <View
      style={{
        marginTop: 28,
        borderRadius: 28,
        borderCurve: "continuous",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.09)",
      }}
    >
      {/* The cofrinho's own colour, as light coming in from the top corner. */}
      <LinearGradient
        colors={[tint(hex, 0.2), tint(hex, 0.05), "rgba(255,255,255,0.02)"]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ position: "absolute", top: 0, left: 28, right: 28, height: 1, backgroundColor: "rgba(255,255,255,0.16)" }} />

      <View style={{ padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.18) }}>
            <Sparkles size={13} color={hex} />
          </View>
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#fff" }}>Seu plano</Text>
          <Text style={{ fontSize: 12.5, color: INK.softer }}>· análise do Willo</Text>
        </View>

        {room === null ? (
          <Text style={{ marginTop: 16, fontSize: 14, lineHeight: 20, color: INK.soft }}>Lendo o seu mês para ver quanto sobra…</Text>
        ) : (
          <>
            {/* When it arrives, as the headline. */}
            <View style={{ marginTop: 18, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flexShrink: 1 }}>
                <Text style={{ fontSize: 12.5, color: INK.softer }}>{showing > 0 ? "Você conclui em" : "Sem valor por mês"}</Text>
                <Text style={{ marginTop: 3, fontSize: 30, fontWeight: "800", letterSpacing: -1.1, color: "#fff", textTransform: "capitalize" }}>
                  {showing > 0 ? short(arrivesOn(showing)) : "—"}
                </Text>
              </View>
              {sooner > 0 ? (
                <Animated.View entering={FadeIn.duration(220)} style={{ marginBottom: 6, paddingHorizontal: 10, height: 26, borderRadius: 13, justifyContent: "center", backgroundColor: "rgba(200,243,109,0.14)" }}>
                  <Text style={{ fontSize: 12.5, fontWeight: "700", color: GREEN }}>
                    {sooner} {sooner === 1 ? "mês" : "meses"} antes
                  </Text>
                </Animated.View>
              ) : showing > 0 ? (
                <Text style={{ marginBottom: 6, fontSize: 13, color: INK.soft }}>
                  em {monthsAt(showing)} {monthsAt(showing) === 1 ? "mês" : "meses"}
                </Text>
              ) : null}
            </View>

            {/* The month's spare money, and how much of it this takes. */}
            <View style={{ marginTop: 20 }}>
              <View style={{ height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" }}>
                <Animated.View style={[{ position: "absolute", top: 0, left: 0, bottom: 0, borderRadius: 5, backgroundColor: tint(hex, 0.45) }, extraFill]} />
                <Animated.View style={[{ position: "absolute", top: 0, left: 0, bottom: 0, borderRadius: 5, backgroundColor: hex }, planFill]} />
              </View>
              <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12.5, color: INK.soft }}>
                  {isReserveGoal(goal) ? "Você guarda" : "Plano"} <Text style={{ fontWeight: "700", color: "#fff" }}>{money(showing)}</Text>/mês
                </Text>
                <Text style={{ fontSize: 12.5, color: INK.soft }}>
                  Sobra <Text style={{ fontWeight: "700", color: "#fff" }}>{money(room)}</Text>/mês
                </Text>
              </View>
              {room <= 0 && (
                <Text style={{ marginTop: 10, fontSize: 12.5, lineHeight: 18, color: INK.softer }}>Pelas suas contas, o mês fecha sem sobra por enquanto.</Text>
              )}
            </View>

            {options.length > 0 && (
              <>
                <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.softer }}>E se guardar mais por mês?</Text>
                <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
                  {options.map((o) => {
                    const on = chosen?.monthly === o.monthly;
                    return (
                      <Pressable
                        key={o.monthly}
                        onPress={() => setPick(on ? null : o.monthly)}
                        style={({ pressed }) => ({
                          flex: 1,
                          paddingVertical: 12,
                          paddingHorizontal: 8,
                          borderRadius: 18,
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: on ? hex : "rgba(255,255,255,0.08)",
                          backgroundColor: on ? tint(hex, 0.16) : "rgba(255,255,255,0.04)",
                          transform: [{ scale: pressed ? 0.96 : 1 }],
                        })}
                      >
                        <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: "#fff" }}>{o.label}</Text>
                        <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 11.5, color: on ? "#fff" : INK.softer, textTransform: "capitalize" }}>
                          {short(arrivesOn(o.monthly))}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {chosen && (
              <Animated.View entering={FadeIn.duration(220)}>
                <Pressable
                  onPress={apply}
                  disabled={saving}
                  style={({ pressed }) => ({
                    marginTop: 16,
                    height: 52,
                    borderRadius: 26,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                    opacity: saving ? 0.6 : pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#0B0B0B" }}>
                    {saving ? "Salvando…" : `Guardar ${money(chosen.monthly)} por mês`}
                  </Text>
                </Pressable>
              </Animated.View>
            )}

            {usesAll && (
              <Text style={{ marginTop: 16, fontSize: 12.5, lineHeight: 18, color: INK.softer }}>
                O plano já usa praticamente toda a sobra do mês. Para chegar antes, o caminho é aumentar a renda ou cortar gastos.
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}
