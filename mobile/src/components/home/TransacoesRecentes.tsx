import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { categoryHex } from "@/lib/categoryData";
import { chipFill, chipInk } from "~/lib/chip";
import type { Transaction } from "@/types/finance";
import Surface from "~/components/Surface";
import { ChevronRight, CreditCard, Receipt, Wallet } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/** Three is enough to recognise the month; the rest is a different screen. */
const VISIBLE_COUNT = 3;

function statusLabel(tx: Transaction) {
  const isReceita = tx.type === "receita";
  if (tx.isFatura) return tx.status === "pago" ? "Fatura paga" : "Fatura";
  if (tx.status === "pago") return isReceita ? "Recebido" : "Pago";
  return isReceita ? "A receber" : "Pendente";
}

/** The last few movements, as a reminder rather than as a list. */
export default function TransacoesRecentes({ transactions }: { transactions: Transaction[] }) {
  const router = useRouter();
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

  const visible = transactions.slice(0, VISIBLE_COUNT);

  return (
    <Surface style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>Transações recentes</Text>
        {transactions.length > 0 && (
          <Text
            onPress={() => router.push("/transacoes")}
            style={{ fontSize: 13, color: INK.soft }}
          >
            Ver todas ›
          </Text>
        )}
      </View>

      {visible.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Receipt size={20} color={INK.soft} />
          </View>
          <Text style={{ marginTop: 12, fontSize: 14, color: INK.soft }}>
            Nenhuma transação neste mês
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 4 }}>
          {visible.map((tx, i) => (
            <Animated.View
              key={tx.id}
              entering={FadeInDown.delay(i * 40).duration(260)}
              style={{
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "rgba(255,255,255,0.06)",
              }}
            >
              <TxRow tx={tx} customCategories={customCats} />
            </Animated.View>
          ))}
        </View>
      )}
    </Surface>
  );
}

function TxRow({ tx, customCategories }: { tx: Transaction; customCategories: CustomCategory[] }) {
  const isReceita = tx.type === "receita";
  const isPending = tx.status !== "pago";
  const isInitialBalance = tx.category === "Saldo inicial";

  const Icon = tx.isFatura
    ? CreditCard
    : isInitialBalance
      ? Wallet
      : categoryIcon(tx.category, customCategories);
  const hex = tx.isFatura
    ? (tx.creditCardColor ?? "#A855F7")
    : isInitialBalance
      ? "#3B82F6"
      : categoryHex(tx.category, customCategories);
  const subtitle = tx.isFatura
    ? `${tx.faturaItemCount} lançamento${tx.faturaItemCount !== 1 ? "s" : ""}`
    : [tx.category, tx.date].filter(Boolean).join(" · ");

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: chipFill(hex),
        }}
      >
        <Icon size={18} color={chipInk(hex)} />
        {isPending && (
          <View
            style={{
              position: "absolute",
              right: -2,
              top: -2,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: AMBER,
              borderWidth: 2,
              borderColor: "#141414",
            }}
          />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={T.rowName}>
          {tx.name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 12, color: INK.soft, marginTop: 1 }}>
          {subtitle}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={[T.rowValue, isReceita && { color: GREEN }]}>
          {isReceita ? "+" : "−"}
          {money(tx.amount)}
        </Text>
        <Text style={{ fontSize: 11, color: isPending ? AMBER : INK.soft }}>
          {statusLabel(tx)}
        </Text>
      </View>
    </View>
  );
}
