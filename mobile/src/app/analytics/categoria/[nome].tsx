import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Platform, Pressable, ScrollView, Share, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { supabase } from "~/supabase/client";
import { getAccounts, getCreditCards } from "@/services/transactionService";
import type { AnalyticsTransaction } from "@/services/categoryAnalytics";
import { categoryHex } from "@/lib/categoryData";
import Room from "~/components/Room";
import RaisedButton from "~/components/RaisedButton";
import Surface from "~/components/Surface";
import GlassListSheet from "~/components/GlassListSheet";
import RecentEntries, { EntryRow } from "~/components/transactions/RecentEntries";
import { bankOf, banksById, type EntryBank } from "~/components/transactions/WithBank";
import BottomSheet from "~/components/BottomSheet";
import AnchoredMenu, { MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import LimitSheet from "~/components/categorias/LimitSheet";
import TransactionSheet from "~/components/transactions/TransactionSheet";
import CountUp from "~/components/CountUp";
import { Bars, Legend, LineChart, PeriodTabs, monthLabels } from "~/components/charts/PageCharts";
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, MoreHorizontal, Pencil, Share2, Wallet } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { useCategoryAnalytics } from "~/lib/warmStart";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * One category, up close.
 *
 * The page takes the category's colour at the top. Under the back and the menu: what it
 * took, large, with its mark beside it, and how that compares with the same days of last
 * month. Then its line across the whole width — the month adding up day by day, last
 * month's faintly behind it and the limit dashed over both — or, chosen under it, the last
 * seven days or the last three or six months as bars. Then two cards to slide through: the
 * limit (or the offer to set one) and what the Willo sees in it. Then every charge, by day;
 * a tap opens it.
 */

type Period = "mes" | "1s" | "3m" | "6m";
const PERIODS: { key: Period; label: string }[] = [
  { key: "mes", label: "Mês" },
  { key: "1s", label: "1s" },
  { key: "3m", label: "3m" },
  { key: "6m", label: "6m" },
];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
/* The month before, behind the line: a quiet grey, dashed. */
const BEFORE = "rgba(255,255,255,0.38)";
const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const CHART_H = 210;
/** A colour at some strength, for the wash at the top; a colour not in #rrggbb is used as it is. */
/** The colour carried part of the way to white, for the paler of the page's two lights. */
const lighten = (hex: string, t: number) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `#${ch.map((c) => Math.round(c + (255 - c) * t).toString(16).padStart(2, "0")).join("")}`;
};
const alpha = (hex: string, a: number) => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}` : a > 0.2 ? hex : "transparent");
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function CategoriaDetalhe() {
  useThemeRedraw();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { nome } = useLocalSearchParams<{ nome: string }>();
  const hidden = useHiddenValues();
  const category = decodeURIComponent(String(nome ?? ""));

  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [period, setPeriod] = useState<Period>("mes");
  const isCurrent = month === now.getMonth() && year === now.getFullYear();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dayNow = isCurrent ? now.getDate() : lastDay;

  const data = useCategoryAnalytics(user?.id, month, year);
  const customCats = data?.customCats;
  const hex = categoryHex(category, customCats);
  const Icon = categoryIcon(category, customCats);

  const mine = useCallback((t: AnalyticsTransaction) => t.type === "despesa" && t.category === category, [category]);
  const txs = useMemo(() => (data?.transactions ?? []).filter(mine).sort((a, b) => (a.date < b.date ? 1 : -1)), [data, mine]);
  const prevTxs = useMemo(() => (data?.prevTransactions ?? []).filter(mine), [data, mine]);
  const total = txs.reduce((s, t) => s + Number(t.amount), 0);
  const history = useMemo(() => {
    const entry = Object.entries(data?.historical ?? {}).find(([k]) => k === category)?.[1] ?? [];
    return entry;
  }, [data, category]);

  /* ── The limit ── */
  const [limit, setLimit] = useState<number | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const loadLimit = useCallback(async () => {
    if (!user || !category) return;
    const { data: row } = await supabase.from("category_limits").select("limit_amount").eq("user_id", user.id).eq("category", category).maybeSingle();
    setLimit(row ? Number((row as { limit_amount: number }).limit_amount) : null);
  }, [user, category]);
  useEffect(() => {
    void loadLimit();
  }, [loadLimit]);

  /* ── Where each charge was paid from, by name ── */
  const [names, setNames] = useState<{ accounts: Record<string, string>; cards: Record<string, { name: string; due: number; color: string | null }> }>({ accounts: {}, cards: {} });
  const [banks, setBanks] = useState<Record<string, EntryBank>>({});
  /* Read through the app's own lists, after the session is there: asked on the first frame
     of a page opened straight from a link, the tables answered for no one. */
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void Promise.all([getAccounts(true).catch(() => []), getCreditCards().catch(() => [])]).then(([a, c]) => {
      if (!alive) return;
      setBanks(banksById(a as unknown as { id: string; name: string; color: string | null }[], c as unknown as { id: string; name: string; color: string | null }[]));
      setNames({
        accounts: Object.fromEntries((a as unknown as { id: string; name: string }[]).map((r) => [r.id, r.name])),
        cards: Object.fromEntries((c as unknown as { id: string; name: string; due_day: number; color: string | null }[]).map((r) => [r.id, { name: r.name, due: r.due_day, color: r.color }])),
      });
    });
    return () => {
      alive = false;
    };
  }, [user]);
  const onCard = (t: AnalyticsTransaction) => t.payment_method === "cartao" && !!t.credit_card_id;
  const paidWith = (t: AnalyticsTransaction) => {
    if (onCard(t)) return `Cartão ${names.cards[t.credit_card_id!]?.name ?? ""}`.trim();
    const acc = (t as AnalyticsTransaction & { account_id?: string | null }).account_id;
    return (acc && names.accounts[acc]) || "Conta";
  };
  const [opened, setOpened] = useState<AnalyticsTransaction | null>(null);
  /* Every charge of the month, when the short list is not enough. */
  const [allOpen, setAllOpen] = useState(false);

  /* ── The figures the header and the cards read ── */
  const dayOf = (t: AnalyticsTransaction) => {
    const [y, m, d] = t.date.split("-").map(Number);
    /* A card purchase of last month counted in this one: it sits on the first day. */
    return y === year && m === month + 1 ? d : 1;
  };
  /* How last month closed in this category: what this month is set against. */
  const prevClosed = prevTxs.reduce((s, t) => s + Number(t.amount), 0);
  const prevMonthIdx = month === 0 ? 11 : month - 1;
  const pastMonths = history.filter((h) => !(h.month === month && h.year === year) && h.amount > 0);
  const average = pastMonths.length ? pastMonths.reduce((s, h) => s + h.amount, 0) / pastMonths.length : 0;

  const header = useMemo(() => {
    if (period === "1s") {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      const all = [...(data?.transactions ?? []), ...(data?.prevTransactions ?? [])].filter(mine);
      const sum = all.filter((t) => t.date >= iso(from) && t.date <= iso(now)).reduce((s, t) => s + Number(t.amount), 0);
      return { label: "Gasto nos últimos 7 dias", value: sum };
    }
    if (period === "3m" || period === "6m") {
      const n = period === "3m" ? 3 : 6;
      const sum = history.slice(-n).reduce((s, h) => s + h.amount, 0);
      return { label: `Gasto nos últimos ${n} meses`, value: sum };
    }
    return { label: `Gasto em ${MONTHS[month]}`, value: total };
  }, [period, data, mine, now, history, month, total]);

  const compare = (() => {
    if (period !== "mes") {
      const n = period === "1s" ? 0 : period === "3m" ? 3 : 6;
      /* Over the months the account has been open, not six blank ones before it. */
      const shown = Math.max(1, history.slice(-n).length);
      return n ? `Média de ${money(header.value / shown)} por mês` : "Dia a dia, de uma semana atrás até hoje";
    }
    if (prevClosed <= 0) return "Sem gastos nessa categoria no mês anterior";
    return ` vs ${money(prevClosed)} mês anterior`;
  })();
  const up = total > prevClosed;
  const changed = period === "mes" && prevClosed > 0 ? `${Math.abs(((total - prevClosed) / prevClosed) * 100).toFixed(1).replace(".", ",")}%` : null;

  /* ── The menu and the month picker ── */
  const moreRef = useRef<ComponentRef<typeof View>>(null);
  const [menu, setMenu] = useState<AnchorRect | null>(null);
  const [picking, setPicking] = useState(false);
  const openMenu = () =>
    moreRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => setMenu({ left: x + w - 258, top: y, bottom: y + h, width: 258 }));
  const exportList = () => {
    setMenu(null);
    const lines = [`${category} · ${MONTHS[month]} de ${year}`, ...txs.map((t) => `${t.date.split("-").reverse().join("/")};${t.name};${Number(t.amount).toFixed(2).replace(".", ",")};${paidWith(t)}`), `Total;${total.toFixed(2).replace(".", ",")}`];
    void Share.share({ message: lines.join("\n"), title: `${category} — ${MONTHS[month]}` }).catch(() => undefined);
  };

  return (
    /* The plain room, not the background chosen for the app: only the category's own colour is
       on this page, so nothing of another hue (a violet light, say) shows through it. */
    <Room sky={false}>
      {/* The category's colour washing down from the top into the dark, and two broad lights of
          it — a paler one high on the left, the colour itself on the right — for the soft, uneven
          glow of a blurred light and for the glass of the buttons to bend. */}
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(hex, 0.5), alpha(hex, 0.3), alpha(hex, 0.13), alpha(hex, 0.04), alpha(hex, 0)]}
        locations={[0, 0.18, 0.36, 0.52, 0.66]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: "78%" }}
      />
      <Svg pointerEvents="none" width="100%" height="60%" style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <Defs>
          <RadialGradient id={`catGlowA-${hex}`} cx="0.18" cy="-0.04" rx="0.85" ry="0.5">
            <Stop offset="0" stopColor={lighten(hex, 0.45)} stopOpacity={0.32} />
            <Stop offset="1" stopColor={lighten(hex, 0.45)} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`catGlowB-${hex}`} cx="0.95" cy="0.2" rx="0.6" ry="0.42">
            <Stop offset="0" stopColor={hex} stopOpacity={0.34} />
            <Stop offset="1" stopColor={hex} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#catGlowA-${hex})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#catGlowB-${hex})`} />
      </Svg>

      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 74, paddingBottom: insets.bottom + 60, paddingHorizontal: 16 }}>
        {/* What it took; the figure travels to the new one when the period changes. */}
        <View style={{ paddingHorizontal: 4 }}>
          <View>
            <Animated.Text key={header.label} entering={FadeIn.duration(260)} style={{ fontSize: 17, color: th(INK.soft) }}>
              {header.label}
            </Animated.Text>
            <CountUp value={header.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 4, fontSize: 44, fontWeight: "700", letterSpacing: -1.6, color: th("#fff") }]} />
            <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
              {changed && (up ? <ArrowUp size={15} color={th(RED)} strokeWidth={2.4} /> : <ArrowDown size={15} color={th(GREEN)} strokeWidth={2.4} />)}
              <Text numberOfLines={2} style={[nums, { flexShrink: 1, fontSize: 14.5, color: th(INK.soft) }]}>
                {changed ? <Text style={{ fontWeight: "700", color: th(up ? RED : GREEN) }}>{changed}</Text> : null}
                {compare}
              </Text>
            </View>
          </View>
        </View>

        {/* The chart, across the whole width. */}
        <Animated.View key={`${period}-${year}-${month}`} entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))} style={{ marginTop: 24, marginHorizontal: -16 }}>
          {period === "mes" ? (
            <MonthChart width={width} hex={hex} txs={txs} prevTxs={prevTxs} dayOf={dayOf} lastDay={lastDay} dayNow={dayNow} limit={limit} month={month} hidden={hidden} />
          ) : period === "1s" ? (
            <WeekChart width={width} hex={hex} all={[...(data?.transactions ?? []), ...(data?.prevTransactions ?? [])].filter(mine)} now={now} hidden={hidden} />
          ) : (
            <MonthsChart width={width} hex={hex} months={history.slice(period === "3m" ? -3 : -6)} current={{ month, year }} hidden={hidden} />
          )}
        </Animated.View>

        {/* Legend. */}
        {period === "mes" && (
          <View style={{ marginTop: 10, flexDirection: "row", gap: 18, paddingHorizontal: 4 }}>
            <Legend color={hex} label={MONTHS[month][0].toUpperCase() + MONTHS[month].slice(1)} />
            {prevTxs.length > 0 && <Legend color={th(BEFORE, "line")} dashed label={MONTHS[prevMonthIdx][0].toUpperCase() + MONTHS[prevMonthIdx].slice(1)} />}
            {limit !== null && <Legend color={th("rgba(255,255,255,0.7)")} dashed label="Orçamento" />}
          </View>
        )}

        {/* Which stretch of time, and which month. */}
        <View style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <PeriodTabs value={period} options={PERIODS} onChange={setPeriod} />
          <RaisedButton label="Escolher o mês" onPress={() => setPicking(true)} size={50}>
            <CalendarDays size={21} color={th("#fff")} strokeWidth={2} />
          </RaisedButton>
        </View>

        {/* The limit, and what the Willo sees: two cards to slide through. */}
        <ScrollView horizontal pagingEnabled={false} snapToInterval={width - 32 + 12} decelerationRate="fast" showsHorizontalScrollIndicator={false} style={{ marginTop: 18, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          <BudgetCard width={width - 32} hex={hex} spent={total} limit={limit} average={average} isCurrent={isCurrent} dayNow={dayNow} lastDay={lastDay} monthName={MONTHS[month]} onSet={() => setLimitOpen(true)} />
          <InsightsCard width={width - 32} txs={txs} total={total} average={average} category={category} />
        </ScrollView>

        {/* The latest charges, as every list of entries is drawn, and the way to all of them. */}
        <View style={{ marginTop: 28 }}>
          <RecentEntries
            items={txs.slice(0, 5)}
            customCats={customCats}
            banks={banks}
            onOpen={(entry) => setOpened(entry as AnalyticsTransaction)}
            onSeeAll={() => setAllOpen(true)}
            empty={`Nenhum gasto em ${category} em ${MONTHS[month]}`}
          />
        </View>
      </Animated.ScrollView>

      {/* The top row: back, the name once scrolled, and the menu. */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <RaisedButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))} size={50}>
          <ChevronLeft size={24} color={th("#fff")} strokeWidth={2.4} />
        </RaisedButton>
        <Text numberOfLines={1} style={{ flex: 1, marginHorizontal: 10, textAlign: "center", fontSize: 19, fontWeight: "700", letterSpacing: -0.3, color: th("#fff") }}>
          {category}
        </Text>
        <View ref={moreRef} collapsable={false}>
          <RaisedButton label="Mais opções" onPress={openMenu} size={50}>
            <MoreHorizontal size={22} color={th("#fff")} strokeWidth={2.4} />
          </RaisedButton>
        </View>
      </View>

      <AnchoredMenu open={!!menu} anchor={menu} onClose={() => setMenu(null)}>
        <MenuRow
          icon={Wallet}
          label={limit !== null ? "Editar limite de orçamento" : "Definir limite de orçamento"}
          onPress={() => {
            setMenu(null);
            setLimitOpen(true);
          }}
        />
        <MenuRow
          icon={Pencil}
          label="Editar categoria"
          onPress={() => {
            setMenu(null);
            router.push("/categorias" as never);
          }}
        />
        <MenuRow icon={Share2} label="Exportar" onPress={exportList} last />
      </AnchoredMenu>

      <LimitSheet
        open={limitOpen}
        category={category}
        categories={[category]}
        current={limit}
        onClose={() => setLimitOpen(false)}
        onSaved={() => {
          setLimitOpen(false);
          void loadLimit();
        }}
      />

      <BottomSheet open={picking} onClose={() => setPicking(false)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: th("#fff") }}>Qual mês?</Text>
          <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              const on = d.getMonth() === month && d.getFullYear() === year;
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    setMonth(d.getMonth());
                    setYear(d.getFullYear());
                    setPeriod("mes");
                    setPicking(false);
                  }}
                  style={({ pressed }) => ({ width: "31.5%", height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: th(on ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.10)", "line"), backgroundColor: th(on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)", "bg"), opacity: pressed ? 0.7 : 1 })}
                >
                  <Text style={{ fontSize: 15, fontWeight: on ? "700" : "500", color: th("#fff") }}>
                    {SHORT[d.getMonth()]}
                    {d.getFullYear() !== now.getFullYear() ? ` ${String(d.getFullYear()).slice(2)}` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </BottomSheet>

      <GlassListSheet open={allOpen} onClose={() => setAllOpen(false)} title={category} subtitle={`${MONTHS[month]} · ${txs.length} ${txs.length === 1 ? "gasto" : "gastos"}`}>
        {txs.map((t) => (
          <EntryRow
            key={t.id}
            entry={t}
            customCats={customCats}
            bank={bankOf(t, banks)}
            onPress={() => {
              setAllOpen(false);
              setOpened(t);
            }}
          />
        ))}
      </GlassListSheet>

      <TransactionSheet
        tx={opened as never}
        accountName={opened ? (onCard(opened) ? names.cards[opened.credit_card_id!]?.name ?? "Cartão" : paidWith(opened)) : ""}
        customCategories={customCats as never}
        userId={user?.id}
        month={month}
        year={year}
        onClose={() => setOpened(null)}
        onEdit={(t) => {
          setOpened(null);
          router.push({ pathname: "/manual", params: { editar: t.id, mes: String(month), ano: String(year) } } as never);
        }}
        onChanged={() => window.dispatchEvent(new CustomEvent("finance-data-changed"))}
      />
    </Room>
  );
}

/* ───────── The month, day by day ───────── */

function MonthChart({
  width,
  hex,
  txs,
  prevTxs,
  dayOf,
  lastDay,
  dayNow,
  limit,
  month,
  hidden,
}: {
  width: number;
  hex: string;
  txs: AnalyticsTransaction[];
  prevTxs: AnalyticsTransaction[];
  dayOf: (t: AnalyticsTransaction) => number;
  lastDay: number;
  dayNow: number;
  limit: number | null;
  month: number;
  hidden?: boolean;
}) {
  const run = (list: AnalyticsTransaction[], day: (t: AnalyticsTransaction) => number, upTo: number) => {
    const per = new Array<number>(lastDay + 1).fill(0);
    for (const t of list) {
      const d = Math.min(lastDay, Math.max(1, day(t)));
      per[d] += Number(t.amount);
    }
    const out: number[] = [0];
    for (let d = 1; d <= upTo; d++) out.push(out[d - 1] + per[d]);
    return out;
  };
  const cur = run(txs, dayOf, dayNow);
  const prev = prevTxs.length ? run(prevTxs, (t) => Number(t.date.split("-")[2]), lastDay) : null;
  const prevName = MONTHS[(month + 11) % 12];
  return (
    <LineChart
      width={width}
      span={lastDay}
      labels={monthLabels(lastDay)}
      dayName={(i) => (i === 0 ? `Início de ${SHORT[month]}` : `${i} de ${SHORT[month]}`)}
      hidden={hidden}
      limit={limit}
      tipValue={(i) => (i >= 1 && i < cur.length ? cur[i] : null)}
      series={[
        ...(prev ? [{ values: prev, color: th(BEFORE, "line"), name: prevName[0].toUpperCase() + prevName.slice(1), dashed: true }] : []),
        { values: cur, color: hex, name: MONTHS[month][0].toUpperCase() + MONTHS[month].slice(1), fill: true, dot: true },
      ]}
    />
  );
}

/* ───────── The last seven days ───────── */

function WeekChart({ width, hex, all, now, hidden }: { width: number; hex: string; all: AnalyticsTransaction[]; now: Date; hidden?: boolean }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const key = iso(d);
    return { d, value: all.filter((t) => t.date === key).reduce((s, t) => s + Number(t.amount), 0) };
  });
  return <Bars width={width} hex={hex} hidden={hidden} bars={days.map((x, i) => ({ label: WEEK[x.d.getDay()], title: `${i === 6 ? "Hoje" : WEEKDAY[x.d.getDay()]}, ${x.d.getDate()} de ${SHORT[x.d.getMonth()]}`, value: x.value, on: i === 6 }))} />;
}

/* ───────── Months ───────── */

function MonthsChart({ width, hex, months, current, hidden }: { width: number; hex: string; months: { month: number; year: number; amount: number }[]; current: { month: number; year: number }; hidden?: boolean }) {
  return <Bars width={width} hex={hex} hidden={hidden} bars={months.map((m) => ({ label: SHORT[m.month], title: `${MONTHS[m.month][0].toUpperCase() + MONTHS[m.month].slice(1)} de ${m.year}`, value: m.amount, on: m.month === current.month && m.year === current.year }))} />;
}

/* ───────── The two cards ───────── */

function BudgetCard({
  width,
  hex,
  spent,
  limit,
  average,
  isCurrent,
  dayNow,
  lastDay,
  monthName,
  onSet,
}: {
  width: number;
  hex: string;
  spent: number;
  limit: number | null;
  average: number;
  isCurrent: boolean;
  dayNow: number;
  lastDay: number;
  monthName: string;
  onSet: () => void;
}) {
  if (limit === null) {
    const suggestion = average > 0 ? Math.ceil(average / 10) * 10 : 0;
    return (
      <Surface radius={28} style={{ width, padding: 20 }}>
        <Text style={{ fontSize: 17, lineHeight: 23, color: th(INK.soft) }}>
          {suggestion > 0
            ? `Pelos seus últimos meses, um limite de ${money(suggestion)} por mês cabe bem aqui.`
            : "Defina quanto quer gastar aqui por mês, e o Willo avisa antes de passar."}
        </Text>
        <Pressable onPress={onSet} style={({ pressed }) => ({ marginTop: 16, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: th("rgba(255,255,255,0.14)", "line"), backgroundColor: th("rgba(255,255,255,0.08)", "bg"), opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ fontSize: 17, fontWeight: "600", color: th("#fff") }}>Definir limite de orçamento</Text>
        </Pressable>
      </Surface>
    );
  }
  const used = limit > 0 ? spent / limit : 0;
  const tone = used > 1 ? RED : used >= 0.8 ? AMBER : GREEN;
  const pace = isCurrent && dayNow > 0 ? (spent / dayNow) * lastDay : spent;
  return (
    <Surface radius={28} onPress={onSet} style={{ width, padding: 20 }}>
      <Text style={{ fontSize: 15, color: th(INK.soft) }}>Orçamento de {monthName}</Text>
      <Text style={[nums, { marginTop: 6, fontSize: 22, fontWeight: "700", color: th("#fff") }]}>
        {money(spent)} <Text style={{ fontSize: 16, fontWeight: "500", color: th(INK.soft) }}>de {money(limit)}</Text>
      </Text>
      <View style={{ marginTop: 12, height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.10)", "bg") }}>
        <View style={{ width: `${Math.min(100, used * 100)}%`, height: "100%", borderRadius: 5, backgroundColor: th(used > 1 ? RED : hex, "bg") }} />
      </View>
      <Text style={[nums, { marginTop: 10, fontSize: 14.5, color: th(tone) }]}>
        {used > 1 ? `Passou ${money(spent - limit)} do limite` : `Faltam ${money(limit - spent)} para o limite`}
      </Text>
      {isCurrent && dayNow < lastDay && spent > 0 && (
        <Text style={[nums, { marginTop: 4, fontSize: 14, color: th(INK.soft) }]}>No ritmo de agora, o mês fecha em {money(pace)}.</Text>
      )}
    </Surface>
  );
}

function InsightsCard({ width, txs, total, average, category }: { width: number; txs: AnalyticsTransaction[]; total: number; average: number; category: string }) {
  const biggest = [...txs].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const lines: string[] = [];
  if (average > 0) {
    const diff = total - average;
    const pct = Math.round((Math.abs(diff) / average) * 100);
    lines.push(`A média dos seus últimos meses aqui é ${money(average)}. ${pct === 0 ? "Este mês está na média." : `Este mês está ${pct}% ${diff > 0 ? "acima" : "abaixo"} dela.`}`);
  }
  if (biggest) lines.push(`O maior gasto foi ${biggest.name}, ${money(Number(biggest.amount))}.`);
  if (txs.length > 1) lines.push(`${txs.length} gastos, ${money(total / txs.length)} em média cada.`);
  return (
    <Surface radius={28} style={{ width, padding: 20 }}>
      <Text style={{ fontSize: 17, fontWeight: "700", color: th("#fff") }}>O que o Willo vê</Text>
      {lines.length === 0 ? (
        <Text style={{ marginTop: 12, fontSize: 16, lineHeight: 22, color: th(INK.soft) }}>Registre mais gastos em {category} para o Willo mostrar padrões aqui.</Text>
      ) : (
        lines.map((l) => (
          <Text key={l} style={[nums, { marginTop: 10, fontSize: 15.5, lineHeight: 21, color: th(INK.soft) }]}>
            {l}
          </Text>
        ))
      )}
    </Surface>
  );
}

/* ───────── The stretch of time, with a pill that slides to the one chosen ───────── */
