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
import type { EndedSubscription } from "~/lib/subscriptionCheck";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import { ChevronRight } from "~/components/icons";
import CaixinhaTile from "~/components/accounts/CaixinhaTile";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

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
      {aside ? <Text style={{ fontSize: 12.5, color: INK.softer }}>{aside}</Text> : null}
      <ChevronRight size={16} color={INK.faint} />
    </View>
  );
}

/** The figure a card leads with, at the size of a line and not a headline. */
function Lead({ value, unit, compact = false }: { value: string; unit?: string; compact?: boolean }) {
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: compact ? 8 : 10 }}>
      <Text style={[nums, { fontSize: compact ? 17 : 21, fontWeight: "700", letterSpacing: -0.5, color: "#fff" }]}>
        {value}
      </Text>
      {unit ? <Text style={{ fontSize: compact ? 12 : 13.5, color: INK.soft }}> {unit}</Text> : null}
    </Text>
  );
}

function Track({ share, color = "#fff", height = 6, delay = 0.1 }: { share: number; color?: string; height?: number; delay?: number }) {
  return (
    <View style={{ height, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" }}>
      <Bar share={share} color={color} delay={delay} />
    </View>
  );
}

/** A small ring for how far along one thing is. */
function Ring({ share, color, size = 30 }: { share: number; color: string; size?: number }) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={[Math.max(share, 0.04) * c, c]}
      />
    </Svg>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={{ marginTop: 10, fontSize: 13.5, lineHeight: 19, color: INK.soft }}>{text}</Text>;
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
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.046)",
      }}
    />
  );
}

/* ─────────────────────────────── Instalments ─────────────────────────────── */

/** What is still being paid off, and when it ends. */
export function ParcelamentosTile({ size = "full" }: { size?: WidgetSize }) {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<ActiveInstallmentItem[] | null>(null);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    try {
      const [active, cats] = await Promise.all([loadActiveInstallments(user.id), getCustomCategories()]);
      setItems(active.items);
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
      : "Última parcela este mês";

  if (!full) {
    return (
      <Surface onPress={open} style={{ flex: 1, padding: 16 }}>
        <Header title="Parcelamentos" />
        <Lead value={money(totals.totalMensal)} unit="/mês" compact />
        <View style={{ marginTop: 12 }}>
          <Track share={paid} height={5} />
        </View>
        <Text numberOfLines={1} style={{ marginTop: 8, fontSize: 12, color: INK.soft }}>
          {totals.monthsUntilFree > 0 ? `Livre em ${totals.monthsUntilFree} meses` : "Termina este mês"}
        </Text>
      </Surface>
    );
  }

  return (
    <Surface onPress={open} style={{ padding: 16 }}>
      <Header title="Parcelamentos" aside={`${items.length} ${items.length === 1 ? "compra" : "compras"}`} />
      <Lead value={money(totals.totalMensal)} unit="por mês" />
      <Text style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>{ends}</Text>

      {/* How much of the debt is already behind you. */}
      <View style={{ marginTop: 14 }}>
        <Track share={paid} />
      </View>
      <View style={{ marginTop: 7, flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ fontSize: 12, color: INK.soft }}>{Math.round(paid * 100)}% já pago</Text>
        <Text style={[nums, { fontSize: 12, color: INK.soft }]}>falta {money(totals.totalRestante)}</Text>
      </View>

      <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: RULE }}>
        {heaviest.map((item) => {
          const hex = categoryHex(item.category, customCats);
          return (
            <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12 }}>
              <Ring share={item.installment_current / item.installments} color={hex} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "500", color: "#fff" }}>
                  {item.name}
                </Text>
                <Text style={{ marginTop: 1, fontSize: 12, color: INK.softer }}>
                  parcela {item.installment_current} de {item.installments}
                </Text>
              </View>
              <Text style={[nums, { fontSize: 14.5, fontWeight: "600", color: "#fff" }]}>{money(item.amount)}</Text>
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
        backgroundColor: `${hex}2E`,
        borderWidth: ring ? 2 : 0,
        borderColor: "#121315",
      }}
    >
      <Text style={{ fontSize: size * 0.42, fontWeight: "700", color: hex }}>{initial(name)}</Text>
    </View>
  );
}

/** Everything subscribed to, as a row of marks overlapping like a stack of cards. */
function MarkRow({ items, max }: { items: RecurringItem[]; max: number }) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {shown.map((s, i) => (
        <View key={s.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Mark name={s.name} ring />
        </View>
      ))}
      {rest > 0 && <Text style={{ marginLeft: 8, fontSize: 12.5, color: INK.soft }}>+{rest}</Text>}
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
 * A slice of the recurring charges rather than a list of its own, because nothing in
 * the data marks a row as a subscription. With none, the card is not drawn at all: it
 * has nothing to say and is back the day there is one. When a subscription did not turn
 * up in the month that closed, the card leads with the question — still subscribed? —
 * because it is the one thing here someone has to answer.
 */
export function AssinaturasTile({
  size = "full",
  assinaturas,
  total,
  ended,
  onKeep,
  onCancel,
}: {
  size?: WidgetSize;
  assinaturas: RecurringItem[];
  total: number;
  ended: EndedSubscription[];
  onKeep: (e: EndedSubscription) => void;
  onCancel: (e: EndedSubscription) => void;
}) {
  const router = useRouter();
  if (assinaturas.length === 0 && ended.length === 0) return null;
  return (
    <AssinaturasCard
      assinaturas={assinaturas}
      total={total}
      ended={ended}
      onKeep={onKeep}
      onCancel={onCancel}
      size={size}
      onOpen={() => router.push("/transacoes")}
    />
  );
}

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

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
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(255,255,255,0.06)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Mark name={item.name} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: "600", color: "#fff" }}>
            {item.name} não foi cobrada em {MONTH_NAMES[item.month]}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>Você ainda assina?</Text>
        </View>
      </View>
      <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
        <Pressable
          disabled={busy}
          onPress={onKeep}
          style={({ pressed }) => ({
            flex: 1,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            opacity: busy ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#0B0B0B" }}>Sim, continua</Text>
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
            borderColor: "rgba(255,255,255,0.14)",
            backgroundColor: "rgba(255,255,255,0.08)",
            opacity: busy ? 0.5 : pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#fff" }}>{busy ? "Cancelando…" : "Cancelei"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The subscriptions card itself, drawn from what it is handed. */
export function AssinaturasCard({
  assinaturas,
  total: totalAssinaturas,
  ended = [],
  onKeep,
  onCancel,
  size,
  onOpen: open,
}: {
  assinaturas: RecurringItem[];
  total: number;
  ended?: EndedSubscription[];
  onKeep?: (e: EndedSubscription) => void;
  onCancel?: (e: EndedSubscription) => void | Promise<void>;
  size: WidgetSize;
  onOpen: () => void;
}) {
  const n = assinaturas.length;
  const next = assinaturas
    .filter((a) => !a.isPaidThisMonth)
    .sort((a, b) => daysUntil(a.dueDay) - daysUntil(b.dueDay));
  const ask = ended[0];

  if (size !== "full") {
    return (
      <Surface onPress={open} style={{ flex: 1, padding: 16 }}>
        <Header title="Assinaturas" />
        <Lead value={money(totalAssinaturas)} unit="/mês" compact />
        <View style={{ marginTop: 10 }}>
          <MarkRow items={assinaturas} max={3} />
        </View>
        <Text numberOfLines={1} style={{ marginTop: 8, fontSize: 12, color: ask ? AMBER : INK.soft }}>
          {ask ? `Confirmar ${ask.name}` : next[0] ? `${next[0].name} ${whenDue(next[0].dueDay)}` : "Tudo pago no mês"}
        </Text>
      </Surface>
    );
  }

  return (
    <Surface onPress={open} style={{ padding: 16 }}>
      <Header title="Assinaturas" aside={n > 0 ? `${n} ${n === 1 ? "ativa" : "ativas"}` : undefined} />

      {ask && onKeep && onCancel ? (
        <EndedAsk item={ask} onKeep={() => onKeep(ask)} onCancel={() => onCancel(ask)} />
      ) : null}

      {n > 0 && (
        <>
          <Lead value={money(totalAssinaturas)} unit="por mês" />
          <View style={{ marginTop: 12 }}>
            <MarkRow items={assinaturas} max={7} />
          </View>

          <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: RULE }}>
            {next.length === 0 ? (
              <Text style={{ paddingTop: 12, fontSize: 13, color: INK.soft }}>Todas já foram pagas este mês.</Text>
            ) : (
              next.slice(0, 2).map((s) => (
                <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12 }}>
                  <Mark name={s.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "500", color: "#fff" }}>
                      {s.name}
                    </Text>
                    <Text style={{ marginTop: 1, fontSize: 12, color: INK.softer }}>
                      dia {s.dueDay}, {whenDue(s.dueDay)}
                      {s.source === "cartao" ? " · no cartão" : ""}
                    </Text>
                  </View>
                  <Text style={[nums, { fontSize: 14.5, fontWeight: "600", color: "#fff" }]}>{money(s.amount)}</Text>
                </View>
              ))
            )}
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
  const [goals, setGoals] = useState<Goal[] | null>(null);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setGoals([]);
      return;
    }
    const load = async () => {
      try {
        const rows = await fetchGoals();
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

const SHELF_W = 132;
const SHELF_H = 172;

/**
 * The caixinhas card itself, drawn from what it is handed.
 *
 * Full width it is the same shelf of picture cards the accounts screen has, smaller:
 * a goal looks the same wherever it is met. The nearest to done come first.
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
    return (
      <Surface onPress={open} style={{ flex: 1, padding: 16 }}>
        <Header title="Caixinhas" />
        <Lead value={money(guardado)} compact />
        {objetivo > 0 && (
          <>
            <View style={{ marginTop: 12 }}>
              <Track share={overall} color={GREEN} height={5} />
            </View>
            <Text numberOfLines={1} style={{ marginTop: 8, fontSize: 12, color: INK.soft }}>
              {Math.round(overall * 100)}% de {money(objetivo)}
            </Text>
          </>
        )}
      </Surface>
    );
  }

  /* The ones still open first, the closest to done at the top. */
  const ordered = [...goals]
    .map((g) => ({ goal: g, ...goalProgress(g) }))
    .sort((a, b) => Number(a.isComplete) - Number(b.isComplete) || b.progress - a.progress)
    .slice(0, 6);

  return (
    <Surface onPress={open} style={{ paddingTop: 16, paddingBottom: 16 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <Header title="Caixinhas" aside={`${goals.length} ${goals.length === 1 ? "caixinha" : "caixinhas"}`} />
        <Lead value={money(guardado)} unit="guardados" />
        {objetivo > 0 && (
          <Text style={[nums, { marginTop: 2, fontSize: 12.5, color: INK.soft }]}>
            {Math.round(overall * 100)}% de {money(objetivo)}
          </Text>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, marginTop: 14 }}
        snapToInterval={SHELF_W + 10}
        decelerationRate="fast"
      >
        {ordered.map(({ goal }, i) => (
          <CaixinhaTile
            key={goal.id}
            goal={goal}
            delay={0.05 * i}
            width={SHELF_W}
            height={SHELF_H}
            onPress={() => (onOpenGoal ? onOpenGoal(goal.id) : open())}
          />
        ))}
      </ScrollView>
    </Surface>
  );
}
