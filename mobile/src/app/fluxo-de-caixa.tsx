import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMonth } from "@/contexts/MonthContext";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { MONTH_NAMES } from "@/lib/projectionRows";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import { SURFACE_FILL } from "~/components/Surface";
import { ChevronLeft, ChevronRight } from "~/components/icons";
import ReceitasDespesasPanel from "~/components/financeiro/ReceitasDespesasPanel";
import BalancoPanel from "~/components/financeiro/BalancoPanel";
import ProjecoesPanel from "~/components/financeiro/ProjecoesPanel";
import { INK } from "~/theme/tokens";

/**
 * The month, read from top to bottom.
 *
 * One page instead of three tabs, because the three were one story told in order: how
 * the month closes, what came in and what went out to get there, and where the months
 * after it land. The month chosen at the top is the month of the whole page — and of the
 * rest of the app, which shares it — so nothing below can disagree with anything above.
 */

export default function SeuMes() {
  const insets = useSafeAreaInsets();
  const { selectedMonth, selectedYear, setMonth } = useMonth();
  /* One projection for the page: the close and the months ahead read the same one. */
  const projection = useFinancialProjection();
  const thisYear = new Date().getFullYear();

  const step = (by: number) => {
    const d = new Date(selectedYear, selectedMonth + by, 1);
    setMonth(d.getMonth(), d.getFullYear());
  };

  return (
    <Room lit sky>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ══ Back, and the month the whole page is about ══ */}
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BackButton to="/" />
          <View style={{ height: 40, paddingHorizontal: 4, borderRadius: 20, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: SURFACE_FILL }}>
            <Pressable accessibilityLabel="Mês anterior" onPress={() => step(-1)} hitSlop={8} style={({ pressed }) => ({ width: 34, height: 34, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
              <ChevronLeft size={18} color="rgba(255,255,255,0.8)" strokeWidth={2.3} />
            </Pressable>
            <Text style={{ minWidth: 104, textAlign: "center", fontSize: 15, fontWeight: "700", color: "#fff" }}>
              {MONTH_NAMES[selectedMonth]}
              {selectedYear !== thisYear ? ` ${selectedYear}` : ""}
            </Text>
            <Pressable accessibilityLabel="Próximo mês" onPress={() => step(1)} hitSlop={8} style={({ pressed }) => ({ width: 34, height: 34, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
              <ChevronRight size={18} color="rgba(255,255,255,0.8)" strokeWidth={2.3} />
            </Pressable>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* ══ 1. How the month closes ══ */}
        <BalancoPanel projection={projection} closeOnly />

        {/* ══ 2. What came in and what went out ══ */}
        <Heading title="Receitas e despesas" note="O que é fixo todo mês e o que variou" />
        <ReceitasDespesasPanel month={selectedMonth} year={selectedYear} />

        {/* ══ 3. The months after it ══ */}
        <Heading title="Próximos meses" note="Para onde o seu saldo vai, mês a mês" />
        <ProjecoesPanel projection={projection} />
      </ScrollView>
    </Room>
  );
}

function Heading({ title, note }: { title: string; note: string }) {
  return (
    <View style={{ marginTop: 40, marginBottom: 14, paddingHorizontal: 2 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>{title}</Text>
      <Text style={{ marginTop: 2, fontSize: 13.5, color: INK.soft }}>{note}</Text>
    </View>
  );
}
