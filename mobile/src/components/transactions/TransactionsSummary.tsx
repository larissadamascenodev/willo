import { useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { ArrowDownLeft, ArrowUpRight, Info } from "~/components/icons";
import Bar from "~/components/Bar";
import SegmentedTabs from "~/components/SegmentedTabs";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th } from "~/theme/theme";
/** What a month leaves — or, when it ends short, what it lacks. */
const leftLabel = (value: number, month: string) => (value < 0 ? `Falta em ${month}` : `Sobra de ${month}`);

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * The month, read out on the page itself.
 *
 * There is no card around the balance: a figure this size is already the loudest thing on
 * the screen. Under it, two quiet glass cards side by side — Receitas and Despesas, each
 * with its total, a bar for how much of it has already happened, and the two halves written
 * out (Recebido / A receber, Já gasto / Pendente) — and then one line with what the month
 * should leave.
 *
 * What the big figure is depends on where the month stands:
 * - a month gone by shows what was left at its end;
 * - this month shows the money in the accounts now, with where it is heading;
 * - a month to come shows what it should end with — what it will bring in and pay
 *   out, on top of what this month is expected to hand over — and says how much of
 *   that comes from the month before.
 */
export default function TransactionsSummary({
  month,
  kind,
  saldoAtual,
  saldoPrevisto,
  abertura,
  balanco,
  receitas,
  despesas,
  recebidas,
  pagas,
}: {
  month: number;
  kind: "past" | "current" | "future";
  saldoAtual: number;
  saldoPrevisto: number;
  /** What the month started with. */
  abertura: number;
  /** What actually happened in the month, in minus out. */
  balanco: number;
  receitas: number;
  despesas: number;
  /** Of the income, what has already come in. */
  recebidas: number;
  /** Of the spending, what has already gone out. */
  pagas: number;
}) {
  const [why, setWhy] = useState(false);
  const before = MONTHS[(month + 11) % 12];
  const here = MONTHS[month];
  const big = kind === "past" ? abertura + balanco : kind === "future" ? saldoPrevisto : saldoAtual;
  const label = kind === "past" ? "Saldo ao fim do mês" : kind === "future" ? "Saldo previsto" : "Saldo em contas";
  const note = kind === "future" ? { text: `Vem de ${before}:`, value: abertura } : null;
  /* What the month should leave: this month, the balance expected at its end; a month gone
     by, what it actually left (in minus out); a month to come, what it should add. */
  const left = kind === "current" ? saldoPrevisto : kind === "past" ? balanco : saldoPrevisto - abertura;
  const short = left < 0;
  const leftTitle =
    kind === "current"
      ? short
        ? "Previsto para faltar"
        : "Previsto para sobrar"
      : kind === "past"
        ? short
          ? `Faltou em ${here}`
          : `Sobrou em ${here}`
        : short
          ? `Deve faltar em ${here}`
          : `Deve sobrar em ${here}`;
  const leftNote = kind === "current" ? `No fim de ${here}` : "Receitas menos despesas";

  return (
    <View style={{ paddingHorizontal: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[T.eyebrow, { fontSize: 11 }]}>{label}</Text>
        {/* A forecast says where it comes from, one tap away. */}
        {kind === "future" && (
          <Pressable
            accessibilityLabel="Como o saldo previsto é calculado"
            onPress={() => setWhy((v) => !v)}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: th(why ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.07)", "bg"),
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Info size={12} color={th(INK.soft)} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={[T.figureBig, { marginTop: 6 }, big < 0 && { color: th(RED) }]}
      >
        {money(big)}
      </Text>

      {note && (
        <Text numberOfLines={1} style={[T.note, { marginTop: 10 }]}>
          {note.text}{" "}
          <Text style={{ fontWeight: "600", color: th("rgba(255,255,255,0.8)") }}>
            {money(note.value)}
          </Text>
        </Text>
      )}

      {kind === "future" && why && (
        <Animated.View
          entering={FadeIn.duration(220)}
          style={{
            marginTop: 12,
            borderRadius: 18,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: th("rgba(255,255,255,0.14)", "line"),
            overflow: "hidden",
          }}
        >
          <BlurView intensity={50} tint={th("dark", "tint")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: th("rgba(18,20,26,0.4)", "bg") }} />
          <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: th("rgba(255,255,255,0.78)") }}>
              {leftLabel(abertura, before)} + {leftLabel(saldoPrevisto - abertura, here).toLowerCase()}.
            </Text>
            {[
              { label: leftLabel(abertura, before), value: abertura },
              { label: leftLabel(saldoPrevisto - abertura, here), value: saldoPrevisto - abertura },
            ].map((r) => (
              <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ flexShrink: 1, fontSize: 12.5, color: th(INK.soft) }}>{r.label}</Text>
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: th(r.value < 0 ? RED : "#fff") }}>
                  {r.value > 0 ? "+" : ""}
                  {money(r.value)}
                </Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: th("rgba(255,255,255,0.1)", "bg") }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: th("#fff") }}>Saldo previsto</Text>
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: th(saldoPrevisto < 0 ? RED : "#fff") }}>{money(saldoPrevisto)}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Receitas and Despesas, side by side: the total, how much has happened, and the rest. */}
      <View style={{ marginTop: 20, flexDirection: "row", gap: 10 }}>
        <FlowCard title="Receitas" inflow total={receitas} done={recebidas} doneLabel="Recebido" restLabel="A receber" />
        <FlowCard title="Despesas" total={despesas} done={pagas} doneLabel="Já gasto" restLabel="Pendente" />
      </View>

      {/* What the month should leave. */}
      <View
        style={{
          marginTop: 10,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderRadius: 20,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: th("rgba(255,255,255,0.08)", "line"),
          backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "700", color: th("#fff") }}>
            {leftTitle}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: th(INK.soft) }}>
            {leftNote}
          </Text>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { fontSize: 20, fontWeight: "800", letterSpacing: -0.4, color: th(short ? RED : GREEN) }]}>
          {money(left)}
        </Text>
      </View>
    </View>
  );
}

/** One flow of the month: its total, a bar for how much has happened, and the two halves. */
function FlowCard({
  title,
  inflow,
  total,
  done,
  doneLabel,
  restLabel,
}: {
  title: string;
  inflow?: boolean;
  total: number;
  done: number;
  doneLabel: string;
  restLabel: string;
}) {
  const rest = Math.max(0, total - done);
  const share = total > 0 ? Math.min(1, done / total) : 0;
  const Icon = inflow ? ArrowDownLeft : ArrowUpRight;
  const color = inflow ? GREEN : RED;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        padding: 14,
        borderRadius: 20,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.08)", "line"),
        backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: th(inflow ? "rgba(103,205,103,0.16)" : "rgba(248,113,113,0.16)", "bg") }}>
          <Icon size={12} color={th(color)} strokeWidth={2.6} />
        </View>
        <Text style={{ fontSize: 13, fontWeight: "600", color: th(INK.soft) }}>{title}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 8, fontSize: 19, fontWeight: "800", letterSpacing: -0.4, color: th("#fff") }]}>
        {money(total)}
      </Text>
      <View style={{ marginTop: 10, height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
        <Bar share={Math.max(share, done > 0 ? 0.03 : 0)} color={color} delay={inflow ? 0.05 : 0.12} />
      </View>
      <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "space-between", gap: 6 }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, color: th(INK.soft) }}>
          {doneLabel}
        </Text>
        <Text numberOfLines={1} style={[nums, { fontSize: 12.5, fontWeight: "700", color: th("#fff") }]}>
          {money(done)}
        </Text>
      </View>
      <View style={{ marginTop: 4, flexDirection: "row", justifyContent: "space-between", gap: 6 }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, color: th(INK.soft) }}>
          {restLabel}
        </Text>
        <Text numberOfLines={1} style={[nums, { fontSize: 12.5, fontWeight: "700", color: th(rest > 0 ? AMBER : INK.soft) }]}>
          {money(rest)}
        </Text>
      </View>
    </View>
  );
}

/** Todas / Receitas / Despesas. */
/** Which movements are on show: all, or one way. (What is pending or scheduled is a filter beside it.) */
export type TxTab = "todos" | "receita" | "despesa";

export function TransactionTabs({
  value,
  onChange,
}: {
  value: TxTab;
  onChange: (v: TxTab) => void;
}) {
  return (
    <SegmentedTabs
      value={value}
      onChange={onChange}
      options={[
        { key: "todos", label: "Todas" },
        { key: "receita", label: "Receitas" },
        { key: "despesa", label: "Despesas" },
      ]}
    />
  );
}
