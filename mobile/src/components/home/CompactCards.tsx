import { useEffect, useMemo, type ReactNode } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Animated, { Easing, ReduceMotion, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import type { CategoryExpense, FinanceEvent } from "@/types/finance";
import { categoryHex } from "@/lib/categoryData";
import Surface from "~/components/Surface";
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

/** The money in compact form: "R$ 2,8 mil", so it fits inside a ring. */
function short(v: number) {
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (a >= 1_000_000) return `${sign}R$ ${(a / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 10_000) return `${sign}R$ ${(a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sign}${money(a)}`;
}

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
 * Receitas e despesas, small: what came in and what went out, each large, then the two as
 * thick bars on one scale, and the month's balance at the foot.
 */
export function FluxoCompact({ receitas, despesas }: { receitas: number; despesas: number }) {
  const router = useRouter();
  const flow = receitas - despesas;
  const scale = Math.max(receitas, despesas, 1);
  return (
    <Surface onPress={() => router.push("/fluxo-de-caixa" as never)} style={{ height: HEIGHT, padding: 14 }}>
      <View style={{ flex: 1, justifyContent: "space-between" }}>
        <Head label="Receitas e despesas" />

        <View style={{ gap: 8 }}>
          <Figure label="Entrou" value={short(receitas)} color={GREEN} />
          <Figure label="Saiu" value={short(despesas)} color={RED} />
        </View>

        <View style={{ gap: 5 }}>
          <Meter share={receitas / scale} color={GREEN} delay={0} />
          <Meter share={despesas / scale} color={RED} delay={90} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
          <Text style={{ fontSize: 12, color: th(INK.soft) }}>Fluxo</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[nums, { flexShrink: 1, fontSize: 15, fontWeight: "800", color: th(flow < 0 ? RED : "#fff") }]}>
            {short(flow)}
          </Text>
        </View>
      </View>
    </Surface>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: th(color, "bg") }} />
        <Text style={{ fontSize: 12, color: th(INK.soft) }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginTop: 1, fontSize: 20, fontWeight: "800", letterSpacing: -0.6, color: th(color === RED ? RED : "#fff") }]}>
        {color === RED ? "−" : ""}
        {value}
      </Text>
    </View>
  );
}

/** A thick bar that grows into its share when the card arrives. */
function Meter({ share, color, delay }: { share: number; color: string; delay: number }) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.set(withDelay(delay, withTiming(Math.max(0, Math.min(share, 1)), { duration: 650, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [grow, share, delay]);
  const fill = useAnimatedStyle(() => ({ width: `${grow.get() * 100}%` }));
  return (
    <View style={{ height: 9, borderRadius: 999, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
      <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: th(color, "bg") }, fill]} />
    </View>
  );
}

/** Gastos por categoria, small: the ring of the month's spending, the total in the middle. */
export function CategoriasCompact({ categories }: { categories: CategoryExpense[] }) {
  const router = useRouter();
  const sorted = useMemo(() => [...categories].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount), [categories]);
  const total = sorted.reduce((s, c) => s + c.amount, 0);
  /* The five largest each get their colour; the rest share one grey stretch. */
  const parts = useMemo(() => {
    if (total <= 0) return [];
    const top = sorted.slice(0, 5).map((c) => ({ share: c.amount / total, color: th(categoryHex(c.name), "bg") }));
    const rest = sorted.slice(5).reduce((s, c) => s + c.amount, 0);
    return rest > 0 ? [...top, { share: rest / total, color: th("rgba(255,255,255,0.28)", "bg") }] : top;
  }, [sorted, total]);
  return (
    <Surface onPress={() => router.push("/analytics/categorias" as never)} style={{ height: HEIGHT, paddingHorizontal: 14, paddingVertical: 12 }}>
      <Head label="Por categoria" />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Ring size={146} stroke={15} parts={parts}>
          <Text style={{ fontSize: 11.5, color: th(INK.softer) }}>Gastos</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { maxWidth: 104, fontSize: 19, fontWeight: "800", letterSpacing: -0.5, color: th("#fff") }]}>
            {short(total)}
          </Text>
        </Ring>
      </View>
    </Surface>
  );
}

/** Próximos eventos, small: only the next one, and how many more there are. */
export function EventosCompact({ events }: { events: FinanceEvent[] }) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const next = useMemo(() => upcoming(events, today), [events, today]);
  if (next.length === 0) return null;
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
