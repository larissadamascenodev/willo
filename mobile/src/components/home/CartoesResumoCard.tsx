import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useCardsOverview, monthKey } from "@/hooks/useCardsOverview";
import { useAuth } from "~/lib/auth";
import { keepValue, keptValue } from "~/lib/warmStart";
import { getInvoiceStatusLabel, type CreditCardItem } from "@/lib/invoiceCycle";
import { colorFor } from "@/lib/banks";
import { shade } from "@/lib/tone";
import Surface from "~/components/Surface";
import BankMark from "~/components/BankMark";
import { ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th } from "~/theme/theme";
/**
 * What the cards add up to, and which one owes what.
 *
 * A credit card is a bill, so every figure here is the open invoice — the one still
 * to be paid — rather than the limit or the spend. One bar splits the total by card,
 * in each card's own colour, so the shape of the debt is read before any figure is.
 */
export default function CartoesResumoCard({ size = "full" }: { size?: "half" | "full" } = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const live = useCardsOverview();
  /* The last cards seen are drawn while the fresh ones load, never a blank box. */
  const kept = useMemo(
    () => keptValue<{ cards: typeof live.cards; invoices: typeof live.invoices }>("cartoes", user?.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id],
  );
  useEffect(() => {
    if (!live.loading && user) keepValue("cartoes", user.id, { cards: live.cards, invoices: live.invoices });
  }, [live.loading, live.cards, live.invoices, user]);
  const showKept = live.loading && !!kept;
  const cards = showKept ? kept!.cards : live.cards;
  const invoices = showKept ? kept!.invoices : live.invoices;
  const loading = live.loading && !kept;

  const rows = useMemo(() => {
    const now = new Date();
    const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);

    return cards.map((card) => {
      const open =
        invoices
          .filter(
            (i) =>
              i.cardId === card.id &&
              !i.isPaid &&
              i.total > 0 &&
              monthKey(i.year, i.month) >= currentKey,
          )
          .sort((a, b) => monthKey(a.year, a.month) - monthKey(b.year, b.month))[0] ?? null;

      const item: CreditCardItem = {
        id: card.id,
        name: card.name,
        limit: card.limit,
        used_limit: card.used,
        closing_day: card.closingDay,
        due_day: card.dueDay,
        color: card.color,
        last_four_digits: card.lastFour,
      };

      return {
        card,
        hex: colorFor(card.name, card.color, "#8B5CF6"),
        owed: open ? Math.max(open.total - open.paid, 0) : 0,
        available: Math.max(card.limit - card.used, 0),
        status: getInvoiceStatusLabel(
          item,
          open
            ? { amount: open.total, month: open.month, year: open.year, isPaid: open.isPaid }
            : undefined,
        ),
      };
    });
  }, [cards, invoices]);

  /* The shared hook never settles without a session; that is not loading, it is
     nothing to show. */
  if (loading && user) return <Surface style={{ height: 196 }}><View /></Surface>;
  if (rows.length === 0) {
    return (
      <Surface onPress={() => router.push("/cartoes")} style={{ flex: 1, padding: size === "half" ? 14 : 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text numberOfLines={1} style={[T.cardLabel, { flex: 1 }, size === "half" && { fontSize: 13 }]}>{size === "half" ? "Cartões" : "Cartões de crédito"}</Text>
          <ChevronRight size={16} color={th(INK.faint)} />
        </View>
        <Text style={{ marginTop: 10, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>Nenhum cartão ainda. Toque para adicionar o primeiro.</Text>
      </Surface>
    );
  }

  const total = rows.reduce((s, r) => s + r.owed, 0);

  if (size === "half") {
    /* Compact, the whole card used: the cards' marks at the top, what the open invoices
       ask for large in the middle, and at the foot the bill split by card with the limit
       still free. */
    const free = rows.reduce((s, r) => s + r.available, 0);
    return (
      <Surface onPress={() => router.push("/cartoes")} style={{ flex: 1, padding: 14 }}>
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text numberOfLines={1} style={[T.cardLabel, { flex: 1, fontSize: 13 }]}>Cartões</Text>
            <ChevronRight size={14} color={th(INK.faint)} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {rows.slice(0, 3).map((r, i) => (
              <View key={r.card.id} style={{ marginLeft: i === 0 ? 0 : -10, borderRadius: 999, borderWidth: 2, borderColor: th("#1A1B20", "bg"), zIndex: 3 - i }}>
                <BankMark name={r.card.name} hex={r.hex} size={34} />
              </View>
            ))}
            {rows.length > 3 && <Text style={{ marginLeft: 8, fontSize: 12.5, fontWeight: "600", color: th(INK.soft) }}>+{rows.length - 3}</Text>}
          </View>

          <View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.7, color: th("#fff"), fontVariant: ["tabular-nums"] }}>
              {money(total)}
            </Text>
            <Text style={{ marginTop: 1, fontSize: 12.5, color: th(INK.soft) }}>em faturas abertas</Text>
          </View>

          <View>
            <View style={{ height: 7, flexDirection: "row", gap: 3, borderRadius: 999, overflow: "hidden", backgroundColor: total > 0 ? "transparent" : th("rgba(255,255,255,0.07)", "bg") }}>
              {total > 0 &&
                rows
                  .filter((r) => r.owed > 0)
                  .map((r) => <View key={r.card.id} style={{ flex: r.owed / total, minWidth: 6, borderRadius: 999, backgroundColor: th(r.hex, "bg") }} />)}
            </View>
            <Text numberOfLines={1} style={{ marginTop: 7, fontSize: 12, color: th(INK.soft) }}>
              <Text style={{ fontWeight: "700", color: th("#fff") }}>{money(free)}</Text> livres
            </Text>
          </View>
        </View>
      </Surface>
    );
  }

  return (
    <Surface
      onPress={() => router.push("/cartoes")}
      style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={T.cardLabel}>Cartões de crédito</Text>
        <ChevronRight size={16} color={th(INK.faint)} />
      </View>

      <Text numberOfLines={1} style={[T.figure, { marginTop: 4 }]}>
        {money(total)}
      </Text>
      <Text numberOfLines={1} style={[T.note, { marginTop: 8, fontSize: 13 }]}>
        em faturas abertas
      </Text>

      {/* One bar split by card: the share each takes of what is owed. */}
      <View style={{ flexDirection: "row", gap: 3, height: 7, marginTop: 14 }}>
        {total > 0 ? (
          rows
            .filter((r) => r.owed > 0)
            .map((r) => (
              <View
                key={r.card.id}
                style={{
                  flexGrow: r.owed / total,
                  flexBasis: 0,
                  borderRadius: 999,
                  backgroundColor: th(r.hex, "bg"),
                }}
              />
            ))
        ) : (
          <View style={{ flex: 1, borderRadius: 999, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }} />
        )}
      </View>

      <View
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: th("rgba(255,255,255,0.06)", "line"),
          gap: 12,
        }}
      >
        {rows.map((r) => (
          <View key={r.card.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BankMark name={r.card.name} hex={r.hex} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[T.rowName, { fontSize: 14 }]}>
                {r.card.name}
              </Text>
              <Text numberOfLines={1} style={T.rowNote}>
                {r.owed > 0 ? r.status.label : "Sem fatura em aberto"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={[T.rowValue, { fontSize: 14 }, r.owed === 0 && { color: th(INK.softer) }]}
              >
                {money(r.owed)}
              </Text>
              <Text style={{ fontSize: 11.5, color: th(INK.softer) }}>
                {money(r.available)} livres
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Surface>
  );
}
