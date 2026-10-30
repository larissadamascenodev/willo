import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMonth } from "@/contexts/MonthContext";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import SegmentedTabs from "~/components/SegmentedTabs";
import BalancoPanel from "~/components/financeiro/BalancoPanel";
import ProjecoesPanel from "~/components/financeiro/ProjecoesPanel";
import EntriesModal, { type Side } from "~/components/financeiro/EntriesModal";

/**
 * Two views, one per question.
 *
 * Where the month lands (balanço) — with what came in and what went out drawn inside it,
 * each opening into what was fixed and what varied — and where the months after it land
 * (projeções). One screen, because the answer to the first is the setup for the second.
 */

type Tool = "balanco" | "projecoes";

export default function FluxoDeCaixa() {
  const { tool: initial } = useLocalSearchParams<{ tool?: string }>();
  const insets = useSafeAreaInsets();
  const { selectedMonth, selectedYear } = useMonth();
  /* One projection for the screen, not one per tab: switching between Balanço and
     Projeções does not ask for twelve months all over again. */
  const projection = useFinancialProjection();
  const [tool, setTool] = useState<Tool>(initial === "projecoes" ? "projecoes" : "balanco");
  const [side, setSide] = useState<Side | null>(null);
  /* A tab is mounted the first time it is opened and then kept, so its chart
     draws itself once per visit to the screen rather than on every switch. */
  const [visited, setVisited] = useState<Set<Tool>>(() => new Set([tool]));
  useEffect(() => {
    setVisited((v) => (v.has(tool) ? v : new Set(v).add(tool)));
  }, [tool]);

  const panel = (key: Tool) => ({ display: tool === key ? ("flex" as const) : ("none" as const) });

  return (
    /* The sky behind, as on the home and the wallet: colour on the ground, and
       something for the glass above it to catch. */
    <Room lit sky>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 44, justifyContent: "center" }}>
          <BackButton to="/" />
        </View>

        <View style={{ marginTop: 10 }}>
          <SegmentedTabs
            glass
            value={tool}
            onChange={setTool}
            options={[
              { key: "balanco" as const, label: "Balanço" },
              { key: "projecoes" as const, label: "Projeções" },
            ]}
          />
        </View>

        {/* Tabs are peers, so switching does not animate — the charts inside are
            the motion, and they play once. Nothing here fades, either: the glass in
            Projeções would flatten under a fading parent. */}
        {visited.has("balanco") && (
          <View style={panel("balanco")}>
            <BalancoPanel projection={projection} onOpenProjecoes={() => setTool("projecoes")} onOpenSide={setSide} />
          </View>
        )}
        {visited.has("projecoes") && (
          <View style={panel("projecoes")}>
            <ProjecoesPanel projection={projection} />
          </View>
        )}
      </ScrollView>

      <EntriesModal side={side} month={selectedMonth} year={selectedYear} onClose={() => setSide(null)} />
    </Room>
  );
}
