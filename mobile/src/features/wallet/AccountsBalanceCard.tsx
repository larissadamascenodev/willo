import { Pressable, View } from "react-native";
import { Plus } from "lucide-react-native";
import { colorFor, initials } from "@/lib/banks";
import { useMoney } from "@/components/projecoes/shared";
import { Glass, Text, colors, white } from "~/ui";

export interface AccountBalanceItem {
  id: string;
  name: string;
  type: string;
  color: string | null;
  current_balance: number | string;
  is_default?: boolean | null;
}

export const TYPE_LABEL: Record<string, string> = { checking: "Conta corrente", savings: "Poupança", cash: "Dinheiro" };

/** O saldo total das contas, uma barra proporcional e uma linha por conta. */
export function AccountsBalanceCard({ accounts, onOpen, onAdd, savedTotal = 0 }: {
  accounts: AccountBalanceItem[];
  onOpen: (id: string) => void;
  onAdd: () => void;
  /** O que está guardado na reserva e nos cofrinhos, somado como patrimônio. */
  savedTotal?: number;
}) {
  const { fmt } = useMoney();
  const rows = accounts
    .map((acc) => ({ acc, balance: Number(acc.current_balance), hex: colorFor(acc.name, acc.color) }))
    .sort((a, b) => b.balance - a.balance);
  const total = rows.reduce((s, r) => s + r.balance, 0);
  const positiveTotal = rows.reduce((s, r) => s + Math.max(r.balance, 0), 0);

  return (
    <Glass radius={26} style={{ padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text size={15} color={white(0.66)}>Saldo em contas</Text>
        <Pressable onPress={onAdd} accessibilityLabel="Adicionar conta" style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: white(0.08), alignItems: "center", justifyContent: "center" }}>
          <Plus size={16} color="#fff" />
        </Pressable>
      </View>
      <Text weight="extrabold" size={34} tabular numberOfLines={1} color={total < 0 ? colors.red : "#fff"} style={{ marginTop: 4, letterSpacing: -0.8 }}>{fmt(total)}</Text>
      {savedTotal > 0 && (
        <Text size={13} color={white(0.62)} style={{ marginTop: 4 }}>
          Patrimônio <Text size={13} weight="semibold" tabular>{fmt(total + savedTotal)}</Text>
          <Text size={13} color={white(0.5)}> · {fmt(savedTotal)} guardados</Text>
        </Text>
      )}

      <View style={{ marginTop: 16, flexDirection: "row", height: 10, gap: 4, borderRadius: 5, overflow: "hidden", backgroundColor: white(0.06) }}>
        {positiveTotal > 0 && rows.filter((r) => r.balance > 0).map((r) => (
          <View key={r.acc.id} style={{ flexGrow: r.balance / positiveTotal, flexBasis: 0, backgroundColor: r.hex, borderRadius: 5 }} />
        ))}
      </View>

      <View style={{ marginTop: 8 }}>
        {rows.map(({ acc, balance, hex }) => {
          const pct = positiveTotal > 0 ? Math.round((Math.max(balance, 0) / positiveTotal) * 100) : 0;
          return (
            <Pressable key={acc.id} onPress={() => onOpen(acc.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: hex, alignItems: "center", justifyContent: "center" }}>
                <Text weight="bold" size={15}>{initials(acc.name)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="semibold" size={17} numberOfLines={1}>{acc.name}</Text>
                <Text size={13} color={white(0.62)}>{TYPE_LABEL[acc.type] ?? "Conta"}{acc.is_default ? " · Principal" : ""}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text size={16} tabular color={balance < 0 ? colors.red : "#fff"}>{fmt(balance)}</Text>
                <Text size={13} color={white(0.62)} tabular>{pct}%</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}
