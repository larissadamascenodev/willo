import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { CalendarClock, ChevronRight, CreditCard } from "lucide-react-native";
import { getInvoiceStatusLabel, type CreditCardItem, type OpenInvoiceInfo } from "@/lib/cardInvoice";
import { cardHex } from "@/hooks/useCardsOverview";
import { useMoney } from "@/components/projecoes/shared";
import { Glass, ProgressBar, Text, colors, white } from "~/ui";
import { tint } from "~/lib/color";

/** Um cartão: nome, fatura em aberto e a barra do limite com os dois lados. Abre a fatura. */
export function CreditCardTile({ card, invoiceInfo }: { card: CreditCardItem; invoiceInfo?: OpenInvoiceInfo }) {
  const router = useRouter();
  const { fmt } = useMoney();
  const used = Number(card.used_limit);
  const limit = Number(card.limit);
  const usedPct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const available = Math.max(limit - used, 0);
  const status = getInvoiceStatusLabel(card, invoiceInfo);
  const amount = invoiceInfo?.amount || 0;
  const hex = cardHex(card.color);
  const bar = usedPct >= 100 ? colors.red : usedPct >= 80 ? colors.amber : "#fff";

  return (
    <Pressable onPress={() => router.push({ pathname: "/fatura/[cardId]", params: { cardId: card.id } })} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Glass radius={22} style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.15) }}>
            <CreditCard size={16} color={hex} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight="semibold" size={15} numberOfLines={1}>{card.name}</Text>
            {!!card.last_four_digits && <Text size={12} color={white(0.56)} tabular>•••• {card.last_four_digits}</Text>}
          </View>
          <ChevronRight size={16} color={white(0.38)} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <View>
            <Text size={12} color={white(0.62)} style={{ marginBottom: 6 }}>Fatura em aberto</Text>
            <Text weight="extrabold" size={24} tabular color={amount > 0 ? "#fff" : white(0.45)} style={{ letterSpacing: -0.5 }}>{fmt(amount)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text size={12} color={white(0.62)} style={{ marginBottom: 6 }}>Disponível</Text>
            <Text weight="bold" size={14} tabular color={available > 0 ? colors.green : colors.red}>{fmt(available)}</Text>
          </View>
        </View>

        <ProgressBar ratio={usedPct / 100} color={bar} height={6} track={white(0.08)} />
        <View style={{ marginTop: 4, flexDirection: "row", justifyContent: "space-between" }}>
          <Text size={11} color={white(0.56)} tabular>{fmt(used)} / {fmt(limit)}</Text>
          <Text size={11} weight="semibold" color={white(0.66)} tabular>{usedPct.toFixed(0)}%</Text>
        </View>

        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: white(0.06), paddingTop: 10 }}>
          <CalendarClock size={14} color={white(0.5)} />
          <Text size={12} tabular weight={status.isClosed ? "semibold" : "regular"} color={status.isClosed ? "#FCD34D" : white(0.66)}>{status.label}</Text>
        </View>
      </Glass>
    </Pressable>
  );
}
