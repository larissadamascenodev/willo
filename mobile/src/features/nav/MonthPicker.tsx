import { Pressable, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { MONTH_NAMES } from "@/components/projecoes/shared";
import { Glass, Text, white } from "~/ui";

/** Navega entre meses: seta para trás, "Outubro 2026", seta para frente. */
export function MonthPicker({ month, year, onChange }: { month: number; year: number; onChange: (month: number, year: number) => void }) {
  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    onChange(d.getMonth(), d.getFullYear());
  };
  return (
    <Glass radius={999}>
      <View style={{ flexDirection: "row", alignItems: "center", height: 40 }}>
        <Pressable onPress={() => step(-1)} accessibilityLabel="Mês anterior" hitSlop={8} style={({ pressed }) => ({ width: 36, alignItems: "center", opacity: pressed ? 0.6 : 1 })}>
          <ChevronLeft size={18} color={white(0.82)} />
        </Pressable>
        <Text weight="semibold" size={13.5} align="center" style={{ minWidth: 104 }}>{MONTH_NAMES[month]} {year}</Text>
        <Pressable onPress={() => step(1)} accessibilityLabel="Próximo mês" hitSlop={8} style={({ pressed }) => ({ width: 36, alignItems: "center", opacity: pressed ? 0.6 : 1 })}>
          <ChevronRight size={18} color={white(0.82)} />
        </Pressable>
      </View>
    </Glass>
  );
}
