import { useMemo } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useCardsOverview, monthKey } from "@/hooks/useCardsOverview";
import { useAuth } from "~/lib/auth";
import { getInvoiceStatusLabel, type CreditCardItem } from "@/lib/invoiceCycle";
import { colorFor } from "@/lib/banks";
import { shade } from "@/lib/tone";
import Surface from "~/components/Surface";
import BankMark from "~/components/BankMark";
import { ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What the cards add up to, and which one owes what.
 *
 * A credit card is a bill, so every figure here is the open invoice — the one still
 * to be paid — rather than the limit or the spend. One bar splits the total by card,
 * in each card's own colour, so the shape of the debt is read before any figure is.
 */
export default function CartoesResumoCard() {
  const router = useRouter();
  const { user } = useAuth();
  const { cards, invoices, loading } = useCardsOverview();

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
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.owed, 0);

  return (
    <Surface
      onPress={() => router.push("/cartoes")}
      style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={T.cardLabel}>Cartões de crédito</Text>
        <ChevronRight size={16} color={INK.faint} />
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
                  backgroundColor: r.hex,
                }}
              />
            ))
        ) : (
          <View style={{ flex: 1, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" }} />
        )}
      </View>

      <View
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.06)",
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
                style={[T.rowValue, { fontSize: 14 }, r.owed === 0 && { color: INK.softer }]}
              >
                {money(r.owed)}
              </Text>
              <Text style={{ fontSize: 11.5, color: INK.softer }}>
                {money(r.available)} livres
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Surface>
  );
}
