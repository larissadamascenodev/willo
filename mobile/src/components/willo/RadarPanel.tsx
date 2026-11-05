import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { RaioXData } from "@/hooks/useRaioX";
import { Scope, type SectorKey } from "~/components/radar/parts";
import { Compromissos, Consumo, Futuro, Habitos, QuickAsks, Saude, type RadarSnapshot } from "~/components/radar/Sectors";
import { Simulador } from "~/components/radar/Simulador";
import { face } from "~/lib/chatFont";
import { MONTH_NAMES } from "~/lib/purchaseSim";
import { INK } from "~/theme/tokens";

/**
 * The Radar: where the money's numbers turn into what they mean. The home shows the numbers;
 * this explains them, says what may happen next, and lets a purchase be tried before it is
 * made. A dial of six sectors with Willo at the centre, and under it what the chosen sector
 * found. All of it reads the same services as the rest of the app; it keeps no figures of
 * its own, and what it works out is what the assistant is told.
 */
export default function RadarPanel({
  data,
  snapshot,
  categories,
  bottom,
  onAsk,
}: {
  data: RaioXData | null;
  snapshot: RadarSnapshot;
  categories: string[];
  bottom: number;
  onAsk: (question: string) => void;
}) {
  const [sector, setSector] = useState<SectorKey>("consumo");

  const blips = useMemo(() => {
    if (!data) return {};
    const rising = data.categories.filter((c) => c.tone === "critico").length;
    return {
      consumo: { risk: rising, note: data.categories.filter((c) => c.tone === "atencao").length },
      habitos: { risk: 0, note: data.anomalies.length + data.duplicates.length },
      compromissos: { risk: data.commitment.committedPct >= 0.6 ? 1 : 0, note: data.commitment.committedPct >= 0.4 ? 1 : 0 },
      futuro: { risk: data.forecast.endBalance < 0 ? 1 : 0, note: (snapshot.previsao?.proximos_meses ?? []).filter((m) => m.sobra < 0).length },
      saude: { risk: data.report.pillars.filter((p) => p.tone === "critico").length, note: data.report.pillars.filter((p) => p.tone === "atencao").length },
    };
  }, [data, snapshot]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 6, paddingBottom: bottom + 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <Scope selected={sector} onSelect={setSector} blips={blips} />

      {!data ? (
        <Text style={{ marginTop: 20, textAlign: "center", fontSize: 15, ...face(500), color: INK.soft }}>Lendo os seus números…</Text>
      ) : (
        <View>
          {sector === "consumo" && <Consumo data={data} onAsk={onAsk} />}
          {sector === "habitos" && <Habitos data={data} onAsk={onAsk} />}
          {sector === "compromissos" && <Compromissos data={data} snapshot={snapshot} />}
          {sector === "futuro" && <Futuro data={data} snapshot={snapshot} />}
          {sector === "saude" && <Saude data={data} onAsk={onAsk} />}
          {sector === "simular" && <Simulador data={data} snapshot={snapshot} categories={categories} onAsk={onAsk} />}
          {sector !== "simular" && <QuickAsks sector={sector} data={data} snapshot={snapshot} onAsk={onAsk} />}
          <Text style={{ marginTop: 22, paddingHorizontal: 20, fontSize: 12.5, lineHeight: 17, ...face(500), color: INK.faint }}>
            {`Dos seus registros no Willo, até hoje, ${data.today.getDate()} de ${MONTH_NAMES[data.today.getMonth()]}.`}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
