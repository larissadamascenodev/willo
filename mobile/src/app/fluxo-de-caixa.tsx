import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, FadeIn, FadeInDown, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import type { Transaction } from "@/types/finance";
import type { CustomCategory } from "@/services/categoryService";
import { useFinanceData } from "@/hooks/useFinanceData";
import { setHiddenValues, useHiddenValues } from "@/hooks/useHiddenValues";
import { loadMonthTransactions, type AccountRow, type TransactionRow as Row } from "@/services/monthTransactions";
import Room from "~/components/Room";
import RaisedButton from "~/components/RaisedButton";
import Surface from "~/components/Surface";
import MonthPill from "~/components/transactions/MonthPill";
import TransactionRow from "~/components/transactions/TransactionRow";
import { PeriodTabs } from "~/components/charts/PageCharts";
import { ChevronLeft, ChevronRight, Eye, EyeOff } from "~/components/icons";
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

/** A curve through the points that never swings past them. */
function curve(pts: { x: number; y: number }[], from = 0, to = pts.length - 1) {
  const n = pts.length;
  if (n === 0) return "";
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) s[i] = (pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x || 1);
  const t = new Array<number>(n).fill(0);
  if (n > 1) {
    t[0] = s[0];
    t[n - 1] = s[n - 2];
  }
  for (let i = 1; i < n - 1; i++) t[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
  let d = `M ${pts[from].x.toFixed(1)} ${pts[from].y.toFixed(1)}`;
  for (let i = from; i < to; i++) {
    const h = pts[i + 1].x - pts[i].x;
    d += ` C ${(pts[i].x + h / 3).toFixed(1)} ${(pts[i].y + (t[i] * h) / 3).toFixed(1)} ${(pts[i + 1].x - h / 3).toFixed(1)} ${(pts[i + 1].y - (t[i + 1] * h) / 3).toFixed(1)} ${pts[i + 1].x.toFixed(1)} ${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

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
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [cards, setCards] = useState<unknown[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () =>
      loadMonthTransactions(month, year)
        .then((m) => {
          if (!alive) return;
          setRows(m.transactions);
          setAccounts(m.accounts);
          setCards(m.creditCards);
          setCustomCats(m.customCategories);
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
  const accountName = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a.name])), [accounts]);
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
      labels: [1, 8, 15, 22, last].map((d) => ({ at: d, text: String(d).padStart(2, "0") })),
      name: (i: number) => (i === 0 ? `Início de ${SHORT[month]}` : `${i} de ${SHORT[month]}`),
    };
  }, [data, month, year, when, now]);

  return (
    <Room lit sky>
      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 74, paddingBottom: insets.bottom + 60, paddingHorizontal: 16 }}>
        <PeriodTabs value={view} options={VIEWS} onChange={setView} />

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
          <FlowChart width={width} series={series} view={view} hidden={hidden} />
        </Animated.View>

        {/* The month's latest entries. */}
        <View style={{ marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: th(INK.soft) }}>Últimos lançamentos</Text>
          <Pressable onPress={() => router.push("/transacoes" as never)} hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 2, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: th("#fff") }}>Ver mais</Text>
            <ChevronRight size={16} color={th("#fff")} strokeWidth={2.2} />
          </Pressable>
        </View>
        {latest.length === 0 ? (
          <Text style={{ marginTop: 14, paddingHorizontal: 4, fontSize: 14, color: th(INK.softer) }}>Nada lançado {future ? "para este mês ainda" : "neste mês"}.</Text>
        ) : (
          <Surface radius={26} style={{ marginTop: 10, paddingHorizontal: 12, paddingVertical: 4 }}>
            {latest.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                accountName={tx.account_id ? accountName[tx.account_id] : undefined}
                customCategories={customCats}
                creditCards={cards as never}
                onPress={() => router.push("/transacoes" as never)}
              />
            ))}
          </Surface>
        )}
      </Animated.ScrollView>

      {/* The top row: back, the page's name, the month in the corner. */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <RaisedButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))} size={50}>
          <ChevronLeft size={24} color={th("#fff")} strokeWidth={2.4} />
        </RaisedButton>
        <Text numberOfLines={1} style={{ flex: 1, marginHorizontal: 8, textAlign: "center", fontSize: 19, fontWeight: "700", letterSpacing: -0.3, color: th("#fff") }}>
          Fluxo de caixa
        </Text>
        <MonthPill compact month={month} year={year} onChange={(m, y) => setShown({ month: m, year: y })} />
      </View>
    </Room>
  );
}

/**
 * The month as soft lines adding up day by day — green for what came in, red for what went out
 * (one or both, by the view) — solid for what has happened, dashed for what is still to come. A
 * finger slid across reads the day under it.
 */
function FlowChart({
  width,
  series,
  view,
  hidden,
}: {
  width: number;
  series: { inn: number[]; out: number[]; split: number; labels: { at: number; text: string }[]; name: (i: number) => string };
  view: View3;
  hidden?: boolean;
}) {
  const n = series.inn.length;
  const showIn = view !== "saidas";
  const showOut = view !== "entradas";
  const max = Math.max(1, ...(showIn ? series.inn : [0]), ...(showOut ? series.out : [0])) * 1.1;
  const bottom = CHART_H - FLOOR;
  const x = (i: number) => PAD_X + (i / Math.max(1, n - 1)) * (width - PAD_X * 2);
  const y = (v: number) => bottom - (v / max) * (bottom - TOP);
  const pin = series.inn.map((v, i) => ({ x: x(i), y: y(v) }));
  const pout = series.out.map((v, i) => ({ x: x(i), y: y(v) }));
  const split = Math.max(0, Math.min(n - 1, series.split));
  const green = th(IN);
  const red = th(OUT);

  const [pick, setPick] = useState<number | null>(null);
  const cx = useSharedValue(0);
  const shown = useSharedValue(0);
  const lastIdx = useSharedValue(-1);
  const xs = pin.map((p) => p.x);
  const choose = useCallback((i: number) => {
    setPick(i);
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);
  const release = useCallback(() => setPick(null), []);
  const pan = useMemo(() => {
    const go = (px: number) => {
      "worklet";
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - PAD_X) / (width - PAD_X * 2)) * (n - 1))));
      if (i === lastIdx.get()) return;
      lastIdx.set(i);
      cx.set(withTiming(xs[i], { duration: 90 }));
      runOnJS(choose)(i);
    };
    return Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onStart((e) => {
        lastIdx.set(-1);
        shown.set(withTiming(1, { duration: 140 }));
        go(e.x);
      })
      .onUpdate((e) => go(e.x))
      .onFinalize(() => {
        shown.set(withTiming(0, { duration: 260 }));
        runOnJS(release)();
      });
  }, [width, n, xs, cx, shown, lastIdx, choose, release]);
  const band = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateX: cx.get() - 18 }] }));

  const area = (pts: { x: number; y: number }[]) => `${curve(pts)} L ${pts[pts.length - 1].x.toFixed(1)} ${bottom} L ${pts[0].x.toFixed(1)} ${bottom} Z`;
  const solid = (pts: { x: number; y: number }[]) => (split > 0 ? curve(pts, 0, split) : "");
  const ahead = (pts: { x: number; y: number }[]) => (split < n - 1 ? curve(pts, split, n - 1) : "");
  const tip = pick !== null ? { x: Math.max(70, Math.min(width - 70, xs[pick])), name: series.name(pick), inn: series.inn[pick], out: series.out[pick] } : null;

  return (
    <GestureDetector gesture={pan}>
      <View style={{ height: CHART_H }}>
        {/* The lit band under the finger. */}
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: TOP - 14, bottom: FLOOR, width: 36, borderRadius: 12, overflow: "hidden" }, band]}>
          <LinearGradient colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.03)"]} style={{ flex: 1 }} />
        </Animated.View>
        <Svg width={width} height={CHART_H}>
          <Defs>
            <SvgGradient id="flow-in" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={green} stopOpacity={0.2} />
              <Stop offset="1" stopColor={green} stopOpacity={0} />
            </SvgGradient>
            <SvgGradient id="flow-out" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={red} stopOpacity={0.14} />
              <Stop offset="1" stopColor={red} stopOpacity={0} />
            </SvgGradient>
          </Defs>
          {showOut && <Path d={area(pout)} fill="url(#flow-out)" />}
          {showIn && <Path d={area(pin)} fill="url(#flow-in)" />}
          {showOut && solid(pout) ? <Path d={solid(pout)} stroke={red} strokeWidth={2.6} fill="none" strokeLinecap="round" /> : null}
          {showOut && ahead(pout) ? <Path d={ahead(pout)} stroke={red} strokeOpacity={0.7} strokeWidth={2.2} strokeDasharray="5 6" fill="none" strokeLinecap="round" /> : null}
          {showIn && solid(pin) ? <Path d={solid(pin)} stroke={green} strokeWidth={2.8} fill="none" strokeLinecap="round" /> : null}
          {showIn && ahead(pin) ? <Path d={ahead(pin)} stroke={green} strokeOpacity={0.75} strokeWidth={2.2} strokeDasharray="5 6" fill="none" strokeLinecap="round" /> : null}
        </Svg>
        {/* The points under the finger. */}
        {pick !== null && showIn && <View pointerEvents="none" style={{ position: "absolute", left: xs[pick] - 7, top: pin[pick].y - 7, width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: green, backgroundColor: th("#fff", "bg") }} />}
        {pick !== null && showOut && <View pointerEvents="none" style={{ position: "absolute", left: xs[pick] - 7, top: pout[pick].y - 7, width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: red, backgroundColor: th("#fff", "bg") }} />}
        {/* The pill reading the day. */}
        {tip && (
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: tip.x - 70, width: 140, alignItems: "center" }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: th("rgba(30,32,36,0.92)", "bg"), borderWidth: 1, borderColor: th("rgba(255,255,255,0.14)", "line") }}>
              <Text numberOfLines={1} style={{ textAlign: "center", fontSize: 11, fontWeight: "600", color: th(INK.soft) }}>
                {tip.name}
              </Text>
              <Text numberOfLines={1} style={[nums, { textAlign: "center", fontSize: 12.5, fontWeight: "700", color: th("#fff") }]}>
                {showIn && <Text style={{ color: green }}>● </Text>}
                {showIn && (hidden ? "•••" : money(tip.inn))}
                {showIn && showOut && "  "}
                {showOut && <Text style={{ color: red }}>● </Text>}
                {showOut && (hidden ? "•••" : money(tip.out))}
              </Text>
            </View>
          </View>
        )}
        {/* The axis. */}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 4, height: 18 }}>
          {series.labels.map((l) => (
            <Text key={`${l.at}-${l.text}`} style={[nums, { position: "absolute", left: x(l.at) - 20, width: 40, textAlign: "center", fontSize: 12.5, color: th(INK.soft) }]}>
              {l.text}
            </Text>
          ))}
        </View>
      </View>
    </GestureDetector>
  );
}
