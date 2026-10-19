import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { buildProjectionRows, MONTH_NAMES, type ProjectionRowView } from "@/lib/projectionRows";
import type { DashboardData, FinanceEvent } from "@/types/finance";
import Surface from "~/components/Surface";
import Bar, { FlexBar } from "~/components/Bar";
import BottomSheet from "~/components/BottomSheet";
import MonthBreakdown from "~/components/financeiro/MonthBreakdown";
import { ChevronRight, Info, X } from "~/components/icons";
import { compact, money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * How the month is closing.
 *
 * The dashboard card already says the verdict in a sentence, so repeating it here
 * would waste the screen: this shows how the month is built, how far through it you
 * are, and where the months after it land.
 *
 * Each month ahead is drawn as the two bars it is made of rather than as its result
 * alone, on one shared scale — the month that fails is the one whose lower bar runs
 * past the upper one, and you see which and why in the same glance.
 */
export default function BalancoPanel({ onOpenProjecoes }: { onOpenProjecoes: () => void }) {
  const { projections, data, loading, selectedMonth, selectedYear, monthData } = useFinancialProjection();
  const [open, setOpen] = useState<ProjectionRowView | null>(null);

  const rows = useMemo(
    () => buildProjectionRows(projections, data.previousMonthEndingBalance),
    [projections, data.previousMonthEndingBalance],
  );

  if (loading || rows.length === 0) {
    return (
      <View style={{ marginTop: 20, gap: 12 }}>
        <View style={{ height: 260, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.04)" }} />
        <View style={{ height: 130, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.04)" }} />
      </View>
    );
  }

  const [current, ...ahead] = rows;
  const now = new Date();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const isPast =
    selectedYear < now.getFullYear() ||
    (selectedYear === now.getFullYear() && selectedMonth < now.getMonth());
  const dayOfMonth = isCurrentMonth ? now.getDate() : daysInMonth;
  const daysLeft = daysInMonth - dayOfMonth;

  const spent =
    current.income > 0
      ? Math.min((current.expense / current.income) * 100, 100)
      : current.expense > 0
        ? 100
        : 0;
  /* The month on its own: what came in less what went out. What last month left over
     belongs to the running balance, which is what Projeções is for. */
  const perDay = daysLeft > 0 ? current.sobra / daysLeft : 0;

  const aheadRows = rows.slice(1, 7);
  /* One scale for the whole stack, taken from the largest side of any month shown,
     so a bar means the same length in every card. */
  const aheadScale = Math.max(...aheadRows.flatMap((r) => [r.income, r.expense]), 1);

  return (
    <View style={{ marginTop: 18 }}>
      <Animated.View entering={FadeInDown.duration(400)}>
        <Surface radius={26} style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 }}>
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: "600",
              letterSpacing: 1.3,
              textTransform: "uppercase",
              color: INK.soft,
            }}
          >
            {isPast ? "Balanço final" : isCurrentMonth ? "Balanço parcial" : "Balanço previsto"} ·{" "}
            {current.name}
          </Text>

          <Text
            numberOfLines={1}
            style={{
              marginTop: 12,
              fontSize: 40,
              fontWeight: "800",
              letterSpacing: -1.4,
              color: current.sobra < 0 ? RED : GREEN,
            }}
          >
            {current.sobra > 0 ? "+" : ""}
            {compact(current.sobra)}
          </Text>
          <Text style={{ marginTop: 6, fontSize: 12.5, color: INK.soft }}>
            {current.sobra < 0 ? "faltando no mês" : "sobrando no mês"}
            {isCurrentMonth && daysLeft > 0 ? ` · ${compact(perDay)} por dia até o fim` : ""}
          </Text>

          {/* The month split in two rather than a track being eaten: spending grows
              the red by exactly as much as it shrinks the green. */}
          <View style={{ marginTop: 16, flexDirection: "row", height: 6, gap: 3 }}>
            <FlexBar
              share={Math.max(spent, current.expense > 0 ? 3 : 0) / 100}
              color={RED}
              minWidth={0}
              delay={0.08}
            />
            <FlexBar
              share={Math.max(100 - spent, current.sobra > 0 ? 3 : 0) / 100}
              color={GREEN}
              minWidth={0}
              delay={0.08}
            />
          </View>

          <MonthBreakdown
            row={current}
            prevName={MONTH_NAMES[(current.month + 11) % 12]}
            carry={false}
          />
        </Surface>
      </Animated.View>

      {isCurrentMonth && (
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <Surface radius={22} style={{ marginTop: 10, paddingHorizontal: 18, paddingVertical: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: "600",
                  letterSpacing: 1.3,
                  textTransform: "uppercase",
                  color: INK.soft,
                }}
              >
                Mês em andamento
              </Text>
              <Text style={{ fontSize: 12, color: INK.soft }}>
                {daysLeft} {daysLeft === 1 ? "dia restante" : "dias restantes"}
              </Text>
            </View>
            {/* One tick per day, so the month's shape is a thing you can see rather
                than a number you have to subtract. */}
            <View style={{ marginTop: 12, flexDirection: "row", gap: 2 }}>
              {Array.from({ length: daysInMonth }, (_, d) => (
                <View
                  key={d}
                  style={{
                    flex: 1,
                    height: 14,
                    borderRadius: 2,
                    backgroundColor:
                      d + 1 < dayOfMonth
                        ? "rgba(255,255,255,0.45)"
                        : d + 1 === dayOfMonth
                          ? "#fff"
                          : "rgba(255,255,255,0.07)",
                  }}
                />
              ))}
            </View>
          </Surface>
        </Animated.View>
      )}

      {ahead.length > 0 && (
        <>
          <View
            style={{
              marginTop: 26,
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
              Balanço dos próximos meses
            </Text>
            <Pressable onPress={onOpenProjecoes} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: INK.soft }}>Ver tudo</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 12, gap: 8 }}>
            {aheadRows.map((r, i) => {
              const negative = r.sobra < 0;
              return (
                <Animated.View key={`${r.year}-${r.month}`} entering={FadeInDown.delay(80 + i * 40).duration(380)}>
                  <Pressable
                    onPress={() => setOpen(r)}
                    style={({ pressed }) => ({
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: negative ? "rgba(248,113,113,0.22)" : "rgba(255,255,255,0.07)",
                      backgroundColor: "rgba(255,255,255,0.062)",
                      paddingHorizontal: 16,
                      paddingTop: 14,
                      paddingBottom: 16,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 11,
                          fontWeight: "600",
                          letterSpacing: 1.4,
                          textTransform: "uppercase",
                          color: INK.softer,
                        }}
                      >
                        {r.name}
                        {r.yearTag ? ` ${r.yearTag}` : ""}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text
                          style={{
                            fontSize: 19,
                            fontWeight: "800",
                            letterSpacing: -0.6,
                            color: negative ? RED : "#fff",
                          }}
                        >
                          {r.sobra > 0 ? "+" : ""}
                          {compact(r.sobra)}
                        </Text>
                        <ChevronRight size={14} color="rgba(255,255,255,0.25)" />
                      </View>
                    </View>

                    <View style={{ marginTop: 14, gap: 7 }}>
                      <ScaleBar label="Entra" value={r.income} scale={aheadScale} color={GREEN} delay={0.04 * i} />
                      <ScaleBar label="Sai" value={r.expense} scale={aheadScale} color={RED} delay={0.04 * i + 0.03} />
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          <View style={{ marginTop: 16, flexDirection: "row", gap: 8, paddingHorizontal: 4 }}>
            <Info size={14} color={INK.softer} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 17, color: INK.softer }}>
              Cada mês conta só o que entra e sai nele, sem o que sobrou do anterior. Só o que já está
              previsto entra na conta.
            </Text>
          </View>
        </>
      )}

      <MonthSheet
        row={open}
        data={open ? monthData.get(`${open.month}-${open.year}`) : undefined}
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

/** A month's two inputs, on the scale shared by every month in the stack. */
function ScaleBar({
  label,
  value,
  scale,
  color,
  delay,
}: {
  label: string;
  value: number;
  scale: number;
  color: string;
  delay: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text
        style={{
          width: 38,
          fontSize: 9.5,
          fontWeight: "600",
          letterSpacing: 0.9,
          textTransform: "uppercase",
          color: INK.faint,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flex: 1,
          minWidth: 0,
          height: 5,
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
      >
        <Bar share={Math.max(value / scale, 0.02)} color={color} delay={delay} />
      </View>
      <Text style={{ width: 66, textAlign: "right", fontSize: 11, fontWeight: "500", color: INK.softer }}>
        {compact(value)}
      </Text>
    </View>
  );
}

/**
 * What makes a month's balance, without having to go and change the month on another
 * screen to find out: everything coming in on one side, everything going out on the
 * other, and the two sums meeting at the bottom.
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

          <Text style={{ marginTop: 18, fontSize: 12.5, color: INK.soft }}>Balanço do mês</Text>
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
            {row.sobra > 0 ? "+" : ""}
            {compact(row.sobra)}
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
