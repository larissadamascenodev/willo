import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Check, Layers, RotateCcw } from "lucide-react-native";
import { useMoney } from "@/components/projecoes/shared";
import { BottomSheet, Button, Glass, Text, colors, white } from "~/ui";

export interface ExtractedItem {
  description: string;
  /** Negativo num estorno, para o total importado bater com o da fatura. */
  amount: number;
  is_refund?: boolean;
  date: string | null;
  installment_current: number | null;
  installment_total: number | null;
  category: string;
  confidence?: number;
  selected: boolean;
}

const shortDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

/** O que a IA leu da fatura ou do comprovante: confira, desmarque o que não vale e importe. */
export function ImportReviewSheet({ open, onClose, items, message, declaredTotal, onConfirm, confirming }: {
  open: boolean;
  onClose: () => void;
  items: ExtractedItem[];
  message: string;
  declaredTotal?: number | null;
  onConfirm: (items: ExtractedItem[]) => void;
  confirming: boolean;
}) {
  const { fmt } = useMoney();
  const [rows, setRows] = useState<ExtractedItem[]>(items);
  useEffect(() => { if (open) setRows(items); }, [open, items]);

  const chosen = rows.filter((r) => r.selected);
  const sum = chosen.reduce((s, r) => s + r.amount, 0);
  const matches = declaredTotal != null && Math.abs(sum - declaredTotal) < 0.05;
  const toggle = (i: number) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, selected: !r.selected } : r)));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      size="full"
      footer={<Button label={confirming ? "Importando…" : `Importar ${chosen.length} ${chosen.length === 1 ? "lançamento" : "lançamentos"}`} disabled={chosen.length === 0} loading={confirming} onPress={() => onConfirm(chosen)} />}
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text display weight="bold" size={22}>Confira o que foi lido</Text>
        <Text size={14} color={white(0.62)} style={{ marginTop: 4 }}>{message}</Text>

        <Glass radius={20} style={{ marginTop: 16, padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text size={13} color={white(0.62)}>Soma selecionada</Text>
            <Text weight="bold" size={15} tabular>{fmt(sum)}</Text>
          </View>
          {declaredTotal != null && (
            <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
              <Text size={13} color={white(0.62)}>Total da fatura</Text>
              <Text weight="bold" size={15} tabular color={matches ? colors.green : colors.amber}>{fmt(declaredTotal)}{matches ? "  ✓" : ""}</Text>
            </View>
          )}
        </Glass>

        <View style={{ marginTop: 14, gap: 8 }}>
          {rows.map((r, i) => {
            const refund = r.amount < 0;
            return (
              <Pressable key={i} onPress={() => toggle(i)} style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: r.selected ? 1 : 0.45 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: r.selected ? "#fff" : "transparent", borderWidth: r.selected ? 0 : 1.5, borderColor: white(0.3) }}>
                  {r.selected && <Check size={14} color={colors.black} strokeWidth={3} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="medium" size={15} numberOfLines={1}>{r.description}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text size={12} color={white(0.56)} numberOfLines={1}>{[shortDate(r.date), r.category].filter(Boolean).join(" · ")}</Text>
                    {r.installment_total && r.installment_total > 1 && !refund ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Layers size={11} color={white(0.56)} />
                        <Text size={12} color={white(0.56)} tabular>{r.installment_current ?? 1}/{r.installment_total}</Text>
                      </View>
                    ) : null}
                    {refund && <RotateCcw size={11} color={colors.green} />}
                  </View>
                </View>
                <Text weight="semibold" size={15} tabular color={refund ? colors.green : "#fff"}>{fmt(Math.abs(r.amount))}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
