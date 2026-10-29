import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { ChevronRight } from "~/components/icons";
import { getAccounts } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import { fetchGoals } from "@/services/goalService";
import BankMark from "~/components/BankMark";
import { useRouter } from "expo-router";
import Surface from "~/components/Surface";
import { FlexBar } from "~/components/Bar";
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

/* Five marks fit a line of the card; the rest are counted. */
const MAX_BUBBLES = 5;
const BUBBLE = 36;

export default function SaldoContasCard({ saldoPrevisto }: { saldoPrevisto?: number }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  /* What is in cofrinhos has left the balance but not the person's hands. */
  const [guardado, setGuardado] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getAccounts()
        .then((a) => alive && setAccounts(a as unknown as Account[]))
        .catch(() => alive && setAccounts([]));
    load();
    const loadGoals = () =>
      fetchGoals()
        .then((g) => alive && setGuardado(g.reduce((sum, x) => sum + (Number(x.current_amount) || 0), 0)))
        .catch(() => alive && setGuardado(0));
    loadGoals();
    /* The same event the web app fires when anything financial changes — it exists
       here because the shim gave the shared services somewhere to fire it. */
    const onChange = () => {
      load();
      loadGoals();
    };
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
      {guardado > 0 && (
        <Text numberOfLines={1} style={[T.note, { marginTop: 8, fontSize: 13 }]}>
          Patrimônio total:{" "}
          <Text style={{ fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>{money(total + guardado)}</Text>
        </Text>
      )}
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
            .map((a, i) => (
              <FlexBar key={a.id} share={a.balance / positive} color={a.hex} delay={0.04 * i} />
            ))
        ) : (
          <View style={{ flex: 1, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" }} />
        )}
      </View>

      {/* However many accounts there are, they take the room of one line: the marks sit
          one over the next, and the count says how many that is. */}
      <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {rows.slice(0, MAX_BUBBLES).map((a, i) => (
            <View
              key={a.id}
              style={{
                marginLeft: i === 0 ? 0 : -12,
                width: BUBBLE + 4,
                height: BUBBLE + 4,
                borderRadius: (BUBBLE + 4) / 2,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#101113",
                zIndex: MAX_BUBBLES - i,
              }}
            >
              <View style={{ width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2, overflow: "hidden" }}>
                <BankMark name={a.name} hex={a.hex} size={BUBBLE} />
              </View>
            </View>
          ))}
          {rows.length > MAX_BUBBLES && (
            <View
              style={{
                marginLeft: -12,
                width: BUBBLE + 4,
                height: BUBBLE + 4,
                borderRadius: (BUBBLE + 4) / 2,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#101113",
              }}
            >
              <View style={{ width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>+{rows.length - MAX_BUBBLES}</Text>
              </View>
            </View>
          )}
        </View>
        <Text style={T.rowNote}>
          {rows.length} {rows.length === 1 ? "conta" : "contas"}
        </Text>
      </View>
    </Surface>
  );
}
