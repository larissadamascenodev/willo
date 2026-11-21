import { useMemo, useState } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import type { Transaction } from "@/types/finance";
import Surface from "~/components/Surface";
import { GrowBar } from "~/components/charts/PageCharts";
import { COMPACT_H } from "~/components/home/WidgetBoard";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th } from "~/theme/theme";

/**
 * Fluxo do mês, on the home: the month in weeks.
 *
 * What came in and what went out, each with its figure, then the month's weeks side by side —
 * for each, a green bar for what came in and a red one for what went out, on one scale — so the
 * card says not only how much but when: the week the salary landed, the week the bills went.
 * The weeks still to come stand faint (what is scheduled in them), this week's name lit.
 * The money counted is the Fluxo de caixa page's own (a card purchase when its invoice is paid),
 * which a touch opens.
 *
 * Large, the two figures sit side by side over a taller chart with each week's days under it,
 * and how much of what came in has already gone out heads the card; compact, the figures stack
 * and each week is named by its first day.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const dayOf = (t: Transaction) => Number((t.rawDate ?? "").slice(8, 10)) || 1;

export default function FluxoWeeksCard({
  size,
  receitas,
  despesas,
  transactions,
  month,
  isCurrentMonth = true,
  hidden,
}: {
  size: "half" | "full";
  receitas: number;
  despesas: number;
  transactions: Transaction[];
  month: number;
  isCurrentMonth?: boolean;
  hidden?: boolean;
}) {
  const router = useRouter();
  const half = size === "half";
  const [w, setW] = useState(0);
  const show = (v: number) => (hidden ? "R$ •••" : money(v));

  /* The month cut into weeks of seven days (the last takes what is left), each with what came
     in and what went out in it. */
  const weeks = useMemo(() => {
    const now = new Date();
    const year = isCurrentMonth ? now.getFullYear() : month > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
    const last = new Date(year, month + 1, 0).getDate();
    const list = [0, 1, 2, 3, 4]
      .filter((i) => i * 7 + 1 <= last)
      .map((i) => ({ from: i * 7 + 1, to: i === 4 || i * 7 + 7 > last ? last : i * 7 + 7, inn: 0, out: 0 }));
    /* A fifth week of a day or two is folded into the fourth. */
    if (list.length === 5 && list[4].to - list[4].from < 2) {
      list[3].to = last;
      list.pop();
    }
    for (const t of transactions) {
      const d = Math.min(last, Math.max(1, dayOf(t)));
      const wk = list.findIndex((x) => d >= x.from && d <= x.to);
      if (wk < 0) continue;
      if (t.type === "receita") list[wk].inn += Number(t.amount) || 0;
      else list[wk].out += Number(t.amount) || 0;
    }
    const today = isCurrentMonth ? now.getDate() : last + 1;
    const current = list.findIndex((x) => today >= x.from && today <= x.to);
    return { list, current: isCurrentMonth ? current : -1, ahead: (i: number) => isCurrentMonth && i > current };
  }, [transactions, month, isCurrentMonth]);

  const used = receitas > 0 ? Math.round((despesas / receitas) * 100) : null;

  /* The chart's measures. */
  const chartH = half ? 84 : 112;
  const labelH = half ? 16 : 20;
  const barW = half ? 7 : 12;
  const pairGap = half ? 3 : 4;
  const scale = Math.max(1, ...weeks.list.map((x) => Math.max(x.inn, x.out))) * 1.08;
  const slot = weeks.list.length > 0 ? w / weeks.list.length : 0;
  const heightOf = (v: number) => (v > 0 ? Math.max(4, (v / scale) * chartH) : 2);

  return (
    <Surface
      onPress={() => router.push("/fluxo-de-caixa" as never)}
      style={{ height: half ? COMPACT_H : undefined, paddingHorizontal: half ? 14 : 18, paddingTop: half ? 15 : 18, paddingBottom: half ? 12 : 16 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text numberOfLines={1} style={[T.eyebrow, { color: th(INK.soft) }]}>
          Fluxo do mês
        </Text>
        {!half && used !== null && (
          <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: 12.5, color: th(INK.soft) }]}>
            <Text style={{ fontWeight: "700", color: th(used > 100 ? RED : "#fff") }}>{used}%</Text> do que entrou já saiu
          </Text>
        )}
      </View>

      {/* What came in and what went out. */}
      {half ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          <Figure small label="Entrou" value={show(receitas)} color={GREEN} />
          <Figure small label="Saiu" value={hidden ? "R$ •••" : `−${money(despesas)}`} color={RED} />
        </View>
      ) : (
        <View style={{ marginTop: 14, flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Figure label="Entrou" value={show(receitas)} color={GREEN} />
          </View>
          <View style={{ flex: 1 }}>
            <Figure label="Saiu" value={hidden ? "R$ •••" : `−${money(despesas)}`} color={RED} />
          </View>
        </View>
      )}

      {/* The weeks: in and out side by side in each, on one scale. */}
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginTop: half ? "auto" : 20, height: chartH + labelH }}>
        <View style={{ position: "absolute", left: 0, right: 0, bottom: labelH, height: 1, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }} />
        {w > 0 &&
          weeks.list.map((x, i) => {
            const mid = slot * i + slot / 2;
            const ahead = weeks.ahead(i);
            const on = i === weeks.current;
            return (
              <View key={x.from} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                <GrowBar left={mid - pairGap / 2 - barW} width={barW} height={heightOf(x.inn)} bottom={labelH + 1} color={th(GREEN, "bg")} strong={!ahead} delay={60 + i * 70} />
                <GrowBar left={mid + pairGap / 2} width={barW} height={heightOf(x.out)} bottom={labelH + 1} color={th(RED, "bg")} strong={!ahead} delay={100 + i * 70} />
                <Text
                  numberOfLines={1}
                  style={[nums, { position: "absolute", bottom: 0, left: mid - slot / 2, width: slot, textAlign: "center", fontSize: half ? 10.5 : 12, fontWeight: on ? "700" : "500", color: th(on ? "#fff" : INK.softer) }]}
                >
                  {half ? x.from : `${x.from}–${x.to}`}
                </Text>
              </View>
            );
          })}
      </View>
    </Surface>
  );
}

/** One side of the month: a mark of its colour, its name, and the figure. */
function Figure({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  const out = color === RED;
  if (small) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 3, height: 11, borderRadius: 1.5, backgroundColor: th(color, "bg") }} />
        <Text style={{ fontSize: 12.5, fontWeight: "500", color: th(INK.soft) }}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[nums, { flex: 1, textAlign: "right", fontSize: 13, fontWeight: "700", color: th(out ? RED : "#fff") }]}>
          {value}
        </Text>
      </View>
    );
  }
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 3, height: 12, borderRadius: 1.5, backgroundColor: th(color, "bg") }} />
        <Text style={{ fontSize: 13.5, color: th(INK.soft) }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginTop: 3, fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: th(out ? RED : "#fff") }]}>
        {value}
      </Text>
    </View>
  );
}
