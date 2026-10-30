import { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMonth } from "@/contexts/MonthContext";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { MONTH_NAMES } from "@/lib/projectionRows";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Bar from "~/components/Bar";
import { SURFACE_FILL } from "~/components/Surface";
import { ChevronLeft, ChevronRight } from "~/components/icons";
import EntriesModal, { type Side } from "~/components/financeiro/EntriesModal";
import BalancoPanel from "~/components/financeiro/BalancoPanel";
import ProjecoesPanel from "~/components/financeiro/ProjecoesPanel";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * The month, read from top to bottom.
 *
 * First what came in and what went out, as the home draws it — two bars on one scale,
 * straight on the ground — and each of them opens, in a pane in the middle of the
 * screen, into what was fixed and what varied. Then how the month is expected to close
 * and the next few months, each of which opens into its own detail. Last, the months
 * ahead as a line. The month chosen at the top is the month of the whole page, and of
 * the rest of the app, which shares it.
 */

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

export default function SeuMes() {
  const insets = useSafeAreaInsets();
  const { selectedMonth, selectedYear, setMonth } = useMonth();
  /* One projection for the page: the flows, the close and the months ahead read the same one. */
  const projection = useFinancialProjection();
  const [side, setSide] = useState<Side | null>(null);
  const thisYear = new Date().getFullYear();

  const step = (by: number) => {
    const d = new Date(selectedYear, selectedMonth + by, 1);
    setMonth(d.getMonth(), d.getFullYear());
  };

  const receitas = projection.data.receitas;
  const despesas = projection.data.despesas;
  const scale = Math.max(receitas, despesas, 1);

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

        {/* ══ 1. What came in and what went out, straight on the ground ══ */}
        <View style={{ marginTop: 20, gap: 6 }}>
          <Flow label="Receitas" amount={receitas} scale={scale} inflow loading={projection.loading} onPress={() => setSide("receitas")} />
          <Flow label="Despesas" amount={despesas} scale={scale} loading={projection.loading} onPress={() => setSide("despesas")} />
        </View>

        {/* ══ 2. How the month closes, and the next few ══ */}
        <View style={{ marginTop: 10 }}>
          <BalancoPanel projection={projection} closeOnly />
        </View>

        {/* ══ 3. The months ahead, as a line ══ */}
        <View style={{ marginTop: 40, marginBottom: 6, paddingHorizontal: 2 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>Projeções</Text>
          <Text style={{ marginTop: 2, fontSize: 13.5, color: INK.soft }}>Para onde o seu saldo vai, mês a mês</Text>
        </View>
        <ProjecoesPanel projection={projection} />
      </ScrollView>

      <EntriesModal side={side} month={selectedMonth} year={selectedYear} onClose={() => setSide(null)} />
    </Room>
  );
}

/** One of the two flows: its name and figure, and under them its bar. Tapping it opens its detail. */
function Flow({
  label,
  amount,
  scale,
  inflow = false,
  loading,
  onPress,
}: {
  label: string;
  amount: number;
  scale: number;
  inflow?: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: inflow ? GREEN : RED }} />
        <Text style={{ flex: 1, fontSize: 15, color: INK.soft }}>{label}</Text>
        <Text style={[{ fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }, nums]}>
          {loading ? "—" : `${inflow ? "" : "−"}${money(amount)}`}
        </Text>
        <ChevronRight size={16} color={INK.faint} />
      </View>
      <View style={{ marginTop: 10, height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)" }}>
        {!loading && <Bar share={Math.max(amount / scale, amount > 0 ? 0.03 : 0)} color={inflow ? GREEN : RED} />}
      </View>
    </Pressable>
  );
}
