import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import type { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { buildProjectionRows, MONTH_NAMES, type ProjectionRowView } from "@/lib/projectionRows";
import type { DashboardData, FinanceEvent } from "@/types/finance";
import Surface, { Hairline } from "~/components/Surface";
import Bar from "~/components/Bar";
import BottomSheet from "~/components/BottomSheet";
import { ChevronRight, X } from "~/components/icons";
import { compact, money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * How this month closes.
 *
 * One question, answered in the order it is asked. First the answer: what the month
 * will leave once everything planned for it has happened. Then the part of that which
 * has already happened, because "deve fechar com" means little without "até agora"
 * beside it. Then where it comes from — what comes in and what goes out, each split
 * into what has moved and what is still due, on one scale so the two lengths compare
 * before the figures are read. The months after this one are a short list at the
 * foot; following the balance from one month into the next is what Projeções is for.
 *
 * Nothing is drawn until its figure is final. The months ahead arrive one at a time
 * and are stood in for by an average until they do, so drawing them straight away
 * meant numbers that changed several times before settling.
 */

type Projection = ReturnType<typeof useFinancialProjection>;

const AHEAD = 3;

const signed = (v: number) => `${v > 0 ? "+" : ""}${compact(v)}`;

export default function BalancoPanel({
  projection,
  onOpenProjecoes,
}: {
  projection: Projection;
  onOpenProjecoes: () => void;
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
  const monthName = MONTH_NAMES[selectedMonth];

  const sobra = data.receitas - data.despesas;
  const ateAgora = data.receitasRecebidas - data.despesasPagas;
  /* One scale for both sides, so the lengths answer which is bigger before the
     figures are read. */
  const scale = Math.max(data.receitas, data.despesas, 1);

  const ahead = rows.slice(1, 1 + AHEAD);

  return (
    <View style={{ marginTop: 24 }}>
      {/* ══ The answer ══ */}
      <Animated.View entering={FadeInDown.duration(380)} style={{ paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 14, color: INK.soft }}>
          {monthName} {isPast ? "fechou com" : "deve fechar com"}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            marginTop: 4,
            fontSize: 44,
            fontWeight: "800",
            letterSpacing: -1.6,
            color: sobra < 0 ? RED : GREEN,
          }}
        >
          {signed(sobra)}
        </Text>

        <Text style={{ marginTop: 6, fontSize: 13.5, color: INK.soft }}>
          {isPast ? (
            "Mês encerrado."
          ) : (
            <>
              Até agora{" "}
              <Text style={{ fontWeight: "700", color: ateAgora < 0 ? RED : "#fff" }}>{signed(ateAgora)}</Text>
              {isCurrent ? ` · faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}` : ""}
            </>
          )}
        </Text>

        {/* How far through the month, as a length rather than a count of days. */}
        {isCurrent && (
          <View
            style={{
              marginTop: 14,
              height: 4,
              borderRadius: 999,
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.07)",
            }}
          >
            <Bar share={now.getDate() / daysInMonth} color="rgba(255,255,255,0.55)" delay={0.1} />
          </View>
        )}
      </Animated.View>

      {/* ══ Where it comes from ══ */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)}>
        <Surface radius={24} style={{ marginTop: 24, padding: 18 }}>
          <FlowRow
            label="Entradas"
            total={data.receitas}
            moved={data.receitasRecebidas}
            due={data.receitasPendentes}
            movedWord="recebido"
            dueWord="a receber"
            scale={scale}
            color={GREEN}
            delay={0.12}
          />
          <View style={{ height: 18 }} />
          <FlowRow
            label="Saídas"
            total={data.despesas}
            moved={data.despesasPagas}
            due={data.despesasPendentes}
            movedWord="pago"
            dueWord="a pagar"
            scale={scale}
            color={RED}
            delay={0.18}
          />

          <Hairline style={{ marginTop: 18 }} />
          <View
            style={{
              marginTop: 14,
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Sobra do mês</Text>
            <Text style={{ fontSize: 17, fontWeight: "800", letterSpacing: -0.3, color: sobra < 0 ? RED : GREEN }}>
              {signed(sobra)}
            </Text>
          </View>
        </Surface>
      </Animated.View>

      {/* ══ The next few ══ */}
      <View
        style={{
          marginTop: 28,
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          paddingHorizontal: 4,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Próximos meses</Text>
        <Pressable onPress={onOpenProjecoes} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 12.5, fontWeight: "600", color: INK.soft }}>Ver projeções</Text>
        </Pressable>
      </View>

      {!futureReady ? (
        <View style={{ marginTop: 12, height: 3 * 62, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.04)" }} />
      ) : (
        <Animated.View entering={FadeIn.duration(300)}>
          <Surface radius={22} style={{ marginTop: 12 }}>
            {ahead.map((r, i) => (
              <View key={`${r.year}-${r.month}`}>
                {i > 0 && <Hairline style={{ marginHorizontal: 16 }} />}
                <Pressable
                  onPress={() => setOpen(r)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                    backgroundColor: pressed ? "rgba(255,255,255,0.04)" : "transparent",
                  })}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#fff" }}>
                      {r.name}
                      {r.yearTag ? <Text style={{ color: INK.softer }}> {r.yearTag}</Text> : null}
                    </Text>
                    <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: INK.softer }}>
                      entra {compact(r.income)} · sai {compact(r.expense)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15.5, fontWeight: "700", color: r.sobra < 0 ? RED : "#fff" }}>
                    {signed(r.sobra)}
                  </Text>
                  <ChevronRight size={15} color={INK.faint} />
                </Pressable>
              </View>
            ))}
          </Surface>
        </Animated.View>
      )}

      <Text style={{ marginTop: 12, paddingHorizontal: 4, fontSize: 12, lineHeight: 17, color: INK.softer }}>
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

/**
 * One side of the month: its total, and a bar where the solid part is what has
 * already moved and the faint part what is still due.
 */
function FlowRow({
  label,
  total,
  moved,
  due,
  movedWord,
  dueWord,
  scale,
  color,
  delay,
}: {
  label: string;
  total: number;
  moved: number;
  due: number;
  movedWord: string;
  dueWord: string;
  scale: number;
  color: string;
  delay: number;
}) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>{label}</Text>
        <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{money(total)}</Text>
      </View>

      <View
        style={{
          marginTop: 10,
          height: 8,
          flexDirection: "row",
          gap: 2,
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
      >
        <Bar share={moved / scale} color={color} delay={delay} />
        <Bar share={due / scale} color={`${color}59`} delay={delay + 0.08} />
      </View>

      <Text style={{ marginTop: 8, fontSize: 12, color: INK.soft }}>
        {money(moved)} {movedWord}
        <Text style={{ color: INK.faint }}> · </Text>
        {money(due)} {dueWord}
      </Text>
    </View>
  );
}

function Skeleton() {
  return (
    <View style={{ marginTop: 24, gap: 14 }}>
      <View style={{ height: 96, width: "70%", borderRadius: 18, backgroundColor: "rgba(255,255,255,0.04)" }} />
      <View style={{ height: 210, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
      <View style={{ height: 186, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.04)" }} />
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

  return (
    <BottomSheet open={!!row} onClose={onClose} full>
      {row && (
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>
              {row.name}
              {row.yearTag ? `/${row.yearTag}` : ""}
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

          <Text style={{ marginTop: 18, fontSize: 12.5, color: INK.soft }}>Sobra do mês</Text>
          <Text
            numberOfLines={1}
            style={{
              marginTop: 4,
              fontSize: 36,
              fontWeight: "800",
              letterSpacing: -1.3,
              color: row.sobra < 0 ? RED : GREEN,
            }}
          >
            {signed(row.sobra)}
          </Text>

          <EventList title="Entra" items={entradas} total={row.income} tone={GREEN} />
          <EventList title="Sai" items={saidas} total={row.expense} tone={RED} />
        </View>
      )}
    </BottomSheet>
  );
}

function EventList({
  title,
  items,
  total,
  tone,
}: {
  title: string;
  items: FinanceEvent[];
  total: number;
  tone: string;
}) {
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 1.3,
            textTransform: "uppercase",
            color: INK.softer,
          }}
        >
          {title}
        </Text>
        <Text style={{ fontSize: 15, fontWeight: "700", color: tone }}>{compact(total)}</Text>
      </View>

      {items.length === 0 ? (
        <Text style={{ marginTop: 10, fontSize: 13, color: INK.softer }}>Nada previsto.</Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          {items.map((e, i) => (
            <View
              key={`${e.id ?? e.name}-${i}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingVertical: 9,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: "rgba(255,255,255,0.05)",
              }}
            >
              <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 14, color: "#fff" }}>
                {e.name}
              </Text>
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: INK.soft }}>
                {money(Math.abs(Number(e.amount) || 0))}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
