import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import {
  buildProjectionRows,
  MONTH_NAMES,
  PROJECTION_RISK,
  type ProjectionRowView,
} from "@/lib/projectionRows";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import BottomSheet from "~/components/BottomSheet";
import MonthBreakdown from "~/components/financeiro/MonthBreakdown";
import { AlertTriangle, CalendarDays, ChevronRight, Info, X } from "~/components/icons";
import { compact } from "~/lib/money";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Where the balance is going.
 *
 * Balanço asks how this month closes; this asks where the ones after it land, and
 * chains them — each month opens with what the one before closed with, so reading
 * down the column is reading one continuous balance. A month that ends in the red is
 * worth more than a colour, so the months that do are counted out in a line of their
 * own, with the only thing worth saying about a forecast: there is still time.
 */

const BAR_HEIGHT = 92;

/** One month in the strip. Lit when chosen, dimmed otherwise. */
function Column({
  value,
  max,
  color,
  on,
  delay,
}: {
  value: number;
  max: number;
  color: string;
  on: boolean;
  delay: number;
}) {
  const grow = useSharedValue(0);
  const target = Math.max(14, (Math.abs(value) / max) * BAR_HEIGHT);

  useEffect(() => {
    grow.value = withDelay(
      delay * 1000,
      withTiming(target, { duration: 450, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, delay, grow]);

  const animated = useAnimatedStyle(() => ({ height: grow.value }));

  return (
    <Animated.View
      style={[
        { width: "100%", borderRadius: 8, backgroundColor: color, opacity: on ? 1 : 0.4 },
        animated,
      ]}
    />
  );
}

export default function ProjecoesPanel() {
  const router = useRouter();
  const { projections, data, loading, monthData } = useFinancialProjection();
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState<ProjectionRowView | null>(null);

  const rows = useMemo(
    () => buildProjectionRows(projections, data.previousMonthEndingBalance),
    [projections, data.previousMonthEndingBalance],
  );

  if (loading) {
    return (
      <View style={{ marginTop: 20, gap: 12 }}>
        <View style={{ height: 180, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.04)" }} />
        <View style={{ height: 240, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
      </View>
    );
  }

  if ((!data.transactions.length && !data.events.length) || rows.length === 0) {
    return (
      <View style={{ marginTop: 40, alignItems: "center", paddingHorizontal: 32 }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: INK.edge,
            backgroundColor: "rgba(255,255,255,0.05)",
          }}
        >
          <CalendarDays size={32} color={INK.soft} strokeWidth={1.8} />
        </View>
        <Text style={{ marginTop: 20, fontSize: 18, fontWeight: "700", color: "#fff" }}>
          Ainda sem dados suficientes
        </Text>
        <Text style={{ marginTop: 4, textAlign: "center", fontSize: 14, color: INK.soft }}>
          Adicione transações para ver suas projeções.
        </Text>
        <Pressable
          onPress={() => router.push("/transacoes" as never)}
          style={({ pressed }) => ({
            marginTop: 20,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            paddingHorizontal: 24,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#0B0B0B" }}>Ver transações</Text>
        </Pressable>
      </View>
    );
  }

  const [current, ...ahead] = rows;
  const negatives = rows.filter((r) => r.fecha < 0);
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - today.getDate();

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.fecha)), 1);
  const pick = rows[Math.min(selected, rows.length - 1)];

  const toneOf = (r: ProjectionRowView) =>
    r.fecha < 0 ? RED : r.risk === "atencao" ? AMBER : GREEN;

  return (
    <View style={{ marginTop: 18 }}>
      {/* ══ This month, closed out ══ */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <Surface radius={24} style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 12, color: INK.soft }}>{current.name} fecha com</Text>
          <Text
            numberOfLines={1}
            style={{
              marginTop: 6,
              fontSize: 38,
              fontWeight: "800",
              letterSpacing: -1.4,
              color: current.fecha < 0 ? RED : GREEN,
            }}
          >
            {current.fecha > 0 ? "+" : ""}
            {compact(current.fecha)}
          </Text>
          <Text style={{ marginTop: 6, fontSize: 12.5, color: INK.soft }}>
            previsto · {daysLeft === 0 ? "último dia do mês" : `faltam ${daysLeft} dias`}
          </Text>

          <MonthBreakdown row={current} prevName={MONTH_NAMES[(current.month + 11) % 12]} />
        </Surface>
      </Animated.View>

      {negatives.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(60).duration(400)}
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "rgba(248,113,113,0.20)",
            backgroundColor: "rgba(248,113,113,0.07)",
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <AlertTriangle size={18} color={RED} strokeWidth={2.2} />
          <Text style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, color: "#FECACA" }}>
            {negatives.length === 1
              ? `Seu saldo fecha negativo em ${negatives[0].name.toLocaleLowerCase("pt-BR")}.`
              : `Seu saldo fecha negativo em ${negatives.length} meses.`}{" "}
            <Text style={{ color: "rgba(252,165,165,0.70)" }}>Dá tempo de mudar.</Text>
          </Text>
        </Animated.View>
      )}

      {/* ══ The balance, month by month ══ */}
      <Text style={[T.eyebrow, { marginTop: 26, paddingHorizontal: 4 }]}>Como seu saldo evolui</Text>
      <Animated.View entering={FadeInDown.delay(100).duration(420)}>
        <Surface radius={22} style={{ marginTop: 10, paddingVertical: 18 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingHorizontal: 18,
            }}
          >
            <Text
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12,
                fontWeight: "600",
                letterSpacing: 1,
                textTransform: "uppercase",
                color: INK.soft,
              }}
            >
              Saldo no fim de cada mês
            </Text>
            <Text
              style={{
                overflow: "hidden",
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
                fontSize: 11.5,
                fontWeight: "600",
                backgroundColor: pick.fecha < 0 ? "rgba(248,113,113,0.15)" : "rgba(200,243,109,0.12)",
                color: pick.fecha < 0 ? "#FCA5A5" : GREEN,
              }}
            >
              {pick.short} · {compact(pick.fecha)}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, gap: 8 }}
          >
            {rows.map((r, i) => {
              const on = i === Math.min(selected, rows.length - 1);
              return (
                <Pressable key={`${r.year}-${r.month}`} onPress={() => setSelected(i)} style={{ width: 38, alignItems: "center", gap: 8 }}>
                  <View style={{ width: "100%", height: BAR_HEIGHT, justifyContent: "flex-end" }}>
                    <Column value={r.fecha} max={maxAbs} color={toneOf(r)} on={on} delay={i * 0.02} />
                  </View>
                  <View style={{ alignItems: "center", gap: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: on ? "700" : "400", color: on ? "#fff" : INK.soft }}>
                      {r.short}
                    </Text>
                    <View
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: on ? "#fff" : "transparent",
                      }}
                    />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View
            style={{
              marginTop: 14,
              marginHorizontal: 18,
              flexDirection: "row",
              justifyContent: "center",
              gap: 16,
              borderTopWidth: 1,
              borderTopColor: "rgba(255,255,255,0.06)",
              paddingTop: 12,
            }}
          >
            <Key color={PROJECTION_RISK.positivo.hex} label="Tranquilo" />
            <Key color={PROJECTION_RISK.atencao.hex} label="Atenção" />
            <Key color={RED} label="Negativo" />
          </View>
        </Surface>
      </Animated.View>

      {/* ══ Each month, in full ══ */}
      <Text style={[T.eyebrow, { marginTop: 26, paddingHorizontal: 4 }]}>Mês a mês</Text>
      <View style={{ marginTop: 10, gap: 10 }}>
        {ahead.map((r, i) => {
          /* The track is what comes in, the fill what goes out — the same device the
             balance card uses, so the shape of a month reads the same everywhere. */
          const spent =
            r.income > 0 ? Math.min((r.expense / r.income) * 100, 100) : r.expense > 0 ? 100 : 0;
          return (
            <Animated.View key={`${r.year}-${r.month}`} entering={FadeInDown.delay(140 + i * 40).duration(380)}>
              <Surface radius={22} onPress={() => setOpen(r)} style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: toneOf(r) }} />
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 11.5,
                        fontWeight: "600",
                        letterSpacing: 1.3,
                        textTransform: "uppercase",
                        color: INK.soft,
                      }}
                    >
                      {r.name}
                      {r.yearTag ? `/${r.yearTag}` : ""}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="rgba(255,255,255,0.25)" />
                </View>

                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 12,
                    fontSize: 30,
                    fontWeight: "800",
                    letterSpacing: -1.1,
                    color: r.fecha < 0 ? RED : "#fff",
                  }}
                >
                  {r.fecha > 0 ? "+" : ""}
                  {compact(r.fecha)}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 12, color: INK.softer }}>fecha o mês com</Text>

                <View
                  style={{
                    marginTop: 16,
                    height: 5,
                    borderRadius: 999,
                    overflow: "hidden",
                    backgroundColor: "rgba(200,243,109,0.25)",
                  }}
                >
                  <Bar share={spent / 100} color="rgba(248,113,113,0.80)" delay={0.1 + i * 0.04} />
                </View>

                {/* Colour is spent on the one figure that carries a verdict; the two
                    inputs stay white, or the card reads as three warnings. */}
                <View style={{ marginTop: 14, flexDirection: "row", gap: 20 }}>
                  <Figure label="Entra" value={r.income} />
                  <Figure label="Sai" value={-r.expense} />
                  <Figure label="Sobra" value={r.sobra} tone={r.sobra < 0 ? RED : GREEN} />
                </View>
              </Surface>
            </Animated.View>
          );
        })}
      </View>

      <View style={{ marginTop: 18, flexDirection: "row", gap: 8, paddingHorizontal: 4 }}>
        <Info size={14} color={INK.soft} style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 17, color: INK.soft }}>
          Conta só o que já está previsto: contas fixas, parcelas lançadas e recorrências. Conforme
          novos gastos entrarem, estes valores se ajustam sozinhos.
        </Text>
      </View>

      <BottomSheet open={!!open} onClose={() => setOpen(null)} full>
        {open && (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: toneOf(open) }} />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    fontWeight: "600",
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    color: INK.soft,
                  }}
                >
                  {open.name}
                  {open.yearTag ? `/${open.yearTag}` : ""}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Fechar"
                onPress={() => setOpen(null)}
                hitSlop={10}
                style={({ pressed }) => ({
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.08)",
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <X size={16} color={INK.soft} />
              </Pressable>
            </View>

            <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Previsão de fechar com</Text>
            <Text
              numberOfLines={1}
              style={{
                marginTop: 6,
                fontSize: 38,
                fontWeight: "800",
                letterSpacing: -1.4,
                color: open.fecha < 0 ? RED : GREEN,
              }}
            >
              {open.fecha > 0 ? "+" : ""}
              {compact(open.fecha)}
            </Text>

            <MonthBreakdown row={open} prevName={MONTH_NAMES[(open.month + 11) % 12]} />

            <View
              style={{
                marginTop: 20,
                flexDirection: "row",
                gap: 8,
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.07)",
                paddingTop: 16,
              }}
            >
              <Info size={14} color={INK.softer} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 17, color: INK.softer }}>
                Só o que já está previsto entra nessa conta. Novos gastos ajustam o valor.
              </Text>
            </View>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: INK.soft }}>{label}</Text>
    </View>
  );
}

function Figure({ label, value, tone = "#fff" }: { label: string; value: number; tone?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 1.1,
          textTransform: "uppercase",
          color: INK.faint,
        }}
      >
        {label}
      </Text>
      <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 14.5, fontWeight: "700", color: tone }}>
        {value > 0 ? "+" : ""}
        {compact(value)}
      </Text>
    </View>
  );
}
