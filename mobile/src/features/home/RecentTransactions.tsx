import { memo, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, CreditCard, Receipt, Wallet } from "lucide-react-native";
import { getCategoryHexColor, getCategoryIcon } from "@/lib/categoryUtils";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import type { Transaction } from "@/types/finance";
import { useMoney } from "@/components/projecoes/shared";
import { Surface, Text, colors, white } from "~/ui";
import { tint } from "~/lib/color";

const VISIBLE = 5;

function statusLabel(tx: Transaction) {
  const income = tx.type === "receita";
  if (tx.isFatura) return tx.status === "pago" ? "Fatura paga" : "Fatura";
  if (tx.status === "pago") return income ? "Recebido" : "Pago";
  return income ? "A receber" : "Pendente";
}

export function TransactionRow({ tx, customCategories }: { tx: Transaction; customCategories: CustomCategory[] }) {
  const { fmt } = useMoney();
  const income = tx.type === "receita";
  const pending = tx.status !== "pago";
  const initialBalance = tx.category === "Saldo inicial";

  const Icon: any = tx.isFatura ? CreditCard : initialBalance ? Wallet : getCategoryIcon(tx.category, customCategories);
  const hex = tx.isFatura ? tx.creditCardColor ?? "#A855F7" : initialBalance ? "#3B82F6" : getCategoryHexColor(tx.category, customCategories);
  const subtitle = tx.isFatura
    ? `${tx.faturaItemCount} lançamento${tx.faturaItemCount !== 1 ? "s" : ""}`
    : [tx.category, tx.date].filter(Boolean).join(" · ");

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.12) }}>
        <Icon size={18} color={hex} />
        {pending && <View style={{ position: "absolute", right: -2, top: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#141414", backgroundColor: colors.amber }} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="medium" size={15} numberOfLines={1}>{tx.name}</Text>
        <Text size={12} color={white(0.56)} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text weight="semibold" size={15} tabular color={income ? colors.green : colors.white}>
          {income ? "+" : "−"}{fmt(tx.amount)}
        </Text>
        <Text size={11} color={pending ? "rgba(252,211,77,0.9)" : white(0.5)}>{statusLabel(tx)}</Text>
      </View>
    </View>
  );
}

/** Os últimos lançamentos do mês, com atalho para a lista completa. */
export const RecentTransactions = memo(function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  const router = useRouter();
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  useEffect(() => {
    getCustomCategories().then(setCustomCategories).catch(() => {});
  }, []);

  const visible = transactions.slice(0, VISIBLE);

  return (
    <Surface style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text weight="semibold" size={16}>Transações recentes</Text>
        {transactions.length > 0 && (
          <Pressable onPress={() => router.push("/transacoes")} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", opacity: pressed ? 0.6 : 1 })}>
            <Text size={13} color={white(0.66)}>Ver todas</Text>
            <ChevronRight size={16} color={white(0.66)} />
          </Pressable>
        )}
      </View>

      {visible.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: white(0.06), alignItems: "center", justifyContent: "center" }}>
            <Receipt size={20} color={white(0.56)} />
          </View>
          <Text size={14} color={white(0.66)} style={{ marginTop: 12 }}>Nenhuma transação neste mês</Text>
        </View>
      ) : (
        <View style={{ marginTop: 4 }}>
          {visible.map((tx, i) => (
            <View key={tx.id} style={i > 0 ? { borderTopWidth: 1, borderTopColor: white(0.06) } : undefined}>
              <TransactionRow tx={tx} customCategories={customCategories} />
            </View>
          ))}
        </View>
      )}
    </Surface>
  );
});
