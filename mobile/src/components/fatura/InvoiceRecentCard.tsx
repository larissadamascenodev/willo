import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { readInvoice, type InvoiceLine } from "@/lib/invoice/readModel";
import { categoryHex } from "@/lib/categoryData";
import { ChevronRight, FastForward, Receipt, Undo2 } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";

/**
 * The last few things that happened on this card.
 *
 * Light on purpose: the full statement is one tap away, so this is a glance, not a
 * list — small discs, one line of context each, and no second way through to the
 * same page at the bottom. Everything it needs to say fits on the line it is
 * already using.
 */
export default function InvoiceRecentCard({
  items,
  count = 4,
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
    <View
      style={{
        overflow: "hidden",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.07)",
        backgroundColor: "rgba(255,255,255,0.045)",
        paddingHorizontal: 4,
        paddingTop: 14,
        paddingBottom: 4,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingBottom: 4,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>Lançamentos recentes</Text>
        {lines.length > 0 && (
          <Pressable
            onPress={onSeeAll}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              paddingHorizontal: 8,
              paddingVertical: 4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 12.5, color: "rgba(255,255,255,0.62)" }}>Ver todos</Text>
            <ChevronRight size={14} color="rgba(255,255,255,0.62)" />
          </Pressable>
        )}
      </View>

      {visible.length === 0 ? (
        <View style={{ alignItems: "center", paddingHorizontal: 16, paddingVertical: 32 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.05)",
            }}
          >
            <Receipt size={18} color={INK.soft} />
          </View>
          <Text style={{ marginTop: 10, fontSize: 13.5, color: "rgba(255,255,255,0.62)" }}>
            Nenhum lançamento nesta fatura
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 2 }}>
          {visible.map((line, i) => (
            <Animated.View key={line.id} entering={FadeInDown.delay(40 + i * 35).duration(260)}>
              <InvoiceLineRow line={line} onPress={() => onOpen(line)} />
            </Animated.View>
          ))}
        </View>
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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: pressed ? "rgba(255,255,255,0.045)" : "transparent",
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: chipFill(hex),
        }}
      >
        <Icon size={15} color={chipInk(hex)} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "500", color: "#fff" }}>
          {line.name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 11.5, color: INK.softer }}>
          {line.category}
          {line.installment ? ` · ${line.installment.current}/${line.installment.total}x` : ""}
        </Text>
      </View>

      <Text style={{ fontSize: 14, fontWeight: "600", color: isRefund ? GREEN : "#fff" }}>
        {isRefund ? "+" : "−"}
        {money(Math.abs(line.amount))}
      </Text>
    </Pressable>
  );
}
