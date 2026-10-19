import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { ChevronRight } from "~/components/icons";
import { getAccounts } from "@/services/transactionService";
import { colorFor, initials } from "@/lib/banks";
import { useRouter } from "expo-router";
import Surface from "~/components/Surface";
import { money } from "~/lib/money";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Where the money actually sits.
 *
 * Carried over line for line from the web card, because the reading is the thing
 * being kept: the total alone says nothing about whether it is reachable, so the bar
 * splits it by account at a glance and the rows name each one. Four accounts holding
 * a quarter each look nothing like one account holding everything.
 *
 * The service it calls is the web app's own — same query, same cache, same colours.
 */

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  color: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  investment: "Investimento",
};

export default function SaldoContasCard({ saldoPrevisto }: { saldoPrevisto?: number }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getAccounts()
        .then((a) => alive && setAccounts(a as unknown as Account[]))
        .catch(() => alive && setAccounts([]));
    load();
    /* The same event the web app fires when anything financial changes — it exists
       here because the shim gave the shared services somewhere to fire it. */
    const onChange = () => load();
    window.addEventListener("finance-data-changed", onChange);
    window.addEventListener("transaction-created", onChange);
    return () => {
      alive = false;
      window.removeEventListener("finance-data-changed", onChange);
      window.removeEventListener("transaction-created", onChange);
    };
  }, []);

  const rows = useMemo(() => {
    if (!accounts) return [];
    return [...accounts]
      .map((a) => ({
        ...a,
        balance: Number(a.current_balance) || 0,
        hex: colorFor(a.name, a.color),
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [accounts]);

  if (!accounts) return <Surface style={{ height: 196 }}><View /></Surface>;
  if (accounts.length === 0) return null;

  const total = rows.reduce((s, a) => s + a.balance, 0);
  const positive = rows.reduce((s, a) => s + Math.max(a.balance, 0), 0);

  return (
    <Surface onPress={() => router.push("/gestao")} style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={T.cardLabel}>Saldo em contas</Text>
        <ChevronRight size={16} color={INK.faint} />
      </View>

      <Text numberOfLines={1} style={[T.figure, { marginTop: 4 }, total < 0 && { color: RED }]}>
        {money(total)}
      </Text>

      {/* What is in hand, then where it lands: the same card answers "quanto tenho"
          and "quanto sobra", which is the pair the question is actually about. */}
      {saldoPrevisto !== undefined && (
        <Text numberOfLines={1} style={[T.note, { marginTop: 8, fontSize: 13 }]}>
          Previsto no fim do mês:{" "}
          <Text style={{ fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
            {money(saldoPrevisto)}
          </Text>
        </Text>
      )}

      {/* One bar split by account: the share each one holds, in its own brand colour. */}
      <View style={{ flexDirection: "row", gap: 3, height: 7, marginTop: 14 }}>
        {positive > 0 ? (
          rows
            .filter((a) => a.balance > 0)
            .map((a) => (
              <View
                key={a.id}
                style={{
                  flexGrow: a.balance / positive,
                  flexBasis: 0,
                  borderRadius: 999,
                  backgroundColor: a.hex,
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
        {rows.map((a) => (
          <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: a.hex,
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#fff" }}>
                {initials(a.name)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[T.rowName, { fontSize: 14 }]}>
                {a.name}
              </Text>
              <Text numberOfLines={1} style={T.rowNote}>
                {TYPE_LABEL[a.type] ?? "Conta"}
              </Text>
            </View>
            <Text style={[T.rowValue, { fontSize: 14 }, a.balance < 0 && { color: RED }]}>
              {money(a.balance)}
            </Text>
          </View>
        ))}
      </View>
    </Surface>
  );
}
