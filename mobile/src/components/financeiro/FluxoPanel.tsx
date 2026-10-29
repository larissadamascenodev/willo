import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { periodStart, sumFlow, toDateKey, useCashFlow, type CashFlowEntry, type CashFlowPeriod } from "@/hooks/useCashFlow";
import { buildCashFlowBuckets, CASH_FLOW_PERIODS } from "@/lib/cashFlowBuckets";
import { MONTH_NAMES } from "@/lib/projectionRows";
import { categoryHex } from "@/lib/categoryData";
import SegmentedTabs from "~/components/SegmentedTabs";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { BlurView } from "expo-blur";
import { Eye, EyeOff, Info } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What actually moved.
 *
 * Only money that left or entered an account counts here — a purchase on a card has
 * not cost you anything yet, the invoice has. That one rule is what separates this
 * screen from the month's totals, and it is written under the figure rather than
 * assumed.
 *
 * The chart scrolls to its right edge, because the most recent column is the one you
 * came to see and a chart that opens on January is a chart you have to drag.
 */

const HEIGHT = 190;
const MONTH_UPPER = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

type SubTab = "geral" | "entradas" | "saidas";

/** One side of one column. Grows up from the floor like the rest of the app's bars. */
function Column({
  value,
  max,
  width,
  color,
  delay,
  sparse,
}: {
  value: number;
  max: number;
  width: number;
  color: string;
  delay: number;
  /** On the day-by-day view an empty day is drawn as a ring, not as nothing. */
  sparse: boolean;
}) {
  const grow = useSharedValue(0);
  const target = Math.max((value / max) * HEIGHT, width);

  useEffect(() => {
    grow.value = withDelay(
      delay * 1000,
      withTiming(value > 0 ? target : 0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, delay, value, grow]);

  const animated = useAnimatedStyle(() => ({ height: grow.value }));

  if (value <= 0) {
    return sparse ? (
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: "rgba(255,255,255,0.25)",
        }}
      />
    ) : (
      <View style={{ width, height: 2, borderRadius: 999, backgroundColor: color, opacity: 0.6 }} />
    );
  }

  return <Animated.View style={[{ width, borderRadius: 999, backgroundColor: color }, animated]} />;
}

export default function FluxoPanel({
  accountId,
  embedded = false,
}: {
  /** Read only what moved through this account. */
  accountId?: string;
  /** Inside another page: no list of its own, that page has one. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const { entries: all, loading } = useCashFlow();
  const entries = useMemo(
    () => (accountId ? all.filter((e) => e.accountId === accountId) : all),
    [all, accountId],
  );
  const [subTab, setSubTab] = useState<SubTab>("geral");
  const [period, setPeriod] = useState<CashFlowPeriod>("mes");
  const [hidden, setHidden] = useState(false);
  /* A tapped bar: one side of one column. The figure, the title and the list all narrow
     to that one value — the green bar is what came in, the red one what went out. */
  const [picked, setPicked] = useState<{ key: string; kind: "entrada" | "saida" } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const strip = useRef<ComponentRef<typeof ScrollView>>(null);

  const inPeriod = useMemo(() => {
    const from = toDateKey(periodStart(period));
    return entries.filter((e) => e.date >= from);
  }, [entries, period]);

  const buckets = useMemo(() => buildCashFlowBuckets(inPeriod, period), [inPeriod, period]);
  const pickedBucket = buckets.find((b) => b.key === picked?.key) ?? null;
  /* A day key is a whole date and a month key is "YYYY-MM": one prefix test serves both. */
  const inFocus = useMemo(
    () =>
      pickedBucket && picked
        ? inPeriod.filter((e) => e.date.startsWith(pickedBucket.key) && e.kind === picked.kind)
        : inPeriod,
    [inPeriod, pickedBucket, picked],
  );
  const totals = useMemo(() => sumFlow(inFocus), [inFocus]);

  const latest = useMemo(
    () =>
      inFocus
        .filter((e) =>
          subTab === "geral" ? true : subTab === "entradas" ? e.kind === "entrada" : e.kind === "saida",
        )
        .slice(0, 6),
    [inFocus, subTab],
  );

  /* The right edge is where today is. */
  useEffect(() => {
    const id = setTimeout(() => strip.current?.scrollToEnd({ animated: false }), 60);
    return () => clearTimeout(id);
  }, [buckets, subTab, period]);

  const max = Math.max(
    ...buckets.map((b) =>
      subTab === "entradas" ? b.entradas : subTab === "saidas" ? b.saidas : Math.max(b.entradas, b.saidas),
    ),
    1,
  );

  const headline = picked
    ? picked.kind === "entrada"
      ? totals.entradas
      : totals.saidas
    : subTab === "geral"
      ? totals.net
      : subTab === "entradas"
        ? totals.entradas
        : totals.saidas;
  const pickedColor = picked?.kind === "entrada" ? GREEN : "#EF4444";
  const single = subTab !== "geral";
  const barWidth = single ? 40 : 18;
  const slot = single ? 52 : 58;

  const subject = subTab === "geral" ? "Fluxo geral" : subTab === "entradas" ? "Entradas" : "Saídas";
  const pickedLabel = pickedBucket
    ? pickedBucket.day !== null
      ? new Date(`${pickedBucket.key}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })
      : `${MONTH_NAMES[pickedBucket.month!]}`
    : null;
  const title = pickedLabel
    ? `${picked!.kind === "entrada" ? "Entradas" : "Saídas"} em ${pickedLabel}`
    : period === "mes"
      ? `${subject} em ${MONTH_NAMES[new Date().getMonth()]}`
      : period === "1a"
        ? `${subject} no último ano`
        : `${subject} nos últimos ${period === "3m" ? 3 : 6} meses`;

  const veil = (v: number) => (hidden ? "R$ ••••" : money(v));

  return (
    <View style={{ marginTop: embedded ? 0 : 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <SegmentedTabs
            value={subTab}
            onChange={(t) => {
              setSubTab(t);
              setPicked(null);
            }}
            height={32}
            compact
            options={[
              { key: "geral" as const, label: "Geral" },
              { key: "entradas" as const, label: "Entradas" },
              { key: "saidas" as const, label: "Saídas" },
            ]}
          />
        </View>
        <Pressable
          accessibilityLabel={hidden ? "Mostrar valores" : "Ocultar valores"}
          onPress={() => setHidden((v) => !v)}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.06)",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          {hidden ? <EyeOff size={16} color={INK.soft} /> : <Eye size={16} color={INK.soft} />}
        </Pressable>
      </View>

      {/* ══ What moved, in one figure ══ */}
      <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: 20, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {picked && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: pickedColor }} />}
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, color: INK.soft }}>{title}</Text>
          {/* The rule the figure follows is one tap away, not a paragraph under it. */}
          <Pressable
            accessibilityLabel="Como isso é calculado"
            onPress={() => setNoteOpen((v) => !v)}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: noteOpen ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.07)",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Info size={12} color={INK.soft} strokeWidth={2.2} />
          </Pressable>
        </View>

        {noteOpen && (
          <Animated.View
            entering={FadeIn.duration(220)}
            style={{
              marginTop: 10,
              borderRadius: 18,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.14)",
              overflow: "hidden",
            }}
          >
            <BlurView intensity={50} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(18,20,26,0.4)" }} />
            <Text style={{ paddingHorizontal: 14, paddingVertical: 11, fontSize: 12.5, lineHeight: 18, color: "rgba(255,255,255,0.78)" }}>
              {accountId
                ? "Considera só o dinheiro que entrou e saiu desta conta. Compras no cartão entram quando a fatura é paga."
                : "Considera só o dinheiro que entrou e saiu das contas. Compras no cartão entram quando a fatura é paga."}
            </Text>
          </Animated.View>
        )}

        <Text numberOfLines={1} style={[T.figureBig, { marginTop: 2, fontSize: 34 }]}>
          {loading ? "…" : hidden ? "R$ ••••" : `${!picked && subTab === "geral" && headline < 0 ? "−" : ""}${money(Math.abs(headline))}`}
        </Text>

        {/* In and out side by side — one glance, two figures. */}
        {subTab === "geral" && !picked && (
          <View style={{ marginTop: 12, flexDirection: "row", gap: 28 }}>
            <Legend color={GREEN} label="Entradas" value={veil(totals.entradas)} />
            <Legend color="#EF4444" label="Saídas" value={veil(totals.saidas)} />
          </View>
        )}
      </Animated.View>

      {/* ══ The columns ══ */}
      <ScrollView
        ref={strip}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 22, gap: 10 }}
      >
        {buckets.map((b, i) => {
          const dim = (kind: "entrada" | "saida") => (picked && !(picked.key === b.key && picked.kind === kind) ? 0.3 : 1);
          const toggle = (kind: "entrada" | "saida") =>
            setPicked((p) => (p && p.key === b.key && p.kind === kind ? null : { key: b.key, kind }));
          const on = picked?.key === b.key || (!picked && b.isCurrent);
          return (
            <View key={b.key} style={{ width: slot, alignItems: "center" }}>
              <View style={{ height: HEIGHT, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
                {subTab !== "saidas" && (
                  <Pressable onPress={() => toggle("entrada")} hitSlop={4} style={{ justifyContent: "flex-end", height: HEIGHT, opacity: dim("entrada") }}>
                    <Column value={b.entradas} max={max} width={barWidth} color={GREEN} delay={i * 0.02} sparse={period === "mes"} />
                  </Pressable>
                )}
                {subTab !== "entradas" && (
                  <Pressable onPress={() => toggle("saida")} hitSlop={4} style={{ justifyContent: "flex-end", height: HEIGHT, opacity: dim("saida") }}>
                    <Column value={b.saidas} max={max} width={barWidth} color="#EF4444" delay={i * 0.02 + 0.03} sparse={period === "mes"} />
                  </Pressable>
                )}
              </View>
              <Text style={{ marginTop: 12, fontSize: 13, fontWeight: on ? "600" : "400", color: on ? "#fff" : INK.soft }}>
                {b.day !== null ? String(b.day).padStart(2, "0") : MONTH_UPPER[b.month!]}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: 22 }}>
        <SegmentedTabs
          value={period}
          onChange={(p) => {
            setPeriod(p);
            setPicked(null);
          }}
          height={36}
          options={CASH_FLOW_PERIODS.map((p) => ({ key: p.key, label: p.label }))}
        />
      </View>

      {!embedded && (
        <>
      {/* ══ The last few, named ══ */}
      <Text style={[T.eyebrow, { marginTop: 26, paddingHorizontal: 4 }]}>
        {subTab === "geral" ? "Últimos lançamentos" : subTab === "entradas" ? "Últimas entradas" : "Últimas saídas"}
      </Text>

      {latest.length === 0 ? (
        <Text style={{ paddingVertical: 32, textAlign: "center", fontSize: 14, color: INK.soft }}>
          Nada por aqui neste período
        </Text>
      ) : (
        <View style={{ marginTop: 6 }}>
          {latest.map((entry) => (
            <EntryRow key={entry.id} entry={entry} hidden={hidden} />
          ))}
        </View>
      )}

      <Pressable
        onPress={() => router.push("/transacoes" as never)}
        style={({ pressed }) => ({
          marginTop: 16,
          height: 52,
          borderRadius: 26,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          backgroundColor: "rgba(255,255,255,0.05)",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 15.5, fontWeight: "500", color: "#fff" }}>Ver todos os lançamentos</Text>
      </Pressable>
        </>
      )}
    </View>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={{ flexShrink: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ fontSize: 12.5, color: INK.soft }}>{label}</Text>
      </View>
      <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 16, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }}>
        {value}
      </Text>
    </View>
  );
}

function EntryRow({ entry, hidden }: { entry: CashFlowEntry; hidden: boolean }) {
  const Icon = categoryIcon(entry.category);
  const hex = categoryHex(entry.category);
  const isIn = entry.kind === "entrada";
  const date = new Date(`${entry.date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 }}>
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: chipFill(hex),
        }}
      >
        <Icon size={20} color={chipInk(hex)} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>
          {entry.name}
        </Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>
          {date} · {entry.category}
          {entry.accountName ? ` · ${entry.accountName}` : ""}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "600", color: isIn ? GREEN : RED }}>
        {hidden ? "R$ ••••" : `${isIn ? "+" : "−"}${money(entry.amount)}`}
      </Text>
    </View>
  );
}
