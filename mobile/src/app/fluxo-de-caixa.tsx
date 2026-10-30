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
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";

/**
 * The month, read from top to bottom.
 *
 * It opens on one piece of glass that holds the month's answer and its two parts: how
 * much it is expected to leave over, and under that what came in and what went out, as
 * the home draws them — two bars on one scale. Each bar opens, in a pane in the middle of
 * the screen, into what was fixed and what varied. Then the next few months, each of which
 * opens into its own detail, and last the months ahead as a line.
 *
 * The month is chosen in the corner, out of the way of the answer; it is the month of the
 * whole page, and of the rest of the app, which shares it.
 */

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const RULE = "rgba(255,255,255,0.08)";
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default function SeuMes() {
  const insets = useSafeAreaInsets();
  const { selectedMonth, selectedYear, setMonth } = useMonth();
  /* One projection for the page: the answer, the next months and the line read the same one. */
  const projection = useFinancialProjection();
  const [side, setSide] = useState<Side | null>(null);

  const now = new Date();
  const isCurrent = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const isPast = selectedYear < now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth < now.getMonth());
  const daysLeft = isCurrent ? new Date(selectedYear, selectedMonth + 1, 0).getDate() - now.getDate() : 0;

  const step = (by: number) => {
    const d = new Date(selectedYear, selectedMonth + by, 1);
    setMonth(d.getMonth(), d.getFullYear());
  };

  const { receitas, despesas, despesasPendentes } = projection.data;
  const loading = projection.loading;
  const sobra = receitas - despesas;
  const short = sobra < 0;
  const scale = Math.max(receitas, despesas, 1);
  const month = MONTH_NAMES[selectedMonth].toLocaleLowerCase("pt-BR");
  const headline = isPast ? (short ? `Faltou em ${month}` : `Sobrou em ${month}`) : short ? `Deve faltar em ${month}` : `Deve sobrar em ${month}`;

  return (
    <Room lit sky>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ══ Back on the left, the month in the corner ══ */}
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BackButton to="/" />
          <View style={{ height: 38, paddingHorizontal: 3, borderRadius: 19, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: SURFACE_FILL }}>
            <Pressable accessibilityLabel="Mês anterior" onPress={() => step(-1)} hitSlop={8} style={({ pressed }) => ({ width: 30, height: 32, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
              <ChevronLeft size={16} color="rgba(255,255,255,0.8)" strokeWidth={2.4} />
            </Pressable>
            <Text style={{ minWidth: 64, textAlign: "center", fontSize: 14, fontWeight: "700", color: "#fff", textTransform: "capitalize" }}>
              {SHORT[selectedMonth]}
              {selectedYear !== now.getFullYear() ? ` ${String(selectedYear).slice(2)}` : ""}
            </Text>
            <Pressable accessibilityLabel="Próximo mês" onPress={() => step(1)} hitSlop={8} style={({ pressed }) => ({ width: 30, height: 32, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
              <ChevronRight size={16} color="rgba(255,255,255,0.8)" strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        {/* ══ The page's name ══ */}
        <View style={{ marginTop: 18, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1, color: "#fff" }}>Seu mês</Text>
          <Text style={{ marginTop: 2, fontSize: 14, color: INK.soft }}>Receitas, despesas e o que vem pela frente</Text>
        </View>

        {/* ══ The answer and its two parts, in one piece of glass ══ */}
        <View
          style={{
            marginTop: 18,
            borderRadius: 28,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            backgroundColor: SURFACE_FILL,
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ fontSize: 14, color: INK.soft }}>{headline}</Text>
            {isCurrent && (
              <Text style={{ fontSize: 12.5, color: INK.softer }}>
                {daysLeft === 0 ? "último dia" : `faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`}
              </Text>
            )}
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[{ marginTop: 4, fontSize: 40, fontWeight: "800", letterSpacing: -1.4, color: short ? RED : "#fff" }, nums]}>
            {loading ? "—" : money(Math.abs(sobra))}
          </Text>
          {!loading && !isPast && despesasPendentes > 0 && (
            <Text style={{ marginTop: 2, fontSize: 13, color: INK.soft }}>
              <Text style={{ color: AMBER, fontWeight: "600" }}>{money(despesasPendentes)}</Text> ainda a pagar
            </Text>
          )}

          <View style={{ marginTop: 16, height: 1, backgroundColor: RULE }} />
          <Flow label="Receitas" amount={receitas} scale={scale} inflow loading={loading} onPress={() => setSide("receitas")} />
          <View style={{ height: 1, backgroundColor: RULE }} />
          <Flow label="Despesas" amount={despesas} scale={scale} loading={loading} onPress={() => setSide("despesas")} />
        </View>

        {/* ══ The next few months ══ */}
        <View style={{ marginTop: 34 }}>
          <BalancoPanel projection={projection} nextOnly />
        </View>

        {/* ══ The months ahead, as a line ══ */}
        <View style={{ marginTop: 40, marginBottom: 6, paddingHorizontal: 4 }}>
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
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: inflow ? GREEN : RED }} />
        <Text style={{ flex: 1, fontSize: 15, color: "rgba(255,255,255,0.86)" }}>{label}</Text>
        <Text style={[{ fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }, nums]}>
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
