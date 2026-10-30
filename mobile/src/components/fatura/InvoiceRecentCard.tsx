import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { readInvoice, type InvoiceLine } from "@/lib/invoice/readModel";
import { categoryHex } from "@/lib/categoryData";
import { FastForward, Receipt, Undo2 } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * The last few things that happened on this card.
 *
 * Laid out the way an account lists its latest movements: a quiet title, the newest few
 * on the ground, each with its glyph, when and where, and — for an instalment — how far
 * the plan has gone. The whole statement is the button under them.
 */
export default function InvoiceRecentCard({
  items,
  count = 5,
  onSeeAll,
  onOpen,
}: {
  items: any[];
  count?: number;
  onSeeAll: () => void;
  onOpen: (line: InvoiceLine) => void;
}) {
  const { lines } = useMemo(() => readInvoice(items), [items]);
  const visible = lines.slice(0, count);

  return (
    <View>
      <Text style={[T.eyebrow, { paddingHorizontal: 4 }]}>Últimos lançamentos</Text>

      {visible.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <Receipt size={20} color={INK.soft} />
          <Text style={{ marginTop: 10, fontSize: 14, color: INK.soft }}>Nenhum lançamento nesta fatura</Text>
        </View>
      ) : (
        <View style={{ marginTop: 6 }}>
          {visible.map((line, i) => (
            <Animated.View key={line.id} entering={FadeInDown.delay(40 + i * 35).duration(260)}>
              <InvoiceLineRow line={line} onPress={() => onOpen(line)} />
            </Animated.View>
          ))}
        </View>
      )}

      {lines.length > 0 && (
        <Pressable
          onPress={onSeeAll}
          style={({ pressed }) => ({
            marginTop: 16,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            backgroundColor: "rgba(255,255,255,0.05)",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 15.5, fontWeight: "500", color: "#fff" }}>Ver todos os lançamentos</Text>
        </Pressable>
      )}
    </View>
  );
}

/** One line of a statement. Shared with the full list, so the two never drift. */
export function InvoiceLineRow({ line, onPress }: { line: InvoiceLine; onPress?: () => void }) {
  const isRefund = line.amount < 0;
  const isEarly = line.kind === "antecipacao";
  const hex = isRefund ? GREEN : isEarly ? "#7DD3FC" : categoryHex(line.category);
  const Icon = isRefund ? Undo2 : isEarly ? FastForward : categoryIcon(line.category);
  const day = new Date(`${line.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const plan = line.installment;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
        <Icon size={20} color={chipInk(hex)} strokeWidth={2} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>{line.name}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>
          {day} · {line.category}
        </Text>
        {plan && (
          <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, maxWidth: 120, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.10)" }}>
              <View style={{ width: `${(plan.current / plan.total) * 100}%`, height: 4, borderRadius: 2, backgroundColor: hex }} />
            </View>
            <Text style={{ fontSize: 11.5, fontWeight: "600", color: INK.soft }}>
              {plan.current} de {plan.total}
            </Text>
          </View>
        )}
      </View>

      <Text style={{ fontSize: 15, fontWeight: "600", color: isRefund ? GREEN : RED }}>
        {isRefund ? "+" : "−"}
        {money(Math.abs(line.amount))}
      </Text>
    </Pressable>
  );
}
