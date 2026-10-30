import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import type { useFinancialProjection } from "@/hooks/useFinancialProjection";
import {
  buildHistoryRows,
  buildProjectionRows,
  MONTH_NAMES,
  type MonthFlow,
  type ProjectionRowView,
} from "@/lib/projectionRows";
import { loadPastMonthFlows } from "@/services/pastMonths";
import BalanceLine from "~/components/financeiro/BalanceLine";
import MonthBreakdown from "~/components/financeiro/MonthBreakdown";
import { CalendarDays } from "~/components/icons";
import { compact } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";

/**
 * Where the balance is going.
 *
 * Balanço asks how this month closes; this follows the balance from one month into
 * the next, so each month opens with what the one before closed with. It is drawn
 * as a line, because a projection is a trajectory, six months at a time — drag it
 * back through the months already lived or on through the year ahead. The large
 * figure above is the line's readout: tap a month and the figure becomes that month, and
 * right under the line that month is written out — what came from the month before, what
 * comes in, what goes out — so there is no list of months to read through.
 *
 * Like Balanço, the figures are white and colour lives in the small things: a dot
 * beside each month for how it goes — green when it adds to the balance, amber when
 * it eats into it, red when the balance ends below zero — and red on a figure only
 * when it is below zero.
 *
 * Nothing is drawn until every month is real. The months ahead are an average
 * until they arrive, and a line that redraws itself four times is a line nobody
 * trusts.
 */

type Projection = ReturnType<typeof useFinancialProjection>;

const RULE = "rgba(255,255,255,0.08)";

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const signedValue = (v: number) => `${v < 0 ? "−" : ""}${compact(Math.abs(v))}`;
const lower = (s: string) => s.toLocaleLowerCase("pt-BR");

/* How far back the chart can be dragged. */
const MONTHS_BEHIND = 6;

/** How a month goes: adds to the balance, eats into it, or ends below zero. */
const toneOf = (r: ProjectionRowView) => (r.fecha < 0 ? RED : r.sobra < 0 ? AMBER : GREEN);

const fullName = (r: ProjectionRowView) => `${lower(r.name)}${r.yearTag ? ` de 20${r.yearTag}` : ""}`;

export default function ProjecoesPanel({ projection }: { projection: Projection }) {
  const router = useRouter();
  const { user } = useAuth();
  const { projections, data, loading, futureReady, selectedMonth, selectedYear } = projection;
  const [past, setPast] = useState<MonthFlow[] | null>(null);

  /* The months behind are read the way the months ahead are, so the line through
     them is one line. */
  useEffect(() => {
    let alive = true;
    setPast(null);
    if (!user) {
      setPast([]);
      return;
    }
    loadPastMonthFlows({ userId: user.id, month: selectedMonth, year: selectedYear, count: MONTHS_BEHIND })
      .then((flows) => alive && setPast(flows))
      .catch(() => alive && setPast([]));
    return () => {
      alive = false;
    };
  }, [user, selectedMonth, selectedYear]);

  const rows = useMemo(
    () => buildProjectionRows(projections, data.previousMonthEndingBalance),
    [projections, data.previousMonthEndingBalance],
  );
  const history = useMemo(
    () => (past ? buildHistoryRows(past, data.previousMonthEndingBalance) : []),
    [past, data.previousMonthEndingBalance],
  );
  /* The whole chart: the months lived, this one, and the year ahead. */
  const series = useMemo(() => [...history, ...rows], [history, rows]);
  const todayIndex = history.length;

  /* Kept stable, so picking a month does not make the line draw itself again. */
  const values = useMemo(() => series.map((r) => r.fecha), [series]);
  const months = useMemo(() => series.map((r) => r.month), [series]);

  /* Opens on this month; stays on whatever month was picked after that. */
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked ?? todayIndex;

  if (loading || !futureReady || past === null) return <Skeleton />;

  if ((!data.transactions.length && !data.events.length) || rows.length === 0) {
    return (
      <View style={{ marginTop: 56, alignItems: "center", paddingHorizontal: 32 }}>
        <CalendarDays size={30} color={INK.softer} strokeWidth={1.6} />
        <Text style={{ marginTop: 16, fontSize: 17, fontWeight: "600", color: "#fff" }}>
          Ainda não há o que projetar
        </Text>
        <Text style={{ marginTop: 6, textAlign: "center", fontSize: 14, lineHeight: 20, color: INK.soft }}>
          Lance suas receitas e contas fixas para ver para onde seu saldo vai.
        </Text>
        <Pressable
          onPress={() => router.push("/transacoes" as never)}
          style={({ pressed }) => ({
            marginTop: 22,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            paddingHorizontal: 22,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 14.5, fontWeight: "600", color: "#0B0B0B" }}>Ver transações</Text>
        </Pressable>
      </View>
    );
  }

  const pick = series[Math.min(selected, series.length - 1)];
  const offset = selected - todayIndex;
  const below = rows.filter((r) => r.fecha < 0);

  return (
    <View style={{ marginTop: 28, paddingHorizontal: 4 }}>
      {/* ══ The line's readout ══ */}
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ flex: 1, minWidth: 0, fontSize: 15, color: INK.soft }}>
          Saldo no fim de {fullName(pick)}
        </Text>
        <Text style={{ fontSize: 13, color: INK.softer }}>
          {offset === 0
            ? "este mês"
            : offset > 0
              ? `daqui a ${offset} ${offset === 1 ? "mês" : "meses"}`
              : `há ${-offset} ${offset === -1 ? "mês" : "meses"}`}
        </Text>
      </View>
      {/* The figure is the line's readout: when another month is picked it changes
          with a quick fade, which says the number moved rather than flickered. */}
      <Animated.View key={selected} entering={FadeIn.duration(180)}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            nums,
            {
              marginTop: 6,
              fontSize: 54,
              fontWeight: "700",
              letterSpacing: -2.2,
              color: pick.fecha < 0 ? RED : "#fff",
            },
          ]}
        >
          {signedValue(pick.fecha)}
        </Text>
        <Text style={{ marginTop: 6, fontSize: 13.5, color: INK.soft }}>
          {offset < 0
            ? `No mês, entrou ${compact(pick.income)} e saiu ${compact(pick.expense)}`
            : `No mês, entra ${compact(pick.income)} e sai ${compact(pick.expense)}`}
        </Text>
      </Animated.View>

      {/* ══ The year, as one line ══ */}
      <View style={{ marginTop: 22, marginHorizontal: -4 }}>
        <BalanceLine
          values={values}
          months={months}
          todayIndex={todayIndex}
          selected={selected}
          onSelect={setPicked}
        />
      </View>

      {below.length > 0 && (
        <View style={{ marginTop: 20, flexDirection: "row", alignItems: "baseline", gap: 9 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: RED, top: -1 }} />
          <Text style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, color: "#fff" }}>
            {below.length === 1
              ? `Seu saldo fica negativo em ${fullName(below[0])}.`
              : `Seu saldo fica negativo em ${below.length} meses, a partir de ${fullName(below[0])}.`}{" "}
            <Text style={{ color: INK.softer }}>Dá tempo de mudar.</Text>
          </Text>
        </View>
      )}

      {/* ══ The month picked on the line, written out right under it ══ */}
      <Animated.View
        key={`detail-${selected}`}
        entering={FadeIn.duration(220)}
        style={{
          marginTop: 22,
          borderRadius: 24,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          backgroundColor: "rgba(255,255,255,0.062)",
          paddingHorizontal: 18,
          paddingTop: 16,
          paddingBottom: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: toneOf(pick) }} />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: "#fff", textTransform: "capitalize" }}>{fullName(pick)}</Text>
          <Text style={{ fontSize: 12.5, color: INK.softer }}>{offset === 0 ? "mês atual" : offset < 0 ? "já passou" : "previsto"}</Text>
        </View>
        <MonthBreakdown row={pick} prevName={MONTH_NAMES[(pick.month + 11) % 12]} />
      </Animated.View>

      <Text style={{ marginTop: 14, fontSize: 12.5, lineHeight: 18, color: INK.softer }}>
        Toque num mês do gráfico para ver o que entra, o que sai e o que vem do mês anterior. Conta só o
        que já está previsto: contas fixas, parcelas lançadas e recorrências.
      </Text>
    </View>
  );
}

function Skeleton() {
  const track = "rgba(255,255,255,0.06)";
  return (
    <View style={{ marginTop: 28, paddingHorizontal: 4 }}>
      <View style={{ height: 16, width: 190, borderRadius: 6, backgroundColor: track }} />
      <View style={{ marginTop: 12, height: 52, width: 220, borderRadius: 10, backgroundColor: track }} />
      <View style={{ marginTop: 26, height: 156, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.03)" }} />
      <View style={{ marginTop: 38, height: 260, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.03)" }} />
    </View>
  );
}
