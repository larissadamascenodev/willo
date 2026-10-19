import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRecorrentes, daysUntil } from "@/hooks/useRecorrentes";
import { useAuth } from "~/lib/auth";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import Surface from "~/components/Surface";
import { Check, ChevronDown, ChevronUp, Repeat } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What is certain every month.
 *
 * Fixed outgoings and fixed income are two different questions wearing the same
 * shape, so they share a card and a switch rather than taking two. The bar under
 * the total is the month's progress through them — how many have already happened —
 * which is the thing a list of due dates cannot say at a glance.
 */
export default function GastosFixosCard() {
  const { user } = useAuth();
  const { items, loading } = useRecorrentes();
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [tab, setTab] = useState<"despesa" | "receita">("despesa");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    getCustomCategories()
      .then((c) => alive && setCustomCats(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => items.filter((s) => s.txType === tab), [items, tab]);
  const total = useMemo(() => filtered.reduce((s, x) => s + x.amount, 0), [filtered]);
  const despesaCount = items.filter((s) => s.txType === "despesa").length;
  const receitaCount = items.filter((s) => s.txType === "receita").length;

  /* No session is not loading — it is nothing to show. */
  if (loading && user) return <Surface style={{ height: 200 }}><View /></Surface>;

  if (items.length === 0) {
    return (
      <Surface style={{ padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
          Gastos e receitas fixas
        </Text>
        <Text style={{ fontSize: 12, color: INK.soft }}>Contas fixas e assinaturas do mês</Text>
        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.04)",
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Repeat size={16} color={INK.soft} />
          </View>
          <Text style={{ flex: 1, fontSize: 13, color: INK.soft }}>
            Nenhuma despesa ou receita recorrente ainda.
          </Text>
        </View>
      </Surface>
    );
  }

  const shown = expanded ? filtered : filtered.slice(0, 3);
  const hasMore = filtered.length > 3;
  const paidCount = filtered.filter((s) => s.isPaidThisMonth).length;

  return (
    <Surface>
      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <Text style={T.cardLabel}>Gastos e receitas fixas</Text>
        <Text
          numberOfLines={1}
          style={[T.figure, { marginTop: 4 }, tab === "receita" && { color: GREEN }]}
        >
          {money(total)}
        </Text>
        <Text style={{ marginTop: 8, fontSize: 12.5, color: INK.soft }}>
          por mês
          <Text style={{ color: "rgba(255,255,255,0.2)" }}> · </Text>
          {paidCount} de {filtered.length} {tab === "receita" ? "já recebidas" : "já pagas"}
        </Text>
      </View>

      {/* Progress of the month. */}
      {filtered.length > 0 && (
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 14,
            height: 7,
            borderRadius: 999,
            overflow: "hidden",
            backgroundColor: "rgba(255,255,255,0.07)",
          }}
        >
          <View
            style={{
              height: "100%",
              borderRadius: 999,
              backgroundColor: tab === "receita" ? GREEN : "#fff",
              width: `${(paidCount / filtered.length) * 100}%`,
            }}
          />
        </View>
      )}

      <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <View
          style={{
            flexDirection: "row",
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.06)",
            padding: 4,
          }}
        >
          {(["despesa", "receita"] as const).map((key) => {
            const on = tab === key;
            return (
              <Text
                key={key}
                onPress={() => {
                  setTab(key);
                  setExpanded(false);
                }}
                style={{
                  flex: 1,
                  height: 32,
                  lineHeight: 32,
                  textAlign: "center",
                  borderRadius: 999,
                  overflow: "hidden",
                  fontSize: 12,
                  fontWeight: "600",
                  backgroundColor: on ? "#fff" : "transparent",
                  color: on ? "#0B0B0B" : "rgba(255,255,255,0.7)",
                }}
              >
                {key === "despesa" ? "Despesas" : "Receitas"} (
                {key === "despesa" ? despesaCount : receitaCount})
              </Text>
            );
          })}
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        {shown.length === 0 ? (
          <Text style={{ paddingVertical: 24, textAlign: "center", fontSize: 13, color: INK.soft }}>
            Nenhuma {tab === "receita" ? "receita recorrente" : "despesa recorrente"}
          </Text>
        ) : (
          shown.map((sub, idx) => {
            const days = daysUntil(sub.dueDay);
            const dueSoon = !sub.isPaidThisMonth && days <= 3;
            const Icon = categoryIcon(sub.category, customCats);

            return (
              <Animated.View
                key={sub.id}
                entering={FadeInDown.delay(idx * 30).duration(260)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 12,
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: "rgba(255,255,255,0.06)",
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  <Icon size={20} color="rgba(255,255,255,0.8)" />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 15,
                      fontWeight: "500",
                      color: sub.isPaidThisMonth ? "rgba(255,255,255,0.7)" : "#fff",
                    }}
                  >
                    {sub.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: dueSoon ? AMBER : INK.soft }}>
                    {sub.isPaidThisMonth
                      ? tab === "receita"
                        ? "Recebido este mês"
                        : "Pago este mês"
                      : `Dia ${sub.dueDay} · ${days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`}`}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: sub.isPaidThisMonth ? "rgba(255,255,255,0.7)" : "#fff",
                    }}
                  >
                    {money(sub.amount)}
                  </Text>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: sub.isPaidThisMonth ? GREEN : "transparent",
                      borderWidth: sub.isPaidThisMonth ? 0 : 1,
                      borderColor: "rgba(255,255,255,0.15)",
                    }}
                  >
                    {sub.isPaidThisMonth && <Check size={12} color="#0B0B0B" strokeWidth={3} />}
                  </View>
                </View>
              </Animated.View>
            );
          })
        )}
      </View>

      {hasMore ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.06)",
            paddingVertical: 12,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.74)" }}>
            {expanded ? "Mostrar menos" : `Ver todas (${filtered.length})`}
          </Text>
          {expanded ? (
            <ChevronUp size={16} color="rgba(255,255,255,0.74)" />
          ) : (
            <ChevronDown size={16} color="rgba(255,255,255,0.74)" />
          )}
        </Pressable>
      ) : (
        <View style={{ height: 4 }} />
      )}
    </Surface>
  );
}
