import { View } from "react-native";
import { Calendar, CreditCard, Layers, Pencil, Tag, Trash2 } from "lucide-react-native";
import { getCategoryHexColor } from "@/lib/categoryUtils";
import { useMoney } from "@/components/projecoes/shared";
import { BottomSheet, Button, Text, white } from "~/ui";
import { tint } from "~/lib/color";
import { getCategoryIcon } from "@/lib/categoryUtils";

export interface CardEntry {
  transactionId: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const longDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
};

function Line({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: white(0.06), alignItems: "center", justifyContent: "center" }}>
        <Icon size={16} color={white(0.74)} />
      </View>
      <Text size={14} color={white(0.62)}>{label}</Text>
      <Text size={14.5} weight="medium" align="right" style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}

/** Uma compra no cartão: o que foi, e editar ou excluir. A fatura é quem quita, então não há "pago". */
export function EntrySheet({ entry, cardName, onClose, onEdit, onDelete }: {
  entry: CardEntry | null;
  cardName?: string;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { fmt } = useMoney();
  const hex = entry ? getCategoryHexColor(entry.category) : "#fff";
  const Icon = entry ? getCategoryIcon(entry.category) : CreditCard;
  const parcelado = !!entry && (entry.totalInstallments ?? 1) > 1;

  return (
    <BottomSheet open={!!entry} onClose={onClose}>
      {entry && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <View style={{ alignItems: "center", paddingTop: 4 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.15) }}>
              <Icon size={24} color={hex} />
            </View>
            <Text weight="bold" size={18} style={{ marginTop: 10 }} numberOfLines={2} align="center">{entry.name}</Text>
            <Text weight="extrabold" size={30} tabular style={{ marginTop: 2, letterSpacing: -0.6 }}>{fmt(entry.amount)}</Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <Line icon={Tag} label="Categoria" value={entry.category || "—"} />
            {!!entry.date && <Line icon={Calendar} label="Data" value={longDate(entry.date)} />}
            {!!cardName && <Line icon={CreditCard} label="Cartão" value={cardName} />}
            {parcelado && <Line icon={Layers} label="Parcela" value={`${entry.installmentNumber} de ${entry.totalInstallments}`} />}
          </View>
          <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
            <Button label="Editar" variant="glass" height={48} icon={<Pencil size={16} color="#fff" />} style={{ flex: 1 }} onPress={() => onEdit(entry.transactionId)} />
            <Button label="Excluir" variant="danger" height={48} icon={<Trash2 size={16} color="#F87171" />} style={{ flex: 1 }} onPress={() => onDelete(entry.transactionId)} />
          </View>
        </View>
      )}
    </BottomSheet>
  );
}
