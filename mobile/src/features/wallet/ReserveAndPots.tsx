import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, PiggyBank, Plus, ShieldCheck } from "lucide-react-native";
import { isReserveGoal, type Goal } from "@/services/goalService";
import { getCurrency } from "@/lib/currency";
import { Glass, ProgressBar, Text, colors, white } from "~/ui";
import { tint } from "~/lib/color";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency(), maximumFractionDigits: 0 });

/**
 * Reserva e cofrinhos, lado a lado e separados: um cofrinho é uma meta como outra qualquer e
 * aparece em Metas também; a reserva é uma coisa à parte.
 */
export function ReserveAndPots({ goals }: { goals: Goal[] }) {
  const router = useRouter();
  const reserve = goals.find(isReserveGoal) ?? null;
  const pots = goals.filter((g) => !isReserveGoal(g));
  const potsTotal = pots.reduce((s, g) => s + Number(g.current_amount), 0);
  const progress = reserve && reserve.target_amount > 0 ? Number(reserve.current_amount) / reserve.target_amount : 0;

  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Pressable style={{ flex: 1 }} onPress={() => (reserve ? router.push({ pathname: "/metas/[id]", params: { id: reserve.id } }) : router.push({ pathname: "/metas", params: { novo: "reserva" } }))}>
        <Glass radius={22} style={{ minHeight: 148, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tint(colors.green, 0.15) }}>
              <ShieldCheck size={18} color={colors.green} />
            </View>
            {reserve ? <ChevronRight size={16} color={white(0.38)} /> : <Plus size={16} color={white(0.56)} />}
          </View>
          <View style={{ flex: 1 }} />
          <Text size={13} color={white(0.66)}>Reserva de emergência</Text>
          {reserve ? (
            <>
              <Text weight="extrabold" size={20} tabular numberOfLines={1} style={{ letterSpacing: -0.4 }}>{fmt(Number(reserve.current_amount))}</Text>
              <View style={{ marginTop: 8 }}><ProgressBar ratio={progress} color={colors.green} height={6} /></View>
              <Text size={11} color={white(0.56)} tabular numberOfLines={1} style={{ marginTop: 6 }}>{Math.round(Math.min(progress, 1) * 100)}% de {fmt(reserve.target_amount)}</Text>
            </>
          ) : (
            <Text size={12.5} color={white(0.62)} style={{ marginTop: 4, lineHeight: 17 }}>Guarde uma parte para imprevistos</Text>
          )}
        </Glass>
      </Pressable>

      <Pressable style={{ flex: 1 }} onPress={() => (pots.length > 0 ? router.push("/metas") : router.push({ pathname: "/metas", params: { novo: "cofrinho" } }))}>
        <Glass radius={22} style={{ minHeight: 148, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tint("#7DD3FC", 0.15) }}>
              <PiggyBank size={18} color="#7DD3FC" />
            </View>
            {pots.length > 0 ? <ChevronRight size={16} color={white(0.38)} /> : <Plus size={16} color={white(0.56)} />}
          </View>
          <View style={{ flex: 1 }} />
          <Text size={13} color={white(0.66)}>Cofrinhos</Text>
          {pots.length > 0 ? (
            <>
              <Text weight="extrabold" size={20} tabular numberOfLines={1} style={{ letterSpacing: -0.4 }}>{fmt(potsTotal)}</Text>
              <Text size={11} color={white(0.56)} numberOfLines={1} style={{ marginTop: 8 }}>{pots.length} {pots.length === 1 ? "cofrinho" : "cofrinhos"} · {pots[0].name}</Text>
            </>
          ) : (
            <Text size={12.5} color={white(0.62)} style={{ marginTop: 4, lineHeight: 17 }}>Crie um cofrinho para cada objetivo</Text>
          )}
        </Glass>
      </Pressable>
    </View>
  );
}
