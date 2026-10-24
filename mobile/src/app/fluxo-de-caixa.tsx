import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import SegmentedTabs from "~/components/SegmentedTabs";
import FluxoPanel from "~/components/financeiro/FluxoPanel";
import BalancoPanel from "~/components/financeiro/BalancoPanel";
import ProjecoesPanel from "~/components/financeiro/ProjecoesPanel";

/**
 * Three views, one per question.
 *
 * What moved (fluxo), where the month lands (balanço), and where the months after it
 * land (projeções). They are one screen rather than three because the questions are
 * asked in that order and the answer to each is the setup for the next.
 */

type Tool = "fluxo" | "balanco" | "projecoes";

export default function FluxoDeCaixa() {
  const { tool: initial } = useLocalSearchParams<{ tool?: string }>();
  const insets = useSafeAreaInsets();
  /* One projection for the screen, not one per tab: it starts loading while you
     are still on Fluxo, and switching between Balanço and Projeções no longer asks
     for twelve months all over again. */
  const projection = useFinancialProjection();
  const [tool, setTool] = useState<Tool>(
    initial === "balanco" || initial === "projecoes" ? initial : "fluxo",
  );

  return (
    <Room>
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
            value={tool}
            onChange={setTool}
            options={[
              { key: "fluxo" as const, label: "Fluxo de caixa" },
              { key: "balanco" as const, label: "Balanço" },
              { key: "projecoes" as const, label: "Projeções" },
            ]}
          />
        </View>

        {/* The key makes the panel arrive rather than swap in place, which is what
            tells you the question changed and not just the numbers. */}
        <Animated.View key={tool} entering={FadeIn.duration(180)}>
          {tool === "fluxo" && <FluxoPanel />}
          {tool === "balanco" && (
            <BalancoPanel projection={projection} onOpenProjecoes={() => setTool("projecoes")} />
          )}
          {tool === "projecoes" && <ProjecoesPanel projection={projection} />}
        </Animated.View>
      </ScrollView>
    </Room>
  );
}
