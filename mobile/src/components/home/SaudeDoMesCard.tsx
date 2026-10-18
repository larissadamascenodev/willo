import { useMemo } from "react";
import { Text, View } from "react-native";
import Surface from "~/components/Surface";
import { ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import type { CategoryExpense } from "@/types/finance";

/**
 * How the month is going, in the only terms that can still change it.
 *
 * A score out of a thousand is a verdict on what already happened. What is still
 * yours to decide is the rest of the month: how many days are left, how much is left
 * for them, and therefore how much a day can hold. The share of income already spent
 * sits under it as the line that says whether that number is comfortable or tight.
 */
export default function SaudeDoMesCard({
  receitas,
  despesas,
  saldoPrevisto,
  categories,
  isCurrentMonth,
}: {
  receitas: number;
  despesas: number;
  saldoPrevisto: number;
  categories: CategoryExpense[];
  isCurrentMonth: boolean;
}) {
  const { daysLeft, spentShare, perDay, villain, tone } = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    /* A month already over has no days left to spread anything across; a month not
       yet begun has all of them. */
    const left = isCurrentMonth ? Math.max(daysInMonth - now.getDate() + 1, 1) : daysInMonth;

    const share = receitas > 0 ? Math.min(despesas / receitas, 1.5) : despesas > 0 ? 1.5 : 0;

    return {
      daysLeft: left,
      spentShare: share,
      perDay: saldoPrevisto > 0 ? saldoPrevisto / left : 0,
      villain: [...categories].sort((a, b) => b.amount - a.amount)[0] ?? null,
      tone:
        share >= 1
          ? { hex: "#F87171", label: "No vermelho" }
          : share >= 0.85
            ? { hex: "#FBBF24", label: "Apertado" }
            : share >= 0.6
              ? { hex: "#7DD3FC", label: "No caminho" }
              : { hex: "#C8F36D", label: "Folgado" },
    };
  }, [receitas, despesas, saldoPrevisto, categories, isCurrentMonth]);

  return (
    <Surface style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={T.cardLabel}>Saúde do mês</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              overflow: "hidden",
              fontSize: 11,
              fontWeight: "700",
              backgroundColor: `${tone.hex}1F`,
              color: tone.hex,
            }}
          >
            {tone.label}
          </Text>
          <ChevronRight size={16} color={INK.faint} />
        </View>
      </View>

      <Text numberOfLines={1} style={[T.figure, { marginTop: 4 }]}>
        {money(perDay)}
      </Text>
      <Text numberOfLines={1} style={[T.note, { marginTop: 8, fontSize: 13 }]}>
        por dia {daysLeft === 1 ? "no dia que falta" : `nos ${daysLeft} dias que faltam`}
      </Text>

      {/* How much of what came in has already gone. */}
      <View
        style={{
          marginTop: 14,
          height: 7,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            borderRadius: 999,
            backgroundColor: tone.hex,
            width: `${Math.min(spentShare, 1) * 100}%`,
          }}
        />
      </View>

      <View style={{ marginTop: 12, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text numberOfLines={1} style={{ fontSize: 12, color: INK.softer, flexShrink: 1 }}>
          <Text style={{ fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
            {Math.round(spentShare * 100)}%
          </Text>{" "}
          do que entrou já saiu
        </Text>
        {villain && (
          <Text numberOfLines={1} style={{ fontSize: 12, color: INK.softer }}>
            maior gasto:{" "}
            <Text style={{ fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>{villain.name}</Text>
          </Text>
        )}
      </View>

      <View
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.06)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 12.5, color: INK.soft }}>Sobra prevista no fim do mês</Text>
        <Text style={{ fontSize: 15, fontWeight: "700", color: saldoPrevisto < 0 ? RED : "#fff" }}>
          {money(saldoPrevisto)}
        </Text>
      </View>
    </Surface>
  );
}
