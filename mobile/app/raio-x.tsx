import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { BrainCircuit, ChevronRight, Sparkles } from "lucide-react-native";
import { useRaioX, type RaioXData } from "@/hooks/useRaioX";
import { AnalysesTab } from "~/features/raiox/AnalysesParts";
import { CurrentScenario, MonthComparison } from "~/features/raiox/NowParts";
import { PressureCalendar, SmartInvoice, Surplus } from "~/features/raiox/FutureParts";
import { DailyLightCard, GoalsCountdown, ScoreCard } from "~/features/raiox/SummaryParts";
import { SimulateTab } from "~/features/raiox/SimulateParts";
import { MonthWrapped } from "~/features/raiox/MonthWrapped";
import { Button, Glass, Screen, Segmented, Text, colors, white } from "~/ui";

type Tab = "geral" | "simular";

/** O Raio-X: o cérebro do seu dinheiro. Score, previsão do mês, o que vem pela frente e simuladores. */
export default function RaioX() {
  const router = useRouter();
  const result = useRaioX();
  const data = result.loading ? null : (result as RaioXData);
  const [tab, setTab] = useState<Tab>("geral");
  const [wrapOpen, setWrapOpen] = useState(false);

  return (
    <Screen onRefresh={async () => {}}>
      <View style={{ paddingTop: 4, paddingHorizontal: 4 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={12} style={{ height: 36, justifyContent: "center", marginLeft: -4 }}>
          <Text size={13} color={white(0.7)}>‹ Voltar</Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green }} />
          <Text size={11} weight="semibold" color={white(0.56)} style={{ letterSpacing: 1.8, textTransform: "uppercase" }}>Análise em tempo real</Text>
        </View>
        <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text display weight="extrabold" size={30} style={{ letterSpacing: -0.6 }}>Raio-X</Text>
          <BrainCircuit size={24} color={colors.green} />
        </View>
        <Text size={14} color={white(0.62)} style={{ marginTop: 6 }}>O cérebro do seu dinheiro: o que você faz certo, o que dá pra melhorar.</Text>
      </View>

      {!data ? (
        <View style={{ marginTop: 20, gap: 12 }}>
          <Glass radius={30} style={{ height: 300, alignItems: "center", justifyContent: "center", gap: 8 }}>
            <ActivityIndicator color="#fff" />
            <Text size={14} color={white(0.66)}>Analisando suas finanças…</Text>
          </Glass>
          <View style={{ height: 190, borderRadius: 24, backgroundColor: white(0.06) }} />
        </View>
      ) : !data.report.hasData ? (
        <View style={{ marginTop: 48, alignItems: "center", paddingHorizontal: 24 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: white(0.12), backgroundColor: white(0.04) }}><Sparkles size={32} color={white(0.66)} /></View>
          <Text weight="bold" size={19} style={{ marginTop: 20 }}>Nada pra analisar ainda</Text>
          <Text size={14} color={white(0.62)} align="center" style={{ marginTop: 4 }}>Adicione suas receitas e despesas e o Raio-X começa a trabalhar.</Text>
          <Button label="Adicionar transações" height={48} style={{ marginTop: 24 }} onPress={() => router.push("/transacoes")} />
        </View>
      ) : (
        <>
          <DailyLightCard data={data} />

          {data.wrap && (
            <Pressable onPress={() => setWrapOpen(true)} style={({ pressed }) => ({ marginTop: 10, borderRadius: 22, overflow: "hidden", opacity: pressed ? 0.9 : 1 })}>
              <LinearGradient colors={["#3F6212", "#1E3A8A", "#86198F"]} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: white(0.15) }}><Text size={22}>✨</Text></View>
                <View style={{ flex: 1 }}>
                  <Text weight="bold" size={15}>Retrospectiva de {data.wrap.monthLabel}</Text>
                  <Text size={12} color={white(0.85)}>Vilã, dia mais caro e sua maior conquista</Text>
                </View>
                <ChevronRight size={20} color={white(0.8)} />
              </LinearGradient>
            </Pressable>
          )}

          <View style={{ marginTop: 16 }}>
            <Segmented<Tab> options={[{ key: "geral", label: "Geral" }, { key: "simular", label: "Simular" }]} value={tab} onChange={setTab} />
          </View>

          {tab === "geral" ? (
            <>
              <ScoreCard data={data} />
              <CurrentScenario data={data} />
              <MonthComparison data={data} />
              <PressureCalendar data={data} />
              <SmartInvoice data={data} />
              <Surplus data={data} />
              <AnalysesTab data={data} />
              <GoalsCountdown data={data} />
            </>
          ) : (
            <SimulateTab data={data} />
          )}

          {data.wrap && <MonthWrapped wrap={data.wrap} open={wrapOpen} onClose={() => setWrapOpen(false)} />}
        </>
      )}
    </Screen>
  );
}
