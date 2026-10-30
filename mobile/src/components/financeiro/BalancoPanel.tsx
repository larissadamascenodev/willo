import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { buildProjectionRows, MONTH_NAMES, type ProjectionRowView } from "@/lib/projectionRows";
import type { DashboardData, FinanceEvent } from "@/types/finance";
import Bar from "~/components/Bar";
import MonthBars from "~/components/financeiro/MonthBars";
import MonthBreakdown from "~/components/financeiro/MonthBreakdown";
import BottomSheet from "~/components/BottomSheet";
import { ChevronRight, X } from "~/components/icons";
import { compact, money } from "~/lib/money";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";

/**
 * How this month closes.
 *
 * The month is drawn as a single bar, the way a phone draws its storage: what has
 * already been spent, what is still to go out, and what is left free, all measured
 * against what the month brings in. That one shape answers the screen's question
 * before a number is read, and everything else is the same figures written out.
 *
 * The figures are white. Colour lives only in the small things — the slices of the
 * bar, the keys under it, a dot beside a row — and each one is the colour the rest
 * of the app already gives that idea: amber for what is still due, the green for
 * money that is free, red for what goes out. That way the bar's colour lands on the
 * answer, and a large figure only turns red when the month genuinely falls short.
 * There are no boxes: the sections are told apart by space and a hairline, which is
 * also how the Fluxo tab beside it reads.
 *
 * Nothing is drawn until it is final. This month shows as soon as it has loaded; the
 * months ahead wait for the projection to say it is done, because until then they
 * are an average standing in for the real figure and would change in front of you.
 */

type Projection = ReturnType<typeof useFinancialProjection>;

const AHEAD = 3;

/* The bar's slices: what has gone, what is still due, what is free. */
const SPENT = "#FFFFFF";
const DUE = AMBER;
const FREE = GREEN;
const TRACK = "rgba(255,255,255,0.08)";
const RULE = "rgba(255,255,255,0.08)";

/* Figures line up in columns, so their digits have to be the same width. */
const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const lower = (s: string) => s.toLocaleLowerCase("pt-BR");

export default function BalancoPanel({
  projection,
  onOpenProjecoes,
  onOpenSide,
}: {
  projection: Projection;
  onOpenProjecoes?: () => void;
  /** Opens what came in or what went out, as fixed and variable. */
  onOpenSide?: (side: "receitas" | "despesas") => void;
}) {
  const { data, loading, futureReady, projections, monthData, selectedMonth, selectedYear } = projection;
  /* The month picked on the bars; this month to start with. */
  const [pickedMonth, setPickedMonth] = useState(0);

  const rows = useMemo(
    () => buildProjectionRows(projections, data.previousMonthEndingBalance),
    [projections, data.previousMonthEndingBalance],
  );

  if (loading) return <Skeleton />;

  const now = new Date();
  const isCurrent = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const isPast =
    selectedYear < now.getFullYear() ||
    (selectedYear === now.getFullYear() && selectedMonth < now.getMonth());
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysLeft = isCurrent ? daysInMonth - now.getDate() : 0;
  const month = lower(MONTH_NAMES[selectedMonth]);

  const sobra = data.receitas - data.despesas;
  const short = sobra < 0;

  /* The bar is the month's money: what comes in, or what goes out when that is
     more. Spent, still due and free are slices of it. */
  const base = Math.max(data.receitas, data.despesas, 1);
  const free = Math.max(sobra, 0);

  const headline = isPast
    ? short
      ? `Faltou em ${month}`
      : `Sobrou em ${month}`
    : short
      ? `Deve faltar em ${month}`
      : `Deve sobrar em ${month}`;

  return (
    <View style={{ marginTop: 28, paddingHorizontal: 4 }}>
      {/* ══ The answer: a quiet label, the figure with its currency set small, and one
          line of what it means ══ */}
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 1.3, textTransform: "uppercase", color: INK.soft }}>{headline}</Text>
        {isCurrent && (
          <Text style={{ fontSize: 12.5, color: INK.softer }}>
            {daysLeft === 0 ? "último dia" : `faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`}
          </Text>
        )}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginTop: 8, color: short ? RED : "#fff" }]}>
        <Text style={{ fontSize: 22, fontWeight: "700", letterSpacing: -0.4 }}>{short ? "−R$ " : "R$ "}</Text>
        <Text style={{ fontSize: 46, fontWeight: "800", letterSpacing: -1.8 }}>{money(Math.abs(sobra)).replace(/^R\$\s?/, "")}</Text>
      </Text>
      <Text style={{ marginTop: 4, fontSize: 13.5, color: INK.soft }}>
        {data.receitas > 0
          ? `${Math.round((data.despesas / data.receitas) * 100)}% do que entrou já está comprometido`
          : "Nada entrou ainda neste mês"}
      </Text>

      {/* ══ The month, as one thin bar: gone, still due, free ══ */}
      <View style={{ marginTop: 22, height: 6, flexDirection: "row", gap: 2, borderRadius: 999, overflow: "hidden", backgroundColor: TRACK }}>
        <Bar share={data.despesasPagas / base} color={SPENT} delay={0.15} />
        <Bar share={data.despesasPendentes / base} color={DUE} delay={0.4} />
        <Bar share={free / base} color={FREE} delay={0.65} />
      </View>

      <View style={{ marginTop: 14, flexDirection: "row" }}>
        <Legend swatch={SPENT} label="Gasto" value={money(data.despesasPagas)} />
        <View style={{ width: 1, marginHorizontal: 12, backgroundColor: RULE }} />
        <Legend swatch={DUE} label="A pagar" value={money(data.despesasPendentes)} />
        <View style={{ width: 1, marginHorizontal: 12, backgroundColor: RULE }} />
        {short ? (
          <Legend swatch={RED} label="Falta" value={money(Math.abs(sobra))} tone={RED} />
        ) : (
          <Legend swatch={FREE} label="Livre" value={money(free)} />
        )}
      </View>

      {/* ══ What came in and what went out, as the home draws them: two bars on one
          scale, straight on the ground. Each opens into what was fixed and what varied. ══ */}
      <View style={{ marginTop: 30, gap: 4 }}>
        <Flow label="Receitas" amount={data.receitas} scale={Math.max(data.receitas, data.despesas, 1)} inflow onPress={onOpenSide ? () => onOpenSide("receitas") : undefined} />
        <Flow label="Despesas" amount={data.despesas} scale={Math.max(data.receitas, data.despesas, 1)} onPress={onOpenSide ? () => onOpenSide("despesas") : undefined} />
      </View>

      {/* ══ Month by month: what each one leaves over, as bars; the picked one written out
          under them. It opens on this month, which is the answer above. ══ */}
      <View style={{ marginTop: 38, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>Mês a mês</Text>
        {onOpenProjecoes && (
          <Pressable onPress={onOpenProjecoes} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Text style={{ fontSize: 14, color: INK.soft }}>Ver projeções</Text>
          </Pressable>
        )}
      </View>

      {!futureReady || rows.length === 0 ? (
        <View style={{ marginTop: 16, height: 150, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.03)" }} />
      ) : (
        <Animated.View entering={FadeIn.duration(260)} style={{ marginTop: 16 }}>
          <View style={{ marginHorizontal: -4 }}>
            <MonthBars
              bars={rows.slice(0, 12).map((r) => ({ month: r.month, year: r.year, value: r.sobra }))}
              todayIndex={0}
              selected={pickedMonth}
              onSelect={setPickedMonth}
            />
          </View>
          {(() => {
            const r = rows[Math.min(pickedMonth, rows.length - 1)];
            return (
              <Animated.View key={`month-${pickedMonth}`} entering={FadeIn.duration(220)} style={{ marginTop: 22 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Dot color={r.sobra < 0 ? RED : r.risk === "atencao" ? AMBER : GREEN} />
                  <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: "#fff" }}>
                    {r.name}
                    {r.yearTag ? <Text style={{ color: INK.softer, fontWeight: "500" }}> de 20{r.yearTag}</Text> : null}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: INK.softer }}>{pickedMonth === 0 ? "mês atual" : "previsto"}</Text>
                </View>
                <MonthBreakdown row={r} prevName="" carry={false} />
              </Animated.View>
            );
          })()}
        </Animated.View>
      )}

      <Text style={{ marginTop: 14, fontSize: 12.5, lineHeight: 18, color: INK.softer }}>
        Cada mês aqui conta só o que entra e sai nele. O saldo que passa de um mês para o outro está
        em Projeções.
      </Text>
    </View>
  );
}

/** A key under the bar: which slice it is, and how much. */
function Legend({
  swatch,
  label,
  value,
  tone = "#fff",
}: {
  swatch: string;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: swatch }} />
        <Text style={{ fontSize: 12, color: INK.softer }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[nums, { marginTop: 5, fontSize: 15, fontWeight: "600", color: tone }]}>
        {value}
      </Text>
    </View>
  );
}

/** A small mark of colour — the only place most of this screen carries any. */
function Dot({ color }: { color: string }) {
  return <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />;
}

function Skeleton() {
  return (
    <View style={{ marginTop: 28, paddingHorizontal: 4 }}>
      <View style={{ height: 16, width: 170, borderRadius: 6, backgroundColor: TRACK }} />
      <View style={{ marginTop: 12, height: 52, width: 210, borderRadius: 10, backgroundColor: TRACK }} />
      <View style={{ marginTop: 26, height: 12, borderRadius: 999, backgroundColor: TRACK }} />
      <View style={{ marginTop: 34, height: 230, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.03)" }} />
    </View>
  );
}

/**
 * What makes a month's balance, without having to go and change the month on another
 * screen to find out: everything coming in on one side, everything going out on the
 * other.
 */
function MonthSheet({
  row,
  data,
  onClose,
}: {
  row: ProjectionRowView | null;
  data?: DashboardData;
  onClose: () => void;
}) {
  const events = data?.events ?? [];
  const entradas = events.filter((e) => e.type === "receita");
  const saidas = events.filter((e) => e.type !== "receita");
  const behind = (row?.sobra ?? 0) < 0;

  return (
    <BottomSheet open={!!row} onClose={onClose} full>
      {row && (
        <View style={{ paddingHorizontal: 22 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 15, color: INK.soft }}>
              {behind ? "Deve faltar em" : "Deve sobrar em"} {lower(row.name)}
              {row.yearTag ? ` de 20${row.yearTag}` : ""}
            </Text>
            <Pressable
              accessibilityLabel="Fechar"
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.06)",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <X size={16} color={INK.soft} />
            </Pressable>
          </View>

          <Text
            numberOfLines={1}
            style={[
              nums,
              {
                marginTop: 4,
                fontSize: 44,
                fontWeight: "700",
                letterSpacing: -1.8,
                color: behind ? RED : "#fff",
              },
            ]}
          >
            {compact(Math.abs(row.sobra))}
          </Text>

          <EventList title="Entra" dot={GREEN} items={entradas} total={row.income} />
          <EventList title="Sai" dot={RED} items={saidas} total={row.expense} />
        </View>
      )}
    </BottomSheet>
  );
}

function EventList({
  title,
  dot,
  items,
  total,
}: {
  title: string;
  dot: string;
  items: FinanceEvent[];
  total: number;
}) {
  return (
    <View style={{ marginTop: 28 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: RULE,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <Dot color={dot} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>{title}</Text>
        </View>
        <Text style={[nums, { fontSize: 16, fontWeight: "600", color: "#fff" }]}>{compact(total)}</Text>
      </View>

      {items.length === 0 ? (
        <Text style={{ marginTop: 12, fontSize: 13.5, color: INK.softer }}>Nada previsto.</Text>
      ) : (
        items.map((e, i) => (
          <View
            key={`${e.id ?? e.name}-${i}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingVertical: 11,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255,255,255,0.05)",
            }}
          >
            <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 14.5, color: "#fff" }}>
              {e.name}
            </Text>
            <Text style={[nums, { fontSize: 14, color: INK.soft }]}>
              {money(Math.abs(Number(e.amount) || 0))}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

/** One of the two flows, as on the home: its name and figure, and its bar under them. */
function Flow({ label, amount, scale, inflow = false, onPress }: { label: string; amount: number; scale: number; inflow?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ fontSize: 14.5, color: INK.soft }}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={[nums, { fontSize: 16, fontWeight: "600", color: "#fff" }]}>
            {inflow ? "" : "−"}
            {money(amount)}
          </Text>
          {onPress && <ChevronRight size={15} color={INK.faint} />}
        </View>
      </View>
      <View style={{ marginTop: 8, height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)" }}>
        <Bar share={Math.max(amount / scale, amount > 0 ? 0.03 : 0)} color={inflow ? GREEN : RED} delay={inflow ? 0.05 : 0.12} />
      </View>
    </Pressable>
  );
}
