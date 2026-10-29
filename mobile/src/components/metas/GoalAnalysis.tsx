import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { isReserveGoal, type Goal } from "@/services/goalService";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { deadlineIn, monthYear, paceOf } from "~/lib/cofrinho";
import Surface from "~/components/Surface";
import { Sparkles } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";

/**
 * What the person's month leaves room for, held against this cofrinho.
 *
 * Reads the same projection the rest of the app does: the average of what each of the
 * coming months is expected to have left over. Against that it puts what the cofrinho
 * asks of each month and offers the nearest ways to ask a little more — each with the
 * date it would arrive on, and how much sooner that is — and one button to adopt the
 * one chosen. It never changes anything until that button is pressed.
 */

const STEPS = [100, 250, 500];

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

  const remaining = Math.max(Number(goal.target_amount) - Number(goal.current_amount), 0);
  const pace = paceOf(goal);

  /* What a month is expected to leave over, from the next few of them. */
  const room = useMemo(() => {
    const ahead = projections.slice(0, 3).map((p) => Number(p.delta) || 0);
    if (ahead.length === 0) return null;
    return Math.max(Math.round(ahead.reduce((s, v) => s + v, 0) / ahead.length), 0);
  }, [projections]);

  if (remaining <= 0) return null;

  /* What is already being put in each month: what the date asks for, or what was set. */
  const base = !pace.open ? pace.monthly : Number(goal.monthly_contribution) || 0;
  const monthsAt = (monthly: number) => (monthly > 0 ? Math.ceil(remaining / monthly) : 0);
  const arrives = (monthly: number) => monthYear(deadlineIn(monthsAt(monthly)));

  const options =
    room === null || room <= base
      ? []
      : [
          ...STEPS.filter((s) => base + s <= room).map((s) => ({ monthly: base + s, label: `+${money(s)}` })),
          { monthly: room, label: "Toda a sobra" },
        ]
          /* "All of it" can land on one of the steps; say it once. */
          .filter((o, i, all) => all.findIndex((x) => x.monthly === o.monthly) === i)
          .slice(0, 4);

  const chosen = options.find((o) => o.monthly === pick) ?? null;
  const sooner =
    chosen && base > 0 && !pace.open && goal.deadline
      ? Math.max(pace.months - monthsAt(chosen.monthly), 0)
      : 0;

  const apply = async () => {
    if (!chosen || saving) return;
    setSaving(true);
    try {
      await onApply({ monthly: chosen.monthly, deadline: deadlineIn(monthsAt(chosen.monthly)) });
      setPick(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Surface radius={26} style={{ marginTop: 12, padding: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Sparkles size={14} color={GREEN} />
        <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", color: INK.softer }}>
          Análise
        </Text>
      </View>

      {room === null ? (
        <Text style={{ marginTop: 12, fontSize: 14, lineHeight: 20, color: INK.soft }}>
          Estou lendo o seu mês para ver quanto sobra…
        </Text>
      ) : (
        <>
          <Text style={{ marginTop: 12, fontSize: 14.5, lineHeight: 21, color: INK.soft }}>
            {room > 0 ? (
              <>
                Nos próximos meses sobram em média{" "}
                <Text style={{ fontWeight: "700", color: "#fff" }}>{money(room)}</Text> por mês.
              </>
            ) : (
              "Pelas suas contas, o mês fecha sem sobra por enquanto."
            )}{" "}
            {base > 0 ? (
              <>
                {isReserveGoal(goal) ? "Você guarda" : "O plano pede"}{" "}
                <Text style={{ fontWeight: "700", color: "#fff" }}>{money(base)}</Text> por mês, e isso termina em{" "}
                <Text style={{ fontWeight: "700", color: "#fff" }}>{arrives(base)}</Text>.
              </>
            ) : (
              "Defina um valor por mês para ver quando ele termina."
            )}
          </Text>

          {options.length > 0 && (
            <>
              <Text style={{ marginTop: 18, fontSize: 12.5, color: INK.soft }}>Se guardar um pouco mais por mês</Text>
              <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {options.map((o) => {
                  const on = chosen?.monthly === o.monthly;
                  return (
                    <Pressable
                      key={o.monthly}
                      onPress={() => setPick(on ? null : o.monthly)}
                      style={({ pressed }) => ({
                        height: 40,
                        paddingHorizontal: 16,
                        borderRadius: 20,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: on ? "#fff" : "rgba(255,255,255,0.10)",
                        backgroundColor: on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      })}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#fff" }}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {chosen && (
            <View style={{ marginTop: 16, borderRadius: 18, backgroundColor: "rgba(200,243,109,0.07)", borderWidth: 1, borderColor: "rgba(200,243,109,0.16)", padding: 14 }}>
              <Text style={{ fontSize: 14, lineHeight: 20, color: INK.soft }}>
                Guardando <Text style={{ fontWeight: "700", color: "#fff" }}>{money(chosen.monthly)}</Text> por mês você conclui em{" "}
                <Text style={{ fontWeight: "700", color: "#fff" }}>{arrives(chosen.monthly)}</Text>
                {sooner > 0 ? `, ${sooner} ${sooner === 1 ? "mês" : "meses"} antes` : ""}.
              </Text>
              <Pressable
                onPress={apply}
                disabled={saving}
                style={({ pressed }) => ({
                  marginTop: 12,
                  height: 46,
                  borderRadius: 23,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#fff",
                  opacity: saving ? 0.6 : pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#0B0B0B" }}>
                  {saving ? "Salvando…" : `Guardar ${money(chosen.monthly)} por mês`}
                </Text>
              </Pressable>
            </View>
          )}

          {options.length === 0 && room > 0 && base > 0 && (
            <Text style={{ marginTop: 14, fontSize: 13, lineHeight: 18, color: INK.softer }}>
              O plano já usa praticamente toda a sobra do mês. Para antecipar, o caminho é aumentar a renda ou cortar gastos.
            </Text>
          )}
        </>
      )}
    </Surface>
  );
}
