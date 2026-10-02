import { useState } from "react";
import { Pressable, View } from "react-native";
import { AlertTriangle, Check, ChevronDown, Wallet } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { getCategoryColor, getCategoryIcon } from "@/lib/categoryUtils";
import { cardHex } from "@/hooks/useCardsOverview";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import type { CustomCategory } from "@/services/categoryService";
import { useMoney } from "@/components/projecoes/shared";
import { Glass, Text, colors, white } from "~/ui";
import { hsl } from "~/lib/color";

const PREVIEW = 4;
const RING = 2 * Math.PI * 22;

const monthLabel = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "").replace(" de ", "/");

/** Uma compra parcelada: trilho de parcelas, números-chave e o cronograma que abre. */
export function InstallmentPurchaseCard({ item, customCats, card, onOpen }: {
  item: ActiveInstallmentItem;
  customCats: CustomCategory[];
  card?: { name: string; color: string | null };
  onOpen?: () => void;
}) {
  const { fmt } = useMoney();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const paid = item.installment_current - 1;
  const remaining = item.installments - paid;
  const total = item.amount * item.installments;
  const Icon = getCategoryIcon(item.category, customCats);
  const col = hsl(getCategoryColor(item.category, customCats));
  const isCard = item.payment_method === "cartao";
  const start = new Date(`${item.date.slice(0, 10)}T12:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + (item.installments - 1));
  const next = item.dueDate ? new Date(`${item.dueDate.slice(0, 10)}T12:00:00`) : null;
  const dense = item.installments > 24;
  const current = item.isOverdue ? colors.red : colors.green;

  const schedule = Array.from({ length: item.installments }, (_, n) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + n);
    return { n: n + 1, date: d, status: n < paid ? "paga" : n === paid ? "atual" : "futura" } as const;
  });

  return (
    <Glass radius={20} style={item.isOverdue ? { borderColor: "rgba(248,113,113,0.3)" } : undefined}>
      <Pressable onPress={() => (onOpen ? onOpen() : setOpen((v) => !v))} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
            <Svg viewBox="0 0 48 48" width={48} height={48} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
              <Circle cx={24} cy={24} r={22} fill="none" stroke={white(0.08)} strokeWidth={2.5} />
              <Circle cx={24} cy={24} r={22} fill="none" stroke={col} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={`${Math.max(item.installment_current / item.installments, 0.04) * RING} ${RING}`} />
            </Svg>
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: white(0.06) }}>
              <Icon size={18} color={col} />
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight="semibold" size={15} numberOfLines={1}>{item.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {item.isOverdue ? <AlertTriangle size={12} color={colors.red} /> : isCard ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cardHex(card?.color ?? null) }} /> : <Wallet size={12} color={white(0.62)} />}
              <Text size={12} color={item.isOverdue ? colors.red : white(0.62)} numberOfLines={1}>{item.isOverdue ? "Em atraso · " : ""}{isCard ? card?.name ?? "Cartão" : "Conta"}</Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text weight="bold" size={15} tabular>{fmt(item.amount)}</Text>
            <Text size={11} color={white(0.56)} tabular>de {fmt(total)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text size={12} color={white(0.7)}>Parcela <Text size={12} weight="semibold">{item.installment_current}</Text> de {item.installments}</Text>
          <Text size={11} color={white(0.56)}>{remaining} {remaining === 1 ? "restante" : "restantes"}</Text>
        </View>
        {dense ? (
          <View style={{ marginTop: 6, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: white(0.08) }}>
            <View style={{ height: 6, width: `${(paid / item.installments) * 100}%`, backgroundColor: "#fff" }} />
          </View>
        ) : (
          <View style={{ marginTop: 6, flexDirection: "row", gap: 3 }}>
            {schedule.map((s) => <View key={s.n} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: s.status === "paga" ? "#fff" : s.status === "atual" ? current : white(0.1) }} />)}
          </View>
        )}

        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text size={11} color={white(0.62)} tabular style={{ flex: 1 }} numberOfLines={1}>
            Falta {fmt(item.amount * remaining)} · {next ? `próxima ${next.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : `até ${monthLabel(end)}`}
          </Text>
          <Pressable onPress={() => setOpen((v) => !v)} hitSlop={10} accessibilityLabel={open ? "Recolher parcelas" : "Ver parcelas"}>
            <ChevronDown size={16} color={white(0.56)} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
          </Pressable>
        </View>
      </Pressable>

      {open && (
        <View style={{ borderTopWidth: 1, borderTopColor: white(0.06), paddingHorizontal: 14, paddingBottom: 12, paddingTop: 10 }}>
          {(showAll ? schedule : schedule.slice(paid, paid + PREVIEW)).map((s) => {
            const isPaid = s.status === "paga";
            const isCur = s.status === "atual";
            const month = s.date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
            return (
              <View key={s.n} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingRight: 8, borderRadius: 14, backgroundColor: isCur ? white(0.05) : "transparent" }}>
                <View style={{ width: 19, height: 19, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: isPaid ? "#fff" : isCur ? current : "transparent", borderWidth: isPaid || isCur ? 0 : 1, borderColor: white(0.2) }}>
                  {isPaid && <Check size={12} color={colors.black} strokeWidth={3} />}
                </View>
                <Text size={12} tabular color={isPaid ? white(0.5) : white(0.7)} style={{ width: 28 }}>{s.n}ª</Text>
                <Text size={14} color={isPaid ? white(0.56) : "#fff"} style={{ flex: 1, textTransform: "capitalize" }} numberOfLines={1}>{month} {s.date.getFullYear()}</Text>
                {isCur && (
                  <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: item.isOverdue ? "rgba(248,113,113,0.15)" : "rgba(200,243,109,0.15)" }}>
                    <Text size={10} weight="semibold" color={current}>{item.isOverdue ? "Em atraso" : "Este mês"}</Text>
                  </View>
                )}
                <Text size={14} tabular weight={isPaid ? "regular" : "medium"} color={isPaid ? white(0.5) : "#fff"} style={isPaid ? { textDecorationLine: "line-through" } : undefined}>{fmt(item.amount)}</Text>
              </View>
            );
          })}
          {schedule.length > PREVIEW && (
            <Pressable onPress={() => setShowAll((v) => !v)} style={{ marginTop: 8, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: white(0.05) }}>
              <Text size={12} weight="medium" color={white(0.82)}>{showAll ? "Mostrar menos" : `Ver todas as ${schedule.length} parcelas`}</Text>
            </Pressable>
          )}
        </View>
      )}
    </Glass>
  );
}
