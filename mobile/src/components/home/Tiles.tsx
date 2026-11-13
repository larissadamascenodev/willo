import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { fetchGoals, type Goal } from "@/services/goalService";
import type { WidgetSize } from "@/lib/homeWidgets";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import { categoryHex } from "@/lib/categoryData";
import { goalProgress } from "@/lib/goalPresets";
import { installmentTotals, loadActiveInstallments } from "@/services/activeInstallments";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { daysUntil, type RecurringItem } from "@/hooks/useRecorrentes";
import SubLogo from "~/components/SubLogo";
import FixedSheet, { type FixedKind } from "~/components/home/FixedSheet";
import type { EndedSubscription } from "~/lib/subscriptionCheck";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import { Check, ChevronRight, Plus, Repeat } from "~/components/icons";
import CaixinhaCover from "~/components/accounts/CaixinhaCover";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { goalPreset } from "~/lib/goalIcon";
import { useAuth } from "~/lib/auth";
import { keepValue, keptValue } from "~/lib/warmStart";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th } from "~/theme/theme";
/**
 * Instalments, subscriptions and goals.
 *
 * Each of these used to be a tile half a row wide with one large figure in it,
 * which said how much and nothing about what of. Each is now a card that answers
 * the question its subject actually raises — when the instalments end, what is
 * about to be charged, how close the goals are — with the figure at the size of a
 * line rather than a headline, and one small drawing that carries the rest: a bar
 * for how much of the debt is behind you, the subscriptions as a row of marks, a
 * bar for each goal.
 *
 * At half a row each keeps a compact form of the same thing, so a card someone
 * shrinks is still a reading and not just a number.
 */

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const RULE = "rgba(255,255,255,0.07)";

const monthYear = (d: Date) =>
  d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "").replace(" de ", " ");

/* ────────────────────────────── Shared pieces ────────────────────────────── */

function Header({ title, aside }: { title: string; aside?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text numberOfLines={1} style={[T.cardLabel, { flex: 1 }]}>
        {title}
      </Text>
      {aside ? <Text style={{ fontSize: 12.5, color: th(INK.softer) }}>{aside}</Text> : null}
      <ChevronRight size={16} color={th(INK.faint)} />
    </View>
  );
}

/** The figure a card leads with, at the size of a line and not a headline. */
function Lead({ value, unit, compact = false }: { value: string; unit?: string; compact?: boolean }) {
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: compact ? 8 : 10 }}>
      <Text style={[nums, { fontSize: compact ? 17 : 21, fontWeight: "700", letterSpacing: -0.5, color: th("#fff") }]}>
        {value}
      </Text>
      {unit ? <Text style={{ fontSize: compact ? 12 : 13.5, color: th(INK.soft) }}> {unit}</Text> : null}
    </Text>
  );
}

function Track({ share, color = "#fff", height = 6, delay = 0.1 }: { share: number; color?: string; height?: number; delay?: number }) {
  return (
    <View style={{ height, borderRadius: 999, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
      <Bar share={share} color={color} delay={delay} />
    </View>
  );
}

/** A small ring for how far along one thing is. */
function Ring({ share, color, size = 30, stroke = 3 }: { share: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={th("rgba(255,255,255,0.10)")} strokeWidth={stroke} />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={th(color)}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={[Math.max(share, 0.04) * c, c]}
      />
    </Svg>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={{ marginTop: 10, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>{text}</Text>;
}

/** A tile that has not answered yet. A hole in the board is worse than a quiet card. */
function Skeleton({ size }: { size: WidgetSize }) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: size === "full" ? 170 : 150,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.08)", "line"),
        backgroundColor: th("rgba(255,255,255,0.046)", "bg"),
      }}
    />
  );
}

/* ─────────────────────────────── Instalments ─────────────────────────────── */

/** What is still being paid off, and when it ends. */
export function ParcelamentosTile({ size = "full" }: { size?: WidgetSize }) {
  const router = useRouter();
  const { user } = useAuth();
  /* The last list seen, drawn at once; the fresh one replaces it. */
  const [items, setItems] = useState<ActiveInstallmentItem[] | null>(() => keptValue("parcelamentos", user?.id));
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    try {
      const [active, cats] = await Promise.all([loadActiveInstallments(user.id), getCustomCategories()]);
      setItems(active.items);
      keepValue("parcelamentos", user.id, active.items);
      setCustomCats(cats);
    } catch {
      setItems([]);
    }
  }, [user]);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [load]);

  if (items === null) return <Skeleton size={size} />;
  return (
    <ParcelamentosCard
      items={items}
      customCats={customCats}
      size={size}
      onOpen={() => router.push("/parcelamentos")}
    />
  );
}

/** The instalments card itself, drawn from what it is handed. */
export function ParcelamentosCard({
  items,
  customCats,
  size,
  onOpen: open,
}: {
  items: ActiveInstallmentItem[];
  customCats: CustomCategory[];
  size: WidgetSize;
  onOpen: () => void;
}) {
  const totals = useMemo(() => installmentTotals(items), [items]);
  /* The two that weigh most on the month. */
  const heaviest = useMemo(() => [...items].sort((a, b) => b.amount - a.amount).slice(0, 2), [items]);
  const full = size === "full";

  if (!totals) {
    return (
      <Surface onPress={open} style={{ flex: 1, padding: 16 }}>
        <Header title="Parcelamentos" />
        <Empty text="Nada parcelado agora." />
      </Surface>
    );
  }

  const paid = totals.totalGeral > 0 ? totals.totalJaPago / totals.totalGeral : 0;
  const ends =
    totals.monthsUntilFree > 0
      ? `Termina em ${monthYear(totals.lastEndDate)}`
      : "Termina este mês";

  if (!full) {
    /* Compact, the whole card used, as the caixinhas and the cards are: the heaviest
       purchases' marks at the top, what the instalments cost a month large in the middle,
       and at the foot how much of it is already paid, and what is still owed. */
    const marks = [...items].sort((x, y) => y.amount - x.amount).slice(0, 3);
    return (
      <Surface onPress={open} style={{ flex: 1, padding: 14 }}>
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          <Header title="Parcelamentos" />

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {marks.map((item, i) => {
              const hex = categoryHex(item.category, customCats);
              const Icon = categoryIcon(item.category, customCats);
              return (
                <View
                  key={item.id}
                  style={{
                    marginLeft: i === 0 ? 0 : -10,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: th("#1A1B20", "bg"),
                    backgroundColor: th(chipFill(hex), "bg"),
                    zIndex: 3 - i,
                  }}
                >
                  <Icon size={16} color={th(chipInk(hex))} strokeWidth={2.1} />
                </View>
              );
            })}
            {items.length > marks.length && (
              <Text style={{ marginLeft: 8, fontSize: 12.5, fontWeight: "600", color: th(INK.soft) }}>+{items.length - marks.length}</Text>
            )}
          </View>

          <View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: th("#fff") }]}>
              {money(totals.totalMensal)}
            </Text>
            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: th(INK.soft) }}>
              por mês · {totals.monthsUntilFree > 0 ? `até ${monthYear(totals.lastEndDate)}` : "acaba este mês"}
            </Text>
          </View>

          <View>
            <Track share={paid} color={GREEN} height={6} />
            <View style={{ marginTop: 7, flexDirection: "row", justifyContent: "space-between", gap: 6 }}>
              <Text numberOfLines={1} style={[nums, { fontSize: 12, color: th(INK.soft) }]}>
                <Text style={{ fontWeight: "700", color: th("#fff") }}>{Math.round(paid * 100)}%</Text> pago
              </Text>
              <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: 12, color: th(INK.softer) }]}>falta {money(totals.totalRestante)}</Text>
            </View>
          </View>
        </View>
      </Surface>
    );
  }

  return (
    <Surface onPress={open} style={{ padding: 16 }}>
      <Header title="Parcelamentos" aside={`${items.length} ${items.length === 1 ? "compra" : "compras"}`} />
      <Lead value={money(totals.totalMensal)} unit="por mês" />
      <Text style={{ marginTop: 2, fontSize: 12.5, color: th(INK.soft) }}>{ends}</Text>

      {/* How much of the debt is already behind you. */}
      <View style={{ marginTop: 14 }}>
        <Track share={paid} />
      </View>
      <View style={{ marginTop: 7, flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ fontSize: 12, color: th(INK.soft) }}>{Math.round(paid * 100)}% já pago</Text>
        <Text style={[nums, { fontSize: 12, color: th(INK.soft) }]}>falta {money(totals.totalRestante)}</Text>
      </View>

      <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: th(RULE, "line") }}>
        {heaviest.map((item) => {
          const hex = categoryHex(item.category, customCats);
          return (
            <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12 }}>
              <Ring share={item.installment_current / item.installments} color={hex} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "500", color: th("#fff") }}>
                  {item.name}
                </Text>
                <Text style={{ marginTop: 1, fontSize: 12, color: th(INK.softer) }}>
                  parcela {item.installment_current} de {item.installments}
                </Text>
              </View>
              <Text style={[nums, { fontSize: 14.5, fontWeight: "600", color: th("#fff") }]}>{money(item.amount)}</Text>
            </View>
          );
        })}
      </View>
    </Surface>
  );
}

/* ────────────────────────────── Subscriptions ────────────────────────────── */

/* Muted marks for the services, picked by name so each keeps its colour. */
const MARKS = ["#7C8CF8", "#F59E0B", "#22D3EE", "#F472B6", "#A78BFA", "#34D399", "#FB923C", "#60A5FA"];
const markColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return MARKS[h % MARKS.length];
};
const initial = (name: string) => name.trim().charAt(0).toLocaleUpperCase("pt-BR") || "•";

/** A service, as the first letter of its name on its own colour. */
function Mark({ name, size = 30, ring = false }: { name: string; size?: number; ring?: boolean }) {
  const hex = markColor(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: th(`${hex}2E`, "bg"),
        borderWidth: ring ? 2 : 0,
        borderColor: th("#121315", "line"),
      }}
    >
      <Text style={{ fontSize: size * 0.42, fontWeight: "700", color: th(hex) }}>{initial(name)}</Text>
    </View>
  );
}

/** Everything subscribed to, as a row of marks overlapping like a stack of cards. */
function MarkRow({ items, max, size = 30 }: { items: RecurringItem[]; max: number; size?: number }) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {shown.map((s, i) => (
        <View key={s.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <SubLogo name={s.name} ring size={size} />
        </View>
      ))}
      {rest > 0 && <Text style={{ marginLeft: 8, fontSize: 12.5, color: th(INK.soft) }}>+{rest}</Text>}
    </View>
  );
}

const whenDue = (dueDay: number) => {
  const n = daysUntil(dueDay);
  return n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`;
};

/**
 * What repeats every month and carries a brand — and whatever repeats on a card.
 *
 * Always on the home, even with none: then it says what it is for and offers to add one.
 * With some, it leads with what they cost a month and a year, shows them as marks, and
 * lists what is charged next. When a subscription did not turn up in the month that
 * closed, the card leads with the question — still subscribed? — because it is the one
 * thing here someone has to answer.
 */
export function AssinaturasTile({
  size = "full",
  assinaturas,
  total,
  ended,
  onKeep,
  onCancel,
  loading = false,
}: {
  size?: WidgetSize;
  assinaturas: RecurringItem[];
  total: number;
  ended: EndedSubscription[];
  onKeep: (e: EndedSubscription) => void;
  onCancel: (e: EndedSubscription) => void;
  loading?: boolean;
}) {
  const router = useRouter();
  /* The list is its own page; adding one is the same sheet as the fixed entries'. */
  const [adding, setAdding] = useState<FixedKind | null>(null);
  return (
    <>
      <AssinaturasCard
        assinaturas={assinaturas}
        loading={loading}
        total={total}
        ended={ended}
        onKeep={onKeep}
        onCancel={onCancel}
        size={size}
        onOpen={() => router.push("/assinaturas" as never)}
        onAdd={() => setAdding("assinatura")}
      />
      <FixedSheet kind={adding} onClose={() => setAdding(null)} />
    </>
  );
}

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SUB_HEX = "#B48CFF";

/** The question for a subscription that did not show up: asked in place, answered in a tap. */
function EndedAsk({
  item,
  onKeep,
  onCancel,
}: {
  item: EndedSubscription;
  onKeep: () => void;
  onCancel: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <View
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 18,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: th("rgba(249,206,78,0.22)", "line"),
        backgroundColor: th("rgba(249,206,78,0.07)", "bg"),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <SubLogo name={item.name} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>
            {item.name} não foi cobrada em {MONTH_NAMES[item.month]}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 12.5, color: th(INK.soft) }}>Você ainda assina?</Text>
        </View>
      </View>
      <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
        <Pressable
          disabled={busy}
          onPress={onKeep}
          style={({ pressed }) => ({ flex: 1, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: busy ? 0.5 : pressed ? 0.85 : 1 })}
        >
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: th("#0B0B0B") }}>Sim, continua</Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await onCancel();
            } finally {
              setBusy(false);
            }
          }}
          style={({ pressed }) => ({
            flex: 1,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: th("rgba(255,255,255,0.14)", "line"),
            backgroundColor: th("rgba(255,255,255,0.08)", "bg"),
            opacity: busy ? 0.5 : pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: th("#fff") }}>{busy ? "Cancelando…" : "Cancelei"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The subscriptions' own mark, for the card with none yet. */
function SubsGlyph({ size = 44 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, alignItems: "center", justifyContent: "center", backgroundColor: th(`${SUB_HEX}24`, "bg") }}>
      <Repeat size={size * 0.44} color={th(SUB_HEX)} strokeWidth={2.1} />
    </View>
  );
}

/** When a subscription is charged, said plainly; paid ones say so. */
const chargeLine = (s: RecurringItem) => (s.isPaidThisMonth ? `Cobrada · dia ${s.dueDay}` : `${whenDue(s.dueDay) === "hoje" ? "Cobra hoje" : `Cobra ${whenDue(s.dueDay)}`} · dia ${s.dueDay}`);

/** The subscriptions card itself, drawn from what it is handed. */
export function AssinaturasCard({
  assinaturas,
  total: totalAssinaturas,
  ended = [],
  onKeep,
  onCancel,
  size,
  onOpen: open,
  onAdd,
  loading = false,
}: {
  assinaturas: RecurringItem[];
  /** Still being read: nothing is said to be missing until it has been looked for. */
  loading?: boolean;
  total: number;
  ended?: EndedSubscription[];
  onKeep?: (e: EndedSubscription) => void;
  onCancel?: (e: EndedSubscription) => void | Promise<void>;
  size: WidgetSize;
  onOpen: () => void;
  onAdd?: () => void;
}) {
  const n = assinaturas.length;
  /* What is charged next first, then what has been charged this month. */
  const ordered = [...assinaturas].sort((a, b) => Number(a.isPaidThisMonth) - Number(b.isPaidThisMonth) || daysUntil(a.dueDay) - daysUntil(b.dueDay));
  const next = ordered.find((a) => !a.isPaidThisMonth);
  const ask = ended[0];
  const yearly = totalAssinaturas * 12;

  /* Still reading: the card keeps its place, without claiming there is none. */
  if (loading && n === 0 && !ask) {
    const bar = (w: number, mt: number) => <View style={{ marginTop: mt, height: 12, width: w, borderRadius: 6, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }} />;
    return (
      <Surface style={size !== "full" ? { flex: 1, padding: 14 } : { padding: 16 }}>
        <View style={size !== "full" ? { flex: 1, justifyContent: "space-between" } : undefined}>
          <Header title="Assinaturas" />
          <View>
            {bar(96, 14)}
            {bar(64, 8)}
          </View>
        </View>
      </Surface>
    );
  }

  /* ── Compact ── */
  if (size !== "full") {
    if (n === 0 && !ask) {
      return (
        <Surface onPress={onAdd ?? open} style={{ flex: 1, padding: 14 }}>
          <View style={{ flex: 1, justifyContent: "space-between" }}>
            <Header title="Assinaturas" />
            <SubsGlyph size={40} />
            <View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>Nenhuma ativa</Text>
              <Text numberOfLines={2} style={{ marginTop: 2, fontSize: 12, lineHeight: 16, color: th(INK.soft) }}>
                Toque para adicionar
              </Text>
            </View>
          </View>
        </Surface>
      );
    }
    return (
      <Surface onPress={open} style={{ flex: 1, padding: 14 }}>
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          <Header title="Assinaturas" />
          <View style={{ marginTop: 10 }}>
            <MarkRow items={ordered} max={4} size={32} />
          </View>
          <View style={{ marginTop: 10 }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              <Text style={[nums, { fontSize: 20, fontWeight: "800", letterSpacing: -0.6, color: th("#fff") }]}>{money(totalAssinaturas)}</Text>
              <Text style={{ fontSize: 12, color: th(INK.soft) }}> /mês</Text>
            </Text>
            <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12, fontWeight: ask || (next && daysUntil(next.dueDay) <= 2) ? "600" : "400", color: th(ask ? AMBER : next && daysUntil(next.dueDay) <= 2 ? AMBER : INK.soft) }}>
              {ask ? `Confirmar ${ask.name}` : next ? `${next.name} ${whenDue(next.dueDay)}` : "Todas cobradas no mês"}
            </Text>
          </View>
        </View>
      </Surface>
    );
  }

  /* ── Full width ── */
  return (
    <Surface onPress={open} style={{ padding: 16 }}>
      <Header title="Assinaturas" aside={n > 0 ? `${n} ${n === 1 ? "ativa" : "ativas"}` : undefined} />

      {ask && onKeep && onCancel ? <EndedAsk item={ask} onKeep={() => onKeep(ask)} onCancel={() => onCancel(ask)} /> : null}

      {n === 0 ? (
        !ask && (
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <SubsGlyph />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#fff") }}>Nenhuma assinatura ativa</Text>
                <Text style={{ marginTop: 3, fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>
                  Streaming, música, nuvem, academia: o Willo mostra quanto custam por mês e por ano.
                </Text>
              </View>
            </View>
            {onAdd && (
              <Pressable
                onPress={onAdd}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  marginTop: 14,
                  height: 44,
                  borderRadius: 22,
                  flexDirection: "row",
                  gap: 6,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: th("rgba(255,255,255,0.18)", "line"),
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Plus size={16} color={th("#fff")} strokeWidth={2.2} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: th("#fff") }}>Adicionar assinatura</Text>
              </Pressable>
            )}
          </View>
        )
      ) : (
        <>
          {/* What they cost, a month and a year, beside their marks. */}
          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flexShrink: 1 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                <Text style={[nums, { fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: th("#fff") }]}>{money(totalAssinaturas)}</Text>
                <Text style={{ fontSize: 13.5, color: th(INK.soft) }}> /mês</Text>
              </Text>
              <Text style={{ marginTop: 2, fontSize: 12.5, color: th(INK.softer) }}>{money(yearly)} por ano</Text>
            </View>
            <MarkRow items={ordered} max={5} size={32} />
          </View>

          <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: th(RULE, "line") }}>
            {ordered.slice(0, 3).map((s) => {
              const soon = !s.isPaidThisMonth && daysUntil(s.dueDay) <= 2;
              return (
                <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, opacity: s.isPaidThisMonth ? 0.6 : 1 }}>
                  <SubLogo name={s.name} size={34} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>
                      {s.name}
                    </Text>
                    <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, fontWeight: soon ? "600" : "400", color: th(soon ? AMBER : INK.softer) }}>
                      {chargeLine(s)}
                      {s.source === "cartao" ? " · no cartão" : ""}
                    </Text>
                  </View>
                  <Text style={[nums, { fontSize: 14.5, fontWeight: "700", color: th("#fff") }]}>{money(s.amount)}</Text>
                  {s.isPaidThisMonth && (
                    <View style={{ width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg") }}>
                      <Check size={10} color={th("#0B0B0B")} strokeWidth={3} />
                    </View>
                  )}
                </View>
              );
            })}
            {n > 3 && <Text style={{ paddingTop: 12, fontSize: 12.5, fontWeight: "600", color: th(INK.soft) }}>e mais {n - 3}</Text>}
          </View>
        </>
      )}
    </Surface>
  );
}

/* ────────────────────────────────── Goals ────────────────────────────────── */

/** How much has been put aside, and how close each goal is. */
export function MetasTile({ size = "full" }: { size?: WidgetSize }) {
  const router = useRouter();
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[] | null>(() => keptValue("metas", user?.id));

  useEffect(() => {
    let alive = true;
    if (!user) {
      setGoals([]);
      return;
    }
    const load = async () => {
      try {
        const rows = await fetchGoals();
        keepValue("metas", user.id, rows);
        if (alive) setGoals(rows);
      } catch {
        if (alive) setGoals([]);
      }
    };
    void load();
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    return () => {
      alive = false;
      window.removeEventListener("finance-data-changed", onChange);
    };
  }, [user]);

  if (goals === null) return <Skeleton size={size} />;
  return <MetasCard goals={goals} size={size} onOpen={() => router.push("/gestao")} onOpenGoal={(id) => router.push(`/metas/${id}` as never)} />;
}


/**
 * The caixinhas card itself, drawn from what it is handed.
 *
 * Full width it is a short list rather than the shelf of picture cards the accounts
 * screen has: on the home a caixinha is a line to glance at — its picture small, its
 * name, how far along, what it holds — and the shelf is one tap away. The nearest to
 * done come first.
 */
export function MetasCard({
  goals,
  size,
  onOpen: open,
  onOpenGoal,
}: {
  goals: Goal[];
  size: WidgetSize;
  onOpen: () => void;
  onOpenGoal?: (id: string) => void;
}) {
  if (goals.length === 0) {
    return (
      <Surface onPress={open} style={{ flex: 1, padding: 16 }}>
        <Header title="Caixinhas" />
        <Empty text="Nenhuma caixinha ainda. Toque para criar a primeira." />
      </Surface>
    );
  }

  const guardado = goals.reduce((s, g) => s + (Number(g.current_amount) || 0), 0);
  const objetivo = goals.reduce((s, g) => s + (Number(g.target_amount) || 0), 0);
  const overall = objetivo > 0 ? Math.min(guardado / objetivo, 1) : 0;

  if (size !== "full") {
    /* Compact, the whole card is used: the caixinhas' own covers overlapping at the top,
       what is put away large in the middle, and how far along at the foot. */
    const covers = [...goals].sort((a, b) => (Number(b.current_amount) || 0) - (Number(a.current_amount) || 0)).slice(0, 3);
    return (
      <Surface onPress={open} style={{ flex: 1, padding: 14 }}>
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          <Header title="Caixinhas" />

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {covers.map((g, i) => (
              <View
                key={g.id}
                style={{
                  marginLeft: i === 0 ? 0 : -12,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: th("#1A1B20", "bg"),
                  overflow: "hidden",
                  zIndex: covers.length - i,
                }}
              >
                <CaixinhaCover goal={g} width={38} height={38} radius={12} glyph={19} />
              </View>
            ))}
            {goals.length > covers.length && (
              <Text style={{ marginLeft: 8, fontSize: 12.5, fontWeight: "600", color: th(INK.soft) }}>+{goals.length - covers.length}</Text>
            )}
          </View>

          <View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: th("#fff") }]}>
              {money(guardado)}
            </Text>
            <Text style={{ marginTop: 1, fontSize: 12.5, color: th(INK.soft) }}>
              guardados em {goals.length} {goals.length === 1 ? "caixinha" : "caixinhas"}
            </Text>
          </View>

          <View>
            {objetivo > 0 ? (
              <>
                <Track share={overall} color={GREEN} height={6} />
                <Text numberOfLines={1} style={[nums, { marginTop: 7, fontSize: 12, color: th(INK.soft) }]}>
                  <Text style={{ fontWeight: "700", color: th("#fff") }}>{Math.round(overall * 100)}%</Text> de {money(objetivo)}
                </Text>
              </>
            ) : (
              <Text numberOfLines={1} style={{ fontSize: 12, color: th(INK.softer) }}>Sem meta definida</Text>
            )}
          </View>
        </View>
      </Surface>
    );
  }

  /* The ones still open first, the closest to done at the top. */
  const ordered = [...goals]
    .map((g) => ({ goal: g, ...goalProgress(g) }))
    .sort((a, b) => Number(a.isComplete) - Number(b.isComplete) || b.progress - a.progress);
  const shown = ordered.slice(0, 4);

  return (
    <Surface onPress={open} style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>
      <Header title="Caixinhas" aside={`${goals.length} ${goals.length === 1 ? "caixinha" : "caixinhas"}`} />
      <Lead value={money(guardado)} unit="guardados" />
      {objetivo > 0 && (
        <Text style={[nums, { marginTop: 2, fontSize: 12.5, color: th(INK.soft) }]}>
          {Math.round(overall * 100)}% de {money(objetivo)}
        </Text>
      )}

      <View style={{ marginTop: 10 }}>
        {shown.map(({ goal, progress, percent, isComplete }, i) => {
          const hasTarget = Number(goal.target_amount) > 0;
          const hex = goalPreset(goal).hex;
          return (
            <Pressable
              key={goal.id}
              onPress={() => (onOpenGoal ? onOpenGoal(goal.id) : open())}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 11,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: th("rgba(255,255,255,0.06)", "line"),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <CaixinhaCover goal={goal} width={46} height={46} radius={14} glyph={24} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "600", color: th("#fff") }}>{goal.name}</Text>
                  <Text style={[nums, { fontSize: 15, fontWeight: "600", color: th("#fff") }]}>{money(Number(goal.current_amount) || 0)}</Text>
                </View>
                {hasTarget ? (
                  <View style={{ marginTop: 7, flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Track share={progress} color={isComplete ? GREEN : hex} height={4} delay={0.05 * i} />
                    </View>
                    <Text style={[nums, { fontSize: 12, color: th(isComplete ? GREEN : INK.soft) }]}>{percent}%</Text>
                  </View>
                ) : null}
                {hasTarget ? (
                  <Text numberOfLines={1} style={[nums, { marginTop: 4, fontSize: 12, color: th(INK.softer) }]}>
                    Meta de {money(Number(goal.target_amount) || 0)}
                  </Text>
                ) : (
                  <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12.5, color: th(INK.softer) }}>sem valor definido</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {goals.length > shown.length && (
        <Text style={{ paddingTop: 6, paddingBottom: 10, fontSize: 13, fontWeight: "600", color: th(INK.soft) }}>
          Ver todas as {goals.length}
        </Text>
      )}
    </Surface>
  );
}
