import { memo, useMemo } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import { ChevronRight, CreditCard, Plus } from "lucide-react-native";
import { useCardsOverview, cardHex, invoiceDueDate } from "@/hooks/useCardsOverview";
import { useMoney } from "@/components/projecoes/shared";
import { Glass, Text, white } from "~/ui";

function dueText(date: Date, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  if (days < 0) return `Venceu em ${label}`;
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias · ${label}`;
}

const R = 30;
const C = 2 * Math.PI * R;

/** Cartões no início: fatura atual, limite livre e cada cartão; abre a tela de cartões. */
export const CardsOverviewCard = memo(function CardsOverviewCard() {
  const router = useRouter();
  const { fmt } = useMoney();
  const { cards, invoices, loading } = useCardsOverview();
  const today = useMemo(() => new Date(), []);

  const summary = useMemo(() => {
    const limit = cards.reduce((s, c) => s + c.limit, 0);
    const used = cards.reduce((s, c) => s + c.used, 0);
    // a fatura que está recebendo compras agora: passado o fechamento, a aberta já é a do mês seguinte
    const current = cards.map((card) => {
      const rolls = today.getDate() > card.closingDay ? 1 : 0;
      const index = today.getFullYear() * 12 + today.getMonth() + rolls;
      const month = (index % 12) + 1;
      const year = Math.floor(index / 12);
      const invoice = invoices.find((i) => i.cardId === card.id && i.month === month && i.year === year);
      return { card, invoice, due: invoiceDueDate(card, year, month) };
    });
    const invoiceTotal = current.reduce((s, c) => s + (c.invoice?.total ?? 0), 0);
    const pending = current.filter((c) => c.invoice && !c.invoice.isPaid && c.invoice.total > 0);
    const nextDue = pending.map((c) => c.due).sort((a, b) => a.getTime() - b.getTime())[0];
    return { limit, used, available: Math.max(limit - used, 0), current, invoiceTotal, nextDue, allPaid: pending.length === 0 };
  }, [cards, invoices, today]);

  if (loading) return <View style={{ height: 168, borderRadius: 22, backgroundColor: white(0.06) }} />;

  if (cards.length === 0) {
    return (
      <Pressable onPress={() => router.push({ pathname: "/cartoes", params: { novo: "1" } })} style={{ flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 22, borderWidth: 1, borderStyle: "dashed", borderColor: white(0.12), padding: 16 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: white(0.06) }}><CreditCard size={20} color={white(0.82)} /></View>
        <View style={{ flex: 1 }}>
          <Text weight="semibold" size={15}>Adicione um cartão de crédito</Text>
          <Text size={12} color={white(0.62)}>Acompanhe limite, faturas e parcelas</Text>
        </View>
        <Plus size={20} color={white(0.66)} />
      </Pressable>
    );
  }

  const usedPct = summary.limit > 0 ? Math.min(summary.used / summary.limit, 1) : 0;

  return (
    <Pressable onPress={() => router.push({ pathname: "/cartoes", params: { aba: "faturas" } })}>
      <Glass radius={22} style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text size={14} color={white(0.66)}>Cartões de crédito</Text>
          <ChevronRight size={16} color={white(0.45)} />
        </View>

        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={11} color={white(0.62)}>Fatura atual</Text>
            <Text weight="extrabold" size={22} tabular numberOfLines={1} style={{ letterSpacing: -0.4 }}>{fmt(summary.invoiceTotal)}</Text>
            <Text size={11} color={summary.allPaid ? white(0.56) : "rgba(252,211,77,0.9)"} numberOfLines={1}>
              {summary.invoiceTotal === 0 ? "Sem fatura este mês" : summary.allPaid ? "Tudo pago" : summary.nextDue ? dueText(summary.nextDue, today) : ""}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderLeftWidth: 1, borderLeftColor: white(0.12), paddingLeft: 12 }}>
            <View style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
              <Svg viewBox="0 0 76 76" width={52} height={52} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
                <Circle cx={38} cy={38} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={9} />
                <Circle cx={38} cy={38} r={R} fill="none" stroke="#fff" strokeWidth={9} strokeLinecap="round" strokeDasharray={`${(1 - usedPct) * C} ${C}`} />
              </Svg>
              <Text size={11} weight="bold" tabular>{Math.round((1 - usedPct) * 100)}%</Text>
            </View>
            <View>
              <Text size={11} color={white(0.62)}>Limite livre</Text>
              <Text size={14} weight="bold" tabular>{fmt(summary.available)}</Text>
              <Text size={10} color={white(0.5)} tabular>de {fmt(summary.limit)}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 16, gap: 10, borderTopWidth: 1, borderTopColor: white(0.06), paddingTop: 14 }}>
          {summary.current.map(({ card, invoice, due }) => (
            <View key={card.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cardHex(card.color) }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size={14} numberOfLines={1}>{card.name}</Text>
                <Text size={11} color={white(0.56)} tabular numberOfLines={1}>{invoice?.isPaid ? "Fatura paga" : `Vence ${due.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`} · {fmt(Math.max(card.limit - card.used, 0))} livre</Text>
              </View>
              <Text size={14} tabular color={invoice?.isPaid ? white(0.56) : "#fff"} style={invoice?.isPaid ? { textDecorationLine: "line-through" } : undefined}>{fmt(invoice?.total ?? 0)}</Text>
            </View>
          ))}
        </View>
      </Glass>
    </Pressable>
  );
});
