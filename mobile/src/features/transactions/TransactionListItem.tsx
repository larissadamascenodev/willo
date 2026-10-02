import { useRef } from "react";
import { Pressable, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { CreditCard, Pencil, RefreshCw, Trash2, Wallet } from "lucide-react-native";
import { getCategoryColor, getCategoryIcon } from "@/lib/categoryUtils";
import type { CustomCategory } from "@/services/categoryService";
import type { TransactionRow } from "@/services/monthTransactions";
import { useMoney } from "@/components/projecoes/shared";
import { Text, colors, white } from "~/ui";
import { hsl } from "~/lib/color";

/** "#8B5CF6" → "260 90% 66%", o formato HSL que o resto do app usa para cores de categoria. */
function hexToHslTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

interface Props {
  tx: TransactionRow;
  accountName: string;
  customCategories?: CustomCategory[];
  creditCards?: any[];
  onPress: (tx: TransactionRow) => void;
  onEdit: (tx: TransactionRow) => void;
  onDelete: (id: string) => void;
}

/** Uma transação da lista. Deslize para a direita para editar e para a esquerda para apagar. */
export function TransactionListItem({ tx, accountName, customCategories, creditCards, onPress, onEdit, onDelete }: Props) {
  const { fmt } = useMoney();
  const swipe = useRef<SwipeableMethods>(null);
  const income = tx.type === "receita";
  const pending = tx.status !== "pago";
  const isFatura = tx.id.startsWith("fatura-");
  const isInitialBalance = tx.id.startsWith("initial-balance-");

  let Icon: any = getCategoryIcon(tx.category, customCategories);
  let triplet = getCategoryColor(tx.category, customCategories);
  if (isFatura) {
    Icon = CreditCard;
    const card = creditCards?.find((c: any) => c.id === tx.credit_card_id);
    triplet = card?.color ? hexToHslTriplet(card.color) : "260 70% 60%";
  } else if (isInitialBalance) {
    Icon = Wallet;
    triplet = "210 80% 55%";
  }
  const recurring = tx.recurrence_type === "fixa" || (tx.installments && tx.installments > 1);

  const subtitle =
    tx.category +
    (tx.installments && tx.installment_current ? ` · ${tx.installment_current}/${tx.installments}x` : "") +
    (accountName ? ` · ${accountName}` : "") +
    (tx.time ? ` · ${tx.time}` : "");

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={72}
      rightThreshold={72}
      renderLeftActions={() => (
        <View style={{ width: 90, backgroundColor: white(0.12), alignItems: "flex-start", justifyContent: "center", paddingLeft: 20 }}>
          <Pencil size={18} color="#fff" />
        </View>
      )}
      renderRightActions={() => (
        <View style={{ width: 90, backgroundColor: "rgba(239,68,68,0.25)", alignItems: "flex-end", justifyContent: "center", paddingRight: 20 }}>
          <Trash2 size={18} color={colors.red} />
        </View>
      )}
      onSwipeableOpen={(direction) => {
        swipe.current?.close();
        if (direction === "left") onEdit(tx);
        else onDelete(tx.id);
      }}
    >
      <Pressable onPress={() => onPress(tx)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? white(0.04) : "transparent" })}>
        <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: hsl(triplet, 0.12) }}>
          <Icon size={18} color={hsl(triplet)} />
          {pending && <View style={{ position: "absolute", right: -2, top: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#141414", backgroundColor: colors.amber }} />}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text weight="medium" size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{tx.name}</Text>
            {recurring && <RefreshCw size={12} color={white(0.45)} />}
          </View>
          <Text size={12} color={white(0.56)} numberOfLines={1}>{subtitle}</Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text weight="semibold" size={15} tabular color={income ? colors.green : "#fff"}>{income ? "+" : "−"}{fmt(tx.amount)}</Text>
          <Text size={11} color={pending ? "rgba(252,211,77,0.9)" : white(0.5)}>
            {pending ? (income ? "A receber" : "Pendente") : income ? "Recebido" : "Pago"}
          </Text>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}
