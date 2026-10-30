import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { buildProjectionRows, MONTH_NAMES, type ProjectionRowView } from "@/lib/projectionRows";
import type { DashboardData, FinanceEvent } from "@/types/finance";
import Bar from "~/components/Bar";
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
  closeOnly = false,
  nextOnly = false,
}: {
  projection: Projection;
  onOpenProjecoes?: () => void;
  /** Leaves out the month written out (entrou, saiu) — for a page that shows that above it. */
  closeOnly?: boolean;
  /** Only the next few months — for a page that draws the close itself. */
  nextOnly?: boolean;
}) {
  const { data, loading, futureReady, projections, monthData, selectedMonth, selectedYear } = projection;
  const [open, setOpen] = useState<ProjectionRowView | null>(null);

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
  const ateAgora = data.receitasRecebidas - data.despesasPagas;

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
    <View style={{ marginTop: nextOnly ? 0 : 28, paddingHorizontal: 4 }}>
      {!nextOnly && (
      <>
      {/* ══ The answer ══ */}
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ fontSize: 15, color: INK.soft }}>{headline}</Text>
        {isCurrent && (
          <Text style={{ fontSize: 13, color: INK.softer }}>
            {daysLeft === 0 ? "último dia" : `faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`}
          </Text>
        )}
      </View>
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
            color: short ? RED : "#fff",
          },
        ]}
      >
        {compact(Math.abs(sobra))}
      </Text>

      {/* ══ The month, as one bar ══ */}
      <View
        style={{
          marginTop: 26,
          height: 12,
          flexDirection: "row",
          gap: 3,
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor: TRACK,
        }}
      >
        <Bar share={data.despesasPagas / base} color={SPENT} delay={0.15} />
        <Bar share={data.despesasPendentes / base} color={DUE} delay={0.4} />
        <Bar share={free / base} color={FREE} delay={0.65} />
      </View>

      <View style={{ marginTop: 16, flexDirection: "row", gap: 12 }}>
        <Legend swatch={SPENT} label="Gasto" value={compact(data.despesasPagas)} />
        <Legend swatch={DUE} label="A pagar" value={compact(data.despesasPendentes)} />
        {short ? (
          <Legend swatch={RED} label="Falta" value={compact(Math.abs(sobra))} tone={RED} />
        ) : (
          <Legend swatch={FREE} label="Livre" value={compact(free)} />
        )}
      </View>

      </>
      )}

      {!closeOnly && !nextOnly && (
      <>
      {/* ══ The same month, written out ══ */}
      <View style={{ marginTop: 34, borderTopWidth: 1, borderTopColor: RULE }}>
        <LedgerRow
          dot={GREEN}
          label="Entrou"
          value={money(data.receitas)}
          note={`${money(data.receitasRecebidas)} recebido e ${money(data.receitasPendentes)} a receber`}
        />
        <LedgerRow
          dot={RED}
          label="Saiu"
          value={money(data.despesas)}
          note={`${money(data.despesasPagas)} pago e ${money(data.despesasPendentes)} a pagar`}
        />
        {!isPast && (
          <LedgerRow
            label="Até agora"
            value={`${ateAgora < 0 ? "−" : ""}${money(Math.abs(ateAgora))}`}
            note="O que já entrou menos o que já saiu"
          />
        )}
      </View>

      </>
      )}

      {/* ══ The next few ══ */}
      <View
        style={{
          marginTop: 38,
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>
          Próximos meses
        </Text>
        {onOpenProjecoes && (
          <Pressable onPress={onOpenProjecoes} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Text style={{ fontSize: 14, color: INK.soft }}>Ver projeções</Text>
          </Pressable>
        )}
      </View>

      {!futureReady ? (
        <View style={{ marginTop: 14, gap: 1 }}>
          {Array.from({ length: AHEAD }, (_, i) => (
            <View key={i} style={{ height: 52, borderTopWidth: 1, borderTopColor: RULE }} />
          ))}
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(260)} style={{ marginTop: 10 }}>
          {rows.slice(1, 1 + AHEAD).map((r) => {
            const behind = r.sobra < 0;
            return (
              <Pressable
                key={`${r.year}-${r.month}`}
                onPress={() => setOpen(r)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 16,
                  borderTopWidth: 1,
                  borderTopColor: RULE,
                  opacity: pressed ? 0.55 : 1,
                })}
              >
                <Dot color={behind ? RED : r.risk === "atencao" ? AMBER : GREEN} />
                <Text style={{ flex: 1, minWidth: 0, fontSize: 16, color: "#fff" }}>
                  {r.name}
                  {r.yearTag ? <Text style={{ color: INK.softer }}> de 20{r.yearTag}</Text> : null}
                </Text>
                <Text style={[nums, { fontSize: 16, fontWeight: "600", color: behind ? RED : "#fff" }]}>
                  {behind ? "−" : ""}
                  {compact(Math.abs(r.sobra))}
                </Text>
                <ChevronRight size={15} color={INK.faint} />
              </Pressable>
            );
          })}
        </Animated.View>
      )}

      <Text style={{ marginTop: 14, fontSize: 12.5, lineHeight: 18, color: INK.softer }}>
        Cada mês aqui conta só o que entra e sai nele. O saldo que passa de um mês para o outro está
        em Projeções.
      </Text>

      <MonthSheet
        row={open}
        data={open ? monthData.get(`${open.month}-${open.year}`) : undefined}
        onClose={() => setOpen(null)}
      />
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View
          style={{
            width: 9,
            height: 9,
            borderRadius: 3,
            backgroundColor: swatch,
          }}
        />
        <Text style={{ fontSize: 12.5, color: INK.soft }}>{label}</Text>
      </View>
      <Text numberOfLines={1} style={[nums, { marginTop: 6, fontSize: 16, fontWeight: "600", color: tone }]}>
        {value}
      </Text>
    </View>
  );
}

/** A small mark of colour — the only place most of this screen carries any. */
function Dot({ color }: { color: string }) {
  return <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />;
}

/** One line of the month written out, with what it is made of under it. */
function LedgerRow({
  label,
  value,
  note,
  dot,
}: {
  label: string;
  value: string;
  note: string;
  dot?: string;
}) {
  return (
    <View style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: RULE }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          {dot && <Dot color={dot} />}
          <Text style={{ fontSize: 16, color: "#fff" }}>{label}</Text>
        </View>
        <Text style={[nums, { fontSize: 16, fontWeight: "600", color: "#fff" }]}>{value}</Text>
      </View>
      <Text style={{ marginTop: 4, marginLeft: dot ? 16 : 0, fontSize: 12.5, color: INK.softer }}>{note}</Text>
    </View>
  );
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
