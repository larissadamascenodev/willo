import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import { ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * The month as the two flows that make it.
 *
 * Both bars share one scale, so their lengths answer the only question that matters
 * here — which side is bigger — before the figures are read, and the balance above is
 * just their difference. The sentence under it is the verdict the bars cannot draw:
 * two near-equal lengths look fine until you are told they are 94%.
 */
export default function FluxoCard({
  receitas,
  despesas,
  month,
  isCurrentMonth = true,
}: {
  receitas: number;
  despesas: number;
  month: number;
  isCurrentMonth?: boolean;
}) {
  const router = useRouter();
  const balanco = receitas - despesas;
  const monthLabel = MONTHS[month];
  const pct = receitas > 0 ? Math.round((despesas / receitas) * 100) : 0;
  const scale = Math.max(receitas, despesas, 1);

  const verdict =
    receitas <= 0 && despesas <= 0
      ? `Nada entrou nem saiu em ${monthLabel} ainda.`
      : receitas <= 0
        ? `Saiu dinheiro em ${monthLabel} sem nenhuma entrada.`
        : balanco < 0
          ? `Você gastou mais do que entrou em ${monthLabel}.`
          : `Você gastou ${pct}% do que entrou em ${monthLabel}.`;

  return (
    <Surface style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text numberOfLines={1} style={[T.cardLabel, { flex: 1 }]}>
          Receitas e despesas <Text style={{ color: INK.faint }}>·</Text>{" "}
          {isCurrentMonth ? "este mês" : "no mês"}
        </Text>
        <ChevronRight size={16} color={INK.faint} />
      </View>

      {/* The balance leads, because it is the answer; the sentence explains it. */}
      <Text numberOfLines={1} style={[T.figure, { marginTop: 4 }, balanco < 0 && { color: RED }]}>
        {balanco > 0 ? "+" : ""}
        {money(balanco)}
      </Text>
      <Text style={[T.note, { marginTop: 8 }]}>{verdict}</Text>

      <View style={{ marginTop: 16, gap: 14 }}>
        <Flow
          label="Entrada"
          amount={receitas}
          scale={scale}
          inflow
          delay={0.05}
          onPress={() => router.push("/detalhe/receitas" as never)}
        />
        <Flow
          label="Saída"
          amount={despesas}
          scale={scale}
          delay={0.12}
          onPress={() => router.push("/detalhe/despesas" as never)}
        />
      </View>

      <View
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.07)",
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 12.5, color: INK.soft }}>
          {receitas > 0 ? `${pct}% do que entrou já saiu` : "Nada entrou neste mês"}
        </Text>
        <Text style={{ fontSize: 12.5, color: INK.softer }}>ver fluxo de caixa</Text>
      </View>
    </Surface>
  );
}

/** One of the two flows. Tapping it opens that side of the month in full. */
function Flow({
  label,
  amount,
  scale,
  inflow,
  delay,
  onPress,
}: {
  label: string;
  amount: number;
  scale: number;
  inflow?: boolean;
  delay: number;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: "#fff" }}>{label}</Text>
        <Text style={{ fontSize: 14.5, fontWeight: "600", color: inflow ? "#fff" : RED }}>
          {inflow ? "" : "−"}
          {money(amount)}
        </Text>
      </View>
      <View
        style={{
          marginTop: 8,
          height: 6,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <Bar
          share={Math.max(amount / scale, amount > 0 ? 0.03 : 0)}
          color={inflow ? GREEN : RED}
          delay={delay}
        />
      </View>
    </Pressable>
  );
}
