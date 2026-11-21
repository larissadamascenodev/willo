import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";
import type { Transaction } from "@/types/finance";
import type { CustomCategory } from "@/services/categoryService";
import { useFinanceData } from "@/hooks/useFinanceData";
import { setHiddenValues, useHiddenValues } from "@/hooks/useHiddenValues";
import { loadMonthTransactions, type TransactionRow as Row } from "@/services/monthTransactions";
import Room from "~/components/Room";
import RaisedButton from "~/components/RaisedButton";
import MonthSelect from "~/components/transactions/MonthSelect";
import RecentEntries from "~/components/transactions/RecentEntries";
import { banksById, type EntryBank } from "~/components/transactions/WithBank";
import { LineChart, PeriodTabs, monthLabels } from "~/components/charts/PageCharts";
import { ChevronLeft, Eye, EyeOff } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * Fluxo de caixa: the money that came into the accounts and went out of them, in one month.
 *
 * Drawn the way every detail page is, in the app's own quiet colours: green only for what came
 * in, red only for what went out. The way back, the page's name, and the month in the corner as
 * a small pill of glass — which walks into the months ahead too, where everything is forecast:
 * what is already scheduled to pay and what is expected to come in.
 *
 * Geral, Entradas or Saídas. The month's figure large; under it, what came in and what went out
 * beside dots of their colours (or, on one side, what is done and what is still waiting). Then
 * the month as soft lines adding up day by day — solid for what has happened, dashed for what is
 * still to come — and a finger slid across them reads any day in a small pill over a lit band.
 * Then the month's latest entries, with the way to all of them in Transações.
 *
 * Only money in and out of the accounts counts: a card purchase counts when its invoice is paid.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const IN = GREEN;
/** The red of money going out, at full strength: the softer one reads grey on the dark. */
const OUT = "#FF4D4D";
const CHART_H = 220;
const PAD_X = 18;
const TOP = 46;
const FLOOR = 28;
const LATEST = 5;

type View3 = "geral" | "entradas" | "saidas";
const VIEWS: { key: View3; label: string }[] = [
  { key: "geral", label: "Geral" },
  { key: "entradas", label: "Entradas" },
  { key: "saidas", label: "Saídas" },
];

const dayOf = (t: Transaction) => Number((t.rawDate ?? "").slice(8, 10)) || 1;

export default function FluxoDeCaixa() {
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const hidden = useHiddenValues();
  const now = useMemo(() => new Date(), []);
  const [{ month, year }, setShown] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const [view, setView] = useState<View3>("geral");

  const { data, loading } = useFinanceData(month, year);
  const show = (v: number) => (hidden ? "R$ •••" : money(v));
  const when = year * 12 + month - (now.getFullYear() * 12 + now.getMonth());
  const future = when > 0;

  /* The month's entries, as Transações lists them, for the latest ones under the chart. */
  const [rows, setRows] = useState<Row[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [banks, setBanks] = useState<Record<string, EntryBank>>({});
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () =>
      loadMonthTransactions(month, year)
        .then((m) => {
          if (!alive) return;
          setRows(m.transactions);
          setCustomCats(m.customCategories);
          setBanks(banksById(m.accounts, m.creditCards as { id: string; name: string; color?: string | null }[]));
        })
        .catch(() => undefined);
    void load();
    window.addEventListener("finance-data-changed", load);
    window.addEventListener("transaction-created", load);
    return () => {
      alive = false;
      window.removeEventListener("finance-data-changed", load);
      window.removeEventListener("transaction-created", load);
    };
  }, [user, month, year]);
  const latest = useMemo(() => {
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return rows
      .filter((t) => (view === "entradas" ? t.type === "receita" : view === "saidas" ? t.type === "despesa" : true))
      .filter((t) => future || t.date <= todayKey)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, LATEST);
  }, [rows, view, future, now]);

  /* The figure, its name, and what goes under it, by the view chosen. */
  const head = (() => {
    const m = MONTHS[month];
    if (view === "entradas")
      return {
        label: future ? `Entradas previstas em ${m}` : `Entradas de ${m}`,
        value: data.receitas,
        lines: [
          { color: IN, label: "Recebido", value: data.receitasRecebidas },
          { color: INK.faint, label: "A receber", value: Math.max(0, data.receitas - data.receitasRecebidas) },
        ],
      };
    if (view === "saidas")
      return {
        label: future ? `Saídas previstas em ${m}` : `Saídas de ${m}`,
        value: data.despesas,
        lines: [
          { color: OUT, label: "Pago", value: data.despesasPagas },
          { color: INK.faint, label: "A pagar", value: Math.max(0, data.despesas - data.despesasPagas) },
        ],
      };
    return {
      label: future ? `Previsão para ${m}` : `Fluxo de ${m}`,
      value: data.receitas - data.despesas,
      lines: [
        { color: IN, label: future ? "Entradas previstas" : "Entradas", value: data.receitas },
        { color: OUT, label: future ? "Saídas previstas" : "Saídas", value: data.despesas },
      ],
    };
  })();

  /* The month day by day: running totals of what came in and what went out. */
  const series = useMemo(() => {
    const last = new Date(year, month + 1, 0).getDate();
    const inPer = new Array<number>(last + 1).fill(0);
    const outPer = new Array<number>(last + 1).fill(0);
    for (const t of data.transactions ?? []) {
      const d = Math.min(last, Math.max(1, dayOf(t)));
      if (t.type === "receita") inPer[d] += Number(t.amount) || 0;
      else outPer[d] += Number(t.amount) || 0;
    }
    const run = (per: number[]) => {
      const out = [0];
      for (let d = 1; d <= last; d++) out.push(out[d - 1] + per[d]);
      return out;
    };
    return {
      inn: run(inPer),
      out: run(outPer),
      split: when < 0 ? last : when > 0 ? 0 : now.getDate(),
      labels: monthLabels(last),
      name: (i: number) => (i === 0 ? `Início de ${SHORT[month]}` : `${i} de ${SHORT[month]}`),
    };
  }, [data, month, year, when, now]);

  return (
    <Room lit sky>
      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 74, paddingBottom: insets.bottom + 60, paddingHorizontal: 16 }}>
        {/* Which money. */}
        <View style={{ flexDirection: "row" }}>
          <PeriodTabs value={view} options={VIEWS} onChange={setView} />
        </View>

        {/* The figure, with the eye beside its name. */}
        <View style={{ marginTop: 22, paddingHorizontal: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <Animated.Text key={`${view}-${month}-${year}`} entering={FadeIn.duration(260)} numberOfLines={1} style={{ flexShrink: 1, fontSize: 17, color: th(INK.soft) }}>
              {head.label}
            </Animated.Text>
            <Pressable onPress={() => setHiddenValues(!hidden)} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? "Mostrar valores" : "Esconder valores"} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              {hidden ? <EyeOff size={19} color={th(INK.soft)} strokeWidth={2} /> : <Eye size={19} color={th(INK.soft)} strokeWidth={2} />}
            </Pressable>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 4, fontSize: 44, fontWeight: "700", letterSpacing: -1.6, color: th(view === "geral" && head.value < -0.004 ? RED : "#fff"), opacity: loading ? 0.5 : 1 }]}>
            {hidden ? "R$ •••" : `${head.value < -0.004 ? "−" : ""}${money(Math.abs(head.value))}`}
          </Text>
          <View style={{ marginTop: 10, gap: 6 }}>
            {head.lines.map((l) => (
              <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: th(l.color, "bg") }} />
                <Text style={[nums, { fontSize: 15.5, color: th(INK.soft) }]}>
                  {l.label} <Text style={{ fontWeight: "700", color: th("#fff") }}>{show(l.value)}</Text>
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ marginTop: 12, fontSize: 12.5, lineHeight: 17, color: th(INK.softer) }}>
            {future
              ? "Com o que já está agendado para pagar e o que você deve receber neste mês."
              : "Considera só o dinheiro que entrou e saiu das contas. Compras no cartão entram quando a fatura é paga."}
          </Text>
        </View>

        {/* The month, day by day. */}
        <Animated.View key={`${view}-${month}-${year}`} entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))} style={{ marginTop: 10, marginHorizontal: -16 }}>
          <LineChart
            width={width}
            span={series.inn.length - 1}
            labels={series.labels}
            dayName={series.name}
            hidden={hidden}
            series={[
              ...(view !== "entradas" ? [{ values: series.out, color: th(OUT), name: "Saídas", fill: true, split: series.split, dot: true }] : []),
              ...(view !== "saidas" ? [{ values: series.inn, color: th(IN), name: "Entradas", fill: true, split: series.split, dot: true }] : []),
            ]}
          />
        </Animated.View>

        {/* The month's latest entries, as the card's statement lists them. */}
        <View style={{ marginTop: 26 }}>
          <RecentEntries
            items={latest}
            banks={banks}
            customCats={customCats}
            hidden={hidden}
            onOpen={() => router.push("/transacoes" as never)}
            onSeeAll={() => router.push("/transacoes" as never)}
            empty={future ? "Nada lançado para este mês ainda" : "Nada lançado neste mês"}
          />
        </View>
      </Animated.ScrollView>

      {/* The top row: back, and the month in full in the corner (no name). */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <RaisedButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))} size={50}>
          <ChevronLeft size={24} color={th("#fff")} strokeWidth={2.4} />
        </RaisedButton>
        <View style={{ flex: 1 }} />
        <MonthSelect month={month} year={year} onChange={(m, y) => setShown({ month: m, year: y })} />
      </View>
    </Room>
  );
}
