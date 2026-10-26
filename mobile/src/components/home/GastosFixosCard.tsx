import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import { useRecorrentes, daysUntil, type RecurringItem } from "@/hooks/useRecorrentes";
import { categoryHex } from "@/lib/categoryData";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import SegmentedTabs from "~/components/SegmentedTabs";
import { Check, ChevronDown, ChevronUp, Repeat } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What is certain every month.
 *
 * Fixed outgoings and fixed income are two questions wearing the same shape, so
 * they share a card, and the switch between them comes first — under the title,
 * above everything it changes — rather than halfway down.
 *
 * The total is at the size of a line, as on the cards around it. Under it the
 * month's progress through these is drawn as one tick per item, filled once it has
 * happened, which says "three of five paid" before the words do. Each item wears
 * its category's colour and says where it stands plainly: "Vence em 3 dias",
 * "Recebe amanhã", "Pago".
 */

const SHOWN = 3;
/* Past this many, ticks come out thinner than the gaps between them. */
const MAX_TICKS = 16;

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const RULE = "rgba(255,255,255,0.07)";

export default function GastosFixosCard() {
  const { user } = useAuth();
  const { items, loading } = useRecorrentes();
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);

  useEffect(() => {
    let alive = true;
    getCustomCategories()
      .then((c) => alive && setCustomCats(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* No session is not loading — it is nothing to show. */
  if (loading && user) return <Surface style={{ height: 220 }}><View /></Surface>;
  return <GastosFixosView items={items} customCats={customCats} />;
}

/** The card itself, drawn from what it is handed. */
export function GastosFixosView({ items, customCats }: { items: RecurringItem[]; customCats: CustomCategory[] }) {
  const [tab, setTab] = useState<"despesa" | "receita">("despesa");
  const [expanded, setExpanded] = useState(false);

  /* Soonest first, with what has already happened at the end. */
  const filtered = useMemo(
    () =>
      items
        .filter((s) => s.txType === tab)
        .sort(
          (a, b) =>
            Number(a.isPaidThisMonth) - Number(b.isPaidThisMonth) || daysUntil(a.dueDay) - daysUntil(b.dueDay),
        ),
    [items, tab],
  );
  const total = useMemo(() => filtered.reduce((s, x) => s + x.amount, 0), [filtered]);
  const despesaCount = items.filter((s) => s.txType === "despesa").length;
  const receitaCount = items.filter((s) => s.txType === "receita").length;

  if (items.length === 0) {
    return (
      <Surface style={{ padding: 16 }}>
        <Text style={T.cardLabel}>Gastos e receitas fixas</Text>
        <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Repeat size={16} color={INK.soft} />
          </View>
          <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: INK.soft }}>
            Nenhuma conta ou receita fixa ainda. Marque um lançamento como fixo e ele aparece aqui.
          </Text>
        </View>
      </Surface>
    );
  }

  const shown = expanded ? filtered : filtered.slice(0, SHOWN);
  const hasMore = filtered.length > SHOWN;
  const paidCount = filtered.filter((s) => s.isPaidThisMonth).length;
  const income = tab === "receita";

  return (
    <Surface>
      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <Text style={T.cardLabel}>Gastos e receitas fixas</Text>

        <View style={{ marginTop: 12 }}>
          <SegmentedTabs
            compact
            height={30}
            value={tab}
            onChange={(k) => {
              setTab(k);
              setExpanded(false);
            }}
            options={[
              { key: "despesa" as const, label: `Despesas ${despesaCount}` },
              { key: "receita" as const, label: `Receitas ${receitaCount}` },
            ]}
          />
        </View>

        {filtered.length === 0 ? (
          <Text style={{ paddingVertical: 22, fontSize: 13.5, color: INK.soft }}>
            Nenhuma {income ? "receita fixa" : "despesa fixa"} ainda.
          </Text>
        ) : (
          <>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 14 }}>
              <Text style={[nums, { fontSize: 21, fontWeight: "700", letterSpacing: -0.5, color: "#fff" }]}>
                {money(total)}
              </Text>
              <Text style={{ fontSize: 13.5, color: INK.soft }}> por mês</Text>
            </Text>

            {/* The month's progress through them: one tick each, filled once it has happened. */}
            <View style={{ marginTop: 12 }}>
              {filtered.length <= MAX_TICKS ? (
                <View style={{ flexDirection: "row", gap: 3 }}>
                  {/* What has happened fills from the left, as progress does. */}
                  {[...filtered]
                    .sort((a, b) => Number(b.isPaidThisMonth) - Number(a.isPaidThisMonth))
                    .map((s) => (
                    <View
                      key={s.id}
                      style={{
                        flex: 1,
                        height: 5,
                        borderRadius: 999,
                        backgroundColor: s.isPaidThisMonth
                          ? income
                            ? GREEN
                            : "#fff"
                          : "rgba(255,255,255,0.10)",
                      }}
                    />
                  ))}
                </View>
              ) : (
                <View style={{ height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.10)" }}>
                  <Bar share={paidCount / filtered.length} color={income ? GREEN : "#fff"} delay={0.06} />
                </View>
              )}
              <Text style={{ marginTop: 7, fontSize: 12, color: INK.soft }}>
                {paidCount} de {filtered.length} {income ? "já recebidas" : "já pagas"} este mês
              </Text>
            </View>
          </>
        )}
      </View>

      {filtered.length > 0 && (
        <View style={{ marginTop: 12, marginHorizontal: 16, borderTopWidth: 1, borderTopColor: RULE }}>
          {shown.map((s, i) => (
            <FixedRow key={s.id} item={s} customCats={customCats} first={i === 0} />
          ))}
        </View>
      )}

      {hasMore ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            marginTop: 4,
            borderTopWidth: 1,
            borderTopColor: RULE,
            paddingVertical: 12,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.74)" }}>
            {expanded ? "Mostrar menos" : `Ver todas (${filtered.length})`}
          </Text>
          {expanded ? (
            <ChevronUp size={16} color="rgba(255,255,255,0.74)" />
          ) : (
            <ChevronDown size={16} color="rgba(255,255,255,0.74)" />
          )}
        </Pressable>
      ) : (
        <View style={{ height: 6 }} />
      )}
    </Surface>
  );
}

/** One fixed item: what it is, where it stands, what it costs. */
function FixedRow({ item: s, customCats, first }: { item: RecurringItem; customCats: CustomCategory[]; first: boolean }) {
  const income = s.txType === "receita";
  const days = daysUntil(s.dueDay);
  const soon = !s.isPaidThisMonth && days <= 3;
  const Icon = categoryIcon(s.category, customCats);
  const hex = categoryHex(s.category, customCats);

  const where = s.isPaidThisMonth
    ? `${income ? "Recebido" : "Pago"} · dia ${s.dueDay}`
    : `${income ? "Recebe" : "Vence"} ${days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`} · dia ${s.dueDay}`;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: RULE,
        opacity: s.isPaidThisMonth ? 0.62 : 1,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: chipFill(hex),
        }}
      >
        <Icon size={18} color={chipInk(hex)} strokeWidth={2} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "500", color: "#fff" }}>
          {s.name}
        </Text>
        <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: soon ? AMBER : INK.soft }}>
          {where}
        </Text>
      </View>

      <Text numberOfLines={1} style={[nums, { fontSize: 15, fontWeight: "600", color: "#fff" }]}>
        {income ? "+" : ""}
        {money(s.amount)}
      </Text>
      {s.isPaidThisMonth && (
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: income ? GREEN : "#fff",
          }}
        >
          <Check size={11} color="#0B0B0B" strokeWidth={3} />
        </View>
      )}
    </View>
  );
}
