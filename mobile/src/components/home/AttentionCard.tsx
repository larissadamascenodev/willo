import { useMemo, type ComponentType } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import type { CategoryExpense, FinanceEvent } from "@/types/finance";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import { AlertTriangle, CalendarDays, ChartPie, ChevronRight, Sparkles } from "~/components/icons";
import { daysFrom, isIncome, isOverdue, isSettled, whenLabel } from "~/lib/events";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * Precisa da sua atenção: what needs a look now, the most pressing first.
 *
 * Bills gone past their day, purchases the Copilot caught waiting for a yes, bills due in the
 * next three days, and categories at or past four fifths of their limit. Up to three rows; the
 * rest are counted at the foot and open the notifications. With nothing to say, the card is
 * not drawn at all.
 *
 * Each row: a round mark tinted in its colour, what it is, and under it when, in that colour
 * (Venceu há 2 dias, Vence amanhã); on the right, how much. For a category, how much of its
 * limit is gone, with the bar under it.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const SHOWN = 3;

type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface Item {
  key: string;
  tone: string;
  Icon: Icon;
  title: string;
  /** Under the title, in the row's colour: where it stands. */
  status: string;
  /** On the right. */
  value?: string;
  /** A category's share of its limit (0–1+), drawn as a bar. */
  share?: number;
  route: string;
}

export default function AttentionCard({
  events,
  categories,
  copilot,
  hidden,
}: {
  events: FinanceEvent[];
  categories: CategoryExpense[];
  /** Purchases the Copilot caught, waiting for a yes. */
  copilot: number;
  hidden?: boolean;
}) {
  const router = useRouter();
  const show = (v: number) => (hidden ? "R$ •••" : money(v));

  const items = useMemo(() => {
    const now = new Date();
    const out: Item[] = [];
    const bills = events.filter((e) => !isIncome(e) && !isSettled(e));

    const late = bills.filter((e) => isOverdue(e, now));
    if (late.length > 2) {
      const sum = late.reduce((t, e) => t + e.amount, 0);
      out.push({ key: "late", tone: RED, Icon: AlertTriangle, title: `${late.length} contas atrasadas`, status: "Em atraso", value: show(sum), route: "/eventos" });
    } else {
      for (const e of late) out.push({ key: `late-${e.id}`, tone: RED, Icon: AlertTriangle, title: e.name, status: capital(whenLabel(e, now)), value: show(e.amount), route: "/eventos" });
    }

    if (copilot > 0) {
      out.push({
        key: "copilot",
        tone: GREEN,
        Icon: Sparkles,
        title: copilot === 1 ? "1 compra para confirmar" : `${copilot} compras para confirmar`,
        status: "Captadas do seu banco",
        route: "/copilot",
      });
    }

    const soon = bills
      .filter((e) => !isOverdue(e, now))
      .map((e) => ({ e, n: daysFrom(e, now) }))
      .filter(({ n }) => n >= 0 && n <= 3)
      .sort((a, b) => a.n - b.n);
    for (const { e, n } of soon) {
      out.push({
        key: `soon-${e.id}`,
        tone: AMBER,
        Icon: CalendarDays,
        title: e.name,
        status: n === 0 ? "Vence hoje" : n === 1 ? "Vence amanhã" : `Vence em ${n} dias`,
        value: show(e.amount),
        route: "/eventos",
      });
    }

    const tight = categories
      .filter((c) => (c.limit ?? 0) > 0 && c.amount / (c.limit as number) >= 0.8)
      .sort((a, b) => b.amount / (b.limit as number) - a.amount / (a.limit as number));
    for (const c of tight) {
      const share = c.amount / (c.limit as number);
      out.push({
        key: `cat-${c.name}`,
        tone: share > 1 ? RED : AMBER,
        Icon: ChartPie,
        title: c.name,
        status: hidden ? "R$ ••• de R$ •••" : `${money(c.amount)} de ${money(c.limit as number)}`,
        share,
        route: `/analytics/categoria/${encodeURIComponent(c.name)}`,
      });
    }
    return out;
    // show depends only on hidden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, categories, copilot, hidden]);

  if (items.length === 0) return null;
  const rest = items.length - SHOWN;

  return (
    <Animated.View entering={FadeInDown.duration(360)} layout={LinearTransition.duration(320)}>
      <Surface radius={26} style={{ paddingHorizontal: 16, paddingTop: 15, paddingBottom: rest > 0 ? 6 : 8 }}>
        <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 1.4, color: th(INK.softer) }}>PRECISA DA SUA ATENÇÃO</Text>
        {items.slice(0, SHOWN).map((it, i) => (
          <Pressable
            key={it.key}
            onPress={() => router.push(it.route as never)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 13,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: th("rgba(255,255,255,0.07)", "line"),
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: th(`${it.tone}66`, "line"),
                backgroundColor: th(`${it.tone}24`, "bg"),
                shadowColor: it.tone,
                shadowOpacity: 0.45,
                shadowRadius: 9,
                shadowOffset: { width: 0, height: 0 },
              }}
            >
              <it.Icon size={18} color={th(it.tone)} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>
                  {it.title}
                </Text>
                {it.share !== undefined && (
                  <Text style={[nums, { fontSize: 13, fontWeight: "700", color: th(it.tone) }]}>{Math.round(it.share * 100)}%</Text>
                )}
              </View>
              {it.share !== undefined && (
                <View style={{ marginTop: 7, height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
                  <Bar share={Math.min(1, it.share)} color={it.tone} />
                </View>
              )}
              <Text numberOfLines={1} style={[nums, { marginTop: it.share !== undefined ? 6 : 2, fontSize: 13, fontWeight: it.share !== undefined ? "400" : "600", color: th(it.share !== undefined || it.tone === GREEN ? INK.softer : it.tone) }]}>
                {it.status}
              </Text>
            </View>
            {it.value && (
              <Text numberOfLines={1} style={[nums, { fontSize: 15, fontWeight: "700", color: th("#fff") }]}>
                {it.value}
              </Text>
            )}
            <ChevronRight size={17} color={th(INK.faint)} />
          </Pressable>
        ))}
        {rest > 0 && (
          <Pressable
            onPress={() => router.push("/notificacoes" as never)}
            style={({ pressed }) => ({ paddingVertical: 11, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.07)", "line"), opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ textAlign: "center", fontSize: 13.5, fontWeight: "600", color: th(INK.soft) }}>{rest === 1 ? "Ver mais 1 aviso" : `Ver mais ${rest} avisos`}</Text>
          </Pressable>
        )}
      </Surface>
    </Animated.View>
  );
}

const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
