import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Animated, { Easing, FadeIn, ReduceMotion, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import type { CategoryExpense, FinanceEvent } from "@/types/finance";
import { categoryHex } from "@/lib/categoryData";
import Surface from "~/components/Surface";
import SpendRing from "~/components/analytics/SpendRing";
import { ChevronRight } from "~/components/icons";
import { dateOf, daysFrom, dueLabel, isIncome, isOverdue, monthShort, upcoming } from "~/lib/events";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th } from "~/theme/theme";

/**
 * The small versions of the home cards: half a row each.
 *
 * Where the whole card is a list or a bar, the small one is a single dial — the month's
 * money in and out as one ring, the spending by category as another — with the figure
 * that matters in the middle of it. Próximos eventos keeps only the next one.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const HEIGHT = 208;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** One coloured stretch of a ring, drawn round from the top when the card arrives. */
function Arc({ size, stroke, start, share, color, delay }: { size: number; stroke: number; start: number; share: number; color: string; delay: number }) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  /* A hair's gap between neighbours, unless it is the whole ring. */
  const gap = share >= 0.999 ? 0 : Math.min(stroke * 0.9, length * share * 0.4);
  const drawn = useSharedValue(0);
  useEffect(() => {
    drawn.set(withDelay(delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [drawn, delay, share]);
  const props = useAnimatedProps(() => {
    const visible = Math.max(0, length * share - gap) * drawn.get();
    return { strokeDasharray: [visible, length] };
  });
  return (
    <AnimatedCircle
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap={share >= 0.999 ? "butt" : "round"}
      animatedProps={props}
      transform={`rotate(${-90 + start * 360 + (gap / length) * 180} ${size / 2} ${size / 2})`}
    />
  );
}

function Ring({ size, stroke, parts, children }: { size: number; stroke: number; parts: { share: number; color: string }[]; children: ReactNode }) {
  const track = th("rgba(255,255,255,0.07)", "bg");
  let at = 0;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={(size - stroke) / 2} fill="none" stroke={track} strokeWidth={stroke} />
        {parts.map((p, i) => {
          const start = at;
          at += p.share;
          return <Arc key={i} size={size} stroke={stroke} start={start} share={p.share} color={p.color} delay={80 * i} />;
        })}
      </Svg>
      {children}
    </View>
  );
}

function Head({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Text numberOfLines={1} style={[T.cardLabel, { flex: 1, fontSize: 13 }]}>{label}</Text>
      <ChevronRight size={14} color={th(INK.faint)} />
    </View>
  );
}

/**
 * Receitas e despesas, small, in the same hand as Gastos do mês: the name in small spaced
 * capitals, how much of what came in has already gone out large (in red past all of it — what
 * is left is the balance card's to say), then what came in and what
 * went out, each with its figure and a rule of thin bars on one scale — green for in, red for
 * out, the rest of the rule in grey. A touch opens Fluxo de caixa.
 */
export function FluxoCompact({ receitas, despesas, hidden }: { receitas: number; despesas: number; hidden?: boolean }) {
  const router = useRouter();
  const [w, setW] = useState(0);
  const scale = Math.max(receitas, despesas, 1);
  const show = (v: number) => (hidden ? "R$ •••" : money(v));
  const count = w > 0 ? Math.max(12, Math.floor((w + TICK_GAP) / (TICK_W + TICK_GAP))) : 0;
  /* How much of what came in has already gone out — not what is left, which the balance card
     above already says. Past all of it, in red. */
  const used = receitas > 0 ? Math.round((despesas / receitas) * 100) : null;

  return (
    <Surface onPress={() => router.push("/fluxo-de-caixa" as never)} style={{ height: HEIGHT, paddingHorizontal: 14, paddingTop: 15, paddingBottom: 14 }}>
      <Text numberOfLines={1} style={[T.eyebrow, { color: th(INK.soft) }]}>
        Fluxo do mês
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[T.figure, { marginTop: 6, fontSize: 24, letterSpacing: -0.8, color: th(used !== null && used > 100 ? RED : "#fff") }]}>
        {used === null ? "—" : `${used}%`}
      </Text>
      <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: th(INK.soft) }}>
        {used === null ? "nada entrou ainda" : "do que entrou já saiu"}
      </Text>

      {/* What came in and what went out, each on its own rule, one scale for both. */}
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginTop: "auto", gap: 12 }}>
        <FlowRule label="Entrou" value={show(receitas)} share={receitas / scale} color={GREEN} count={count} delay={80} />
        <FlowRule label="Saiu" value={hidden ? "R$ •••" : `−${money(despesas)}`} share={despesas / scale} color={RED} count={count} delay={160} />
      </View>
    </Surface>
  );
}

/* The compact cards' rules: thin bars, evenly spaced across the card. */
const TICK_W = 3;
const TICK_GAP = 3.5;

/** One side of the month: its name and figure, and a rule of thin bars filled to its share. */
function FlowRule({ label, value, share, color, count, delay }: { label: string; value: string; share: number; color: string; count: number; delay: number }) {
  const filled = Math.round(Math.max(0, Math.min(1, share)) * count);
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 3, height: 11, borderRadius: 1.5, backgroundColor: th(color, "bg") }} />
        <Text style={{ fontSize: 12.5, fontWeight: "500", color: th(INK.soft) }}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[nums, { flex: 1, textAlign: "right", fontSize: 12.5, fontWeight: "700", color: th(color === RED ? RED : "#fff") }]}>
          {value}
        </Text>
      </View>
      <View style={{ marginTop: 7, height: 12, flexDirection: "row", justifyContent: "space-between" }}>
        {Array.from({ length: count }, (_, i) => (
          <Animated.View
            key={i}
            entering={FadeIn.delay(delay + i * 14).duration(220)}
            style={{ width: TICK_W, height: "100%", borderRadius: TICK_W / 2, backgroundColor: th(i < filled ? color : "rgba(255,255,255,0.14)", "bg") }}
          />
        ))}
      </View>
    </View>
  );
}

/** Gastos por categoria, small: the ring of the month's spending, the total in the middle. */
export function CategoriasCompact({ categories }: { categories: CategoryExpense[] }) {
  const router = useRouter();
  const sorted = useMemo(() => [...categories].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount), [categories]);
  const total = sorted.reduce((s, c) => s + c.amount, 0);

  return (
    <Surface onPress={() => router.push("/analytics/categorias" as never)} style={{ height: HEIGHT, paddingHorizontal: 14, paddingVertical: 12 }}>
      <Head label="Categorias" />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {/* The categories page's own ring, smaller: the same arcs, colours and gaps. */}
        <SpendRing
          size={146}
          stroke={14}
          labelSize={19}
          total={total}
          segments={sorted.map((c) => ({ key: c.name, hex: categoryHex(c.name), amount: c.amount }))}
        />
      </View>
    </Surface>
  );
}

/** Próximos eventos, small: only the next one, and how many more there are. */
export function EventosCompact({ events }: { events: FinanceEvent[] }) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const next = useMemo(() => upcoming(events, today), [events, today]);
  if (next.length === 0) {
    return (
      <Surface onPress={() => router.push("/eventos" as never)} style={{ height: HEIGHT, padding: 14 }}>
        <Head label="Próximo evento" />
        <Text style={{ marginTop: 10, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>Nada vencendo nos próximos dias.</Text>
      </Surface>
    );
  }
  const e = next[0];
  const late = isOverdue(e, today);
  const income = isIncome(e);
  const d = dateOf(e);
  const isToday = daysFrom(e, today) === 0;
  return (
    <Surface onPress={() => router.push("/eventos" as never)} style={{ height: HEIGHT, padding: 14 }}>
      <Head label="Próximo evento" />
      <View style={{ flex: 1, justifyContent: "center" }}>
        <View
          style={{
            width: 54,
            height: 58,
            borderRadius: 15,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: th(isToday ? "#FFFFFF" : late ? "rgba(248,113,113,0.14)" : "rgba(255,255,255,0.07)", "bg"),
          }}
        >
          <Text style={[nums, { fontSize: 22, fontWeight: "800", lineHeight: 24, color: th(isToday ? "#0B0B0B" : late ? RED : "#fff") }]}>{d.getDate()}</Text>
          <Text style={{ fontSize: 11, fontWeight: "600", color: th(isToday ? "rgba(11,11,11,0.6)" : INK.softer) }}>{monthShort(d)}</Text>
        </View>
        <Text numberOfLines={1} style={{ marginTop: 12, fontSize: 15, fontWeight: "700", color: th("#fff") }}>{e.name}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: th(late ? RED : INK.soft) }}>{dueLabel(e, today)}</Text>
        <Text numberOfLines={1} style={[nums, { marginTop: 6, fontSize: 16, fontWeight: "800", letterSpacing: -0.3, color: th(income ? GREEN : "#fff") }]}>
          {income ? "+" : ""}
          {money(e.amount)}
        </Text>
      </View>
      {next.length > 1 && (
        <Text numberOfLines={1} style={{ fontSize: 12, color: th(INK.softer) }}>
          e mais {next.length - 1} {next.length - 1 === 1 ? "pendente" : "pendentes"}
        </Text>
      )}
    </Surface>
  );
}
