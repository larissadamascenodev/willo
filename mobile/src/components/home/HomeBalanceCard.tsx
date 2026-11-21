import { useEffect, useMemo, useState } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { getAccounts } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import BankMark from "~/components/BankMark";
import Surface from "~/components/Surface";
import { FlexBar } from "~/components/Bar";
import { ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { cachedAccounts, rememberAccounts } from "~/lib/warmHome";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th } from "~/theme/theme";

/**
 * Saldo em contas, as the app has always drawn it, made compact: the name with the banks'
 * marks one over the next in the corner, the total in the accounts, where the month should
 * end, and one bar split by account in each bank's colour. A touch opens the accounts. The
 * month's in and out sit under it as two rings of their own (FlowRings).
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
/* Four marks fit the corner; the rest are counted. */
const MAX_BUBBLES = 4;
const BUBBLE = 24;

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  color: string | null;
}

export default function HomeBalanceCard({ saldoPrevisto, hidden }: { saldoPrevisto: number; hidden?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.id ?? null;
  /* The last accounts kept on the phone first, refreshed under them. */
  const [accounts, setAccounts] = useState<Account[] | null>(() => cachedAccounts(uid));

  useEffect(() => {
    let alive = true;
    const load = () =>
      getAccounts()
        .then((a) => {
          if (!alive) return;
          setAccounts(a as unknown as Account[]);
          if (uid) rememberAccounts(uid, a as unknown as Account[]);
        })
        .catch(() => alive && setAccounts((had) => had ?? []));
    load();
    const onChange = () => load();
    window.addEventListener("finance-data-changed", onChange);
    window.addEventListener("transaction-created", onChange);
    return () => {
      alive = false;
      window.removeEventListener("finance-data-changed", onChange);
      window.removeEventListener("transaction-created", onChange);
    };
  }, [uid]);

  const rows = useMemo(
    () =>
      [...(accounts ?? [])]
        .map((a) => ({ ...a, balance: Number(a.current_balance) || 0, hex: colorFor(a.name, a.color) }))
        .sort((a, b) => b.balance - a.balance),
    [accounts],
  );
  const total = rows.reduce((s, a) => s + a.balance, 0);
  const positive = rows.reduce((s, a) => s + Math.max(a.balance, 0), 0);
  const show = (v: number) => (hidden ? "R$ ••••" : money(v));

  return (
    <Surface onPress={() => router.push("/gestao" as never)} style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
      {/* The name, and in the corner the banks' marks one over the next. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={T.cardLabel}>Saldo em contas</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {rows.slice(0, MAX_BUBBLES).map((a, i) => (
              <View
                key={a.id}
                style={{
                  marginLeft: i === 0 ? 0 : -8,
                  width: BUBBLE + 4,
                  height: BUBBLE + 4,
                  borderRadius: (BUBBLE + 4) / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: th("#101113", "bg"),
                  zIndex: MAX_BUBBLES - i,
                }}
              >
                <View style={{ width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2, overflow: "hidden" }}>
                  <BankMark name={a.name} hex={a.hex} size={BUBBLE} />
                </View>
              </View>
            ))}
            {rows.length > MAX_BUBBLES && (
              <View style={{ marginLeft: -8, width: BUBBLE + 4, height: BUBBLE + 4, borderRadius: (BUBBLE + 4) / 2, alignItems: "center", justifyContent: "center", backgroundColor: th("#101113", "bg") }}>
                <View style={{ width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.12)", "bg") }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: th("#fff") }}>+{rows.length - MAX_BUBBLES}</Text>
                </View>
              </View>
            )}
          </View>
          <ChevronRight size={16} color={th(INK.faint)} />
        </View>
      </View>

      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[T.figure, { marginTop: 4, opacity: accounts ? 1 : 0.4 }, total < 0 && { color: th(RED) }]}>
        {show(total)}
      </Text>

      {/* What is in hand, then where it lands. */}
      <Text numberOfLines={1} style={[T.note, nums, { marginTop: 6, fontSize: 13 }]}>
        {accounts && rows.length === 0 ? (
          "Nenhuma conta ainda. Toque para adicionar a primeira."
        ) : (
          <>
            Previsto no final do mês: <Text style={{ fontWeight: "600", color: th(saldoPrevisto < 0 ? RED : "rgba(255,255,255,0.8)") }}>{show(saldoPrevisto)}</Text>
          </>
        )}
      </Text>

      {/* One bar split by account: the share each one holds, in its own brand colour. */}
      <View style={{ flexDirection: "row", gap: 3, height: 7, marginTop: 14 }}>
        {positive > 0 ? (
          rows.filter((a) => a.balance > 0).map((a, i) => <FlexBar key={a.id} share={a.balance / positive} color={a.hex} delay={0.04 * i} />)
        ) : (
          <View style={{ flex: 1, borderRadius: 999, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }} />
        )}
      </View>
    </Surface>
  );
}
