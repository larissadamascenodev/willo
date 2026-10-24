import { useRef, type ComponentRef } from "react";
import { Pressable, Text, View } from "react-native";
import { categoryHex } from "@/lib/categoryData";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import type { TransactionRow as Row } from "@/services/monthTransactions";
import type { CustomCategory } from "@/services/categoryService";
import { CreditCard, RefreshCw, Wallet } from "~/components/icons";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * One movement, written on the page.
 *
 * No card around it and no ground under it — it reads as type on the page rather
 * than as an object, which is what the web list was rebuilt into. The disc takes the
 * colour the rest of the app gives this thing: the category's own, the card's own,
 * blue for an opening balance, so a row here and a row inside an invoice are
 * recognisably the same kind of object.
 */

const hexFor = (color: string | null | undefined, fallback: string) =>
  color && /^#?[0-9a-f]{6}$/i.test(color) ? (color.startsWith("#") ? color : `#${color}`) : fallback;

export default function TransactionRow({
  tx,
  accountName,
  customCategories,
  creditCards,
  onPress,
  onHold,
}: {
  tx: Row;
  accountName?: string;
  customCategories?: CustomCategory[];
  creditCards?: any[];
  onPress?: () => void;
  onHold?: (rect: { top: number; bottom: number; left: number; width: number }) => void;
}) {
  const box = useRef<ComponentRef<typeof View>>(null);

  const isReceita = tx.type === "receita";
  const isFatura = tx.id.startsWith("fatura-");
  const isInitialBalance = tx.id.startsWith("initial-balance-");

  const Icon = isFatura ? CreditCard : isInitialBalance ? Wallet : categoryIcon(tx.category, customCategories);

  const discHex = isFatura
    ? hexFor(creditCards?.find((c: any) => c.id === tx.credit_card_id)?.color, "#A855F7")
    : isInitialBalance
      ? "#3B82F6"
      : categoryHex(tx.category, customCategories);

  const isRecurring = tx.recurrence_type === "fixa" || !!(tx.installments && tx.installments > 1);
  const isPending = tx.status !== "pago";

  const under = [
    tx.category,
    tx.installments && tx.installment_current ? `${tx.installment_current}/${tx.installments}x` : null,
    accountName || null,
    tx.time || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      ref={box}
      onPress={onPress}
      onLongPress={() => {
        box.current?.measureInWindow((x, y, width, height) =>
          onHold?.({ top: y, bottom: y + height, left: x, width }),
        );
      }}
      delayLongPress={420}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 4,
        paddingVertical: 14,
        borderRadius: 18,
        backgroundColor: pressed ? "#0A0B0D" : "transparent",
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: chipFill(discHex),
        }}
      >
        <Icon size={18} color={chipInk(discHex)} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text numberOfLines={1} style={[T.rowName, { flexShrink: 1 }]}>
            {tx.name}
          </Text>
          {isRecurring && <RefreshCw size={12} color={INK.faint} />}
        </View>
        <Text numberOfLines={1} style={[T.rowNote, { marginTop: 2, fontSize: 12 }]}>
          {under}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={[T.rowValue, isReceita && { color: GREEN }]}>
          {isReceita ? "+" : "−"}
          {money(tx.amount)}
        </Text>
        <Text style={{ marginTop: 2, fontSize: 11.5, color: isPending ? AMBER : INK.softer }}>
          {isPending
            ? isReceita
              ? "A receber"
              : "Pendente"
            : isReceita
              ? "Recebido"
              : "Pago"}
        </Text>
      </View>
    </Pressable>
  );
}

