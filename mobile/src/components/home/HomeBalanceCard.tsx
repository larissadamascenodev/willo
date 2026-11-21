import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { getAccounts } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import Surface from "~/components/Surface";
import { FlexBar } from "~/components/Bar";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Target } from "~/components/icons";
import { amount, money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { cachedAccounts, rememberAccounts } from "~/lib/warmHome";
import { GREEN, INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * Saldo em contas, on the home — the card as the app has always drawn it, read anew.
 *
 * The total in the accounts, large, its centavos a step down. Under it one bar split by
 * account, each in its own bank's colour, so four accounts holding a quarter each look
 * nothing like one holding everything; and the accounts by name with what each holds. Then
 * the month in three lines, one under the other: what came in, what went out, and where it
 * should end.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
/* Four accounts fit two lines of the legend; the rest are counted. */
const NAMED = 4;

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  color: string | null;
}

type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export default function HomeBalanceCard({
  receitas,
  despesas,
  saldoPrevisto,
  hidden,
}: {
  receitas: number;
  despesas: number;
  saldoPrevisto: number;
  hidden?: boolean;
}) {
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
  const [whole, cents] = amount(Math.abs(total)).split(",");
  const symbol = money(0).replace(/[\d.,\s\u00a0-]/g, "") || "R$";
  const short = total < -0.004;
  const show = (v: number) => (hidden ? "R$ •••" : money(v));

  return (
    <Surface onPress={() => router.push("/gestao" as never)} radius={26} style={{ paddingHorizontal: 16, paddingTop: 15, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 1.4, color: th(INK.softer) }}>SALDO EM CONTAS</Text>
        <ChevronRight size={17} color={th(INK.faint)} />
      </View>

      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 8, color: th(short ? RED : "#fff"), opacity: accounts ? 1 : 0.4 }]}>
        {hidden ? (
          <Text style={{ fontSize: 40, fontWeight: "800", letterSpacing: -1.4 }}>R$ ••••••</Text>
        ) : (
          <>
            <Text style={{ fontSize: 22, fontWeight: "600", color: th(short ? RED : INK.soft) }}>{`${short ? "−" : ""}${symbol} `}</Text>
            <Text style={{ fontSize: 44, fontWeight: "800", letterSpacing: -1.6 }}>{whole}</Text>
            <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.5 }}>{`,${cents ?? "00"}`}</Text>
          </>
        )}
      </Text>

      {/* One bar split by account: the share each one holds, in its own bank's colour. */}
      <View style={{ flexDirection: "row", gap: 3, height: 8, marginTop: 16 }}>
        {positive > 0 ? (
          rows.filter((a) => a.balance > 0).map((a, i) => <FlexBar key={a.id} share={a.balance / positive} color={a.hex} delay={0.04 * i} />)
        ) : (
          <View style={{ flex: 1, borderRadius: 999, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }} />
        )}
      </View>

      {/* The accounts by name, two to a line: the name in its colour's dot, what it holds under it. */}
      {rows.length > 0 && (
        <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
          {rows.slice(0, rows.length > NAMED ? NAMED - 1 : NAMED).map((a) => (
            <View key={a.id} style={{ width: "50%", paddingRight: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th(a.hex, "bg") }} />
                <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, fontWeight: "500", color: th(INK.soft) }}>
                  {a.name}
                </Text>
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[nums, { marginTop: 3, marginLeft: 15, fontSize: 15, fontWeight: "700", color: th(a.balance < 0 ? RED : "#fff") }]}>
                {hidden ? "R$ •••" : money(a.balance)}
              </Text>
            </View>
          ))}
          {rows.length > NAMED && (
            <View style={{ width: "50%" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th("rgba(255,255,255,0.3)", "bg") }} />
                <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: "500", color: th(INK.soft) }}>{`Mais ${rows.length - (NAMED - 1)} contas`}</Text>
              </View>
              <Text numberOfLines={1} style={[nums, { marginTop: 3, marginLeft: 15, fontSize: 15, fontWeight: "700", color: th("#fff") }]}>
                {hidden ? "R$ •••" : money(rows.slice(NAMED - 1).reduce((t, a) => t + a.balance, 0))}
              </Text>
            </View>
          )}
        </View>
      )}
      {accounts && rows.length === 0 && (
        <Text style={{ marginTop: 12, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>Nenhuma conta ainda. Toque para adicionar a primeira.</Text>
      )}

      {/* The month, one line each. */}
      <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.07)", "line") }}>
        <Line Icon={ArrowDownLeft} tone={GREEN} label="Entrada" value={show(receitas)} />
        <Line Icon={ArrowUpRight} tone={RED} label="Saída" value={hidden ? "R$ •••" : `−${money(despesas)}`} />
        <Line Icon={Target} tone="#A78BFA" label="Fim do mês" value={show(saldoPrevisto)} valueTone={saldoPrevisto < 0 ? RED : undefined} last />
      </View>
    </Surface>
  );
}

function Line({ Icon, tone, label, value, valueTone, last }: { Icon: Icon; tone: string; label: string; value: string; valueTone?: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 11,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: th("rgba(255,255,255,0.05)", "line"),
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: th(`${tone}24`, "bg"),
          shadowColor: tone,
          shadowOpacity: 0.4,
          shadowRadius: 7,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <Icon size={15} color={th(tone)} strokeWidth={2.4} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: "500", color: th(INK.soft) }}>{label}</Text>
      <Text numberOfLines={1} style={[nums, { fontSize: 15.5, fontWeight: "700", color: th(valueTone ?? "#fff") }]}>
        {value}
      </Text>
    </View>
  );
}
