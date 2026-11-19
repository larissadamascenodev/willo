import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Surface from "~/components/Surface";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * The month's money in and out, as the new home draws it.
 *
 * Two halves side by side — what came in, what went out — each with how much of it has
 * actually happened, as a short bar, and what is still to come. Under them, what the month
 * leaves: the one figure the two halves add up to, and how much of what came in went out.
 */

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const whole = (v: number) => money(v).replace(/,\d{2}$/, "");
const cents = (v: number) => money(v).match(/,\d{2}$/)?.[0] ?? "";

export default function MonthFlowCard({
  month,
  receitas,
  recebidas,
  despesas,
  pagas,
  hidden,
}: {
  month: number;
  receitas: number;
  recebidas: number;
  despesas: number;
  pagas: number;
  hidden?: boolean;
}) {
  const router = useRouter();
  const sobra = receitas - despesas;
  const share = receitas > 0 ? Math.round((despesas / receitas) * 100) : null;

  return (
    <Surface onPress={() => router.push("/fluxo-de-caixa" as never)} radius={26} style={{ padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: th("#fff") }}>Entradas e saídas</Text>
        <Text style={{ fontSize: 14, color: th(INK.soft) }}>{MONTHS[month]}</Text>
        <ChevronRight size={16} color={th(INK.soft)} />
      </View>

      <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
        <Half kind="in" total={receitas} done={recebidas} hidden={hidden} />
        <Half kind="out" total={despesas} done={pagas} hidden={hidden} />
      </View>

      {/* What the month leaves. */}
      <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, color: th(INK.soft) }}>Sobra do mês</Text>
          {share !== null && (
            <Text numberOfLines={1} style={[nums, { marginTop: 1, fontSize: 12.5, color: th(INK.softer) }]}>
              Saiu {share}% do que entrou
            </Text>
          )}
        </View>
        <Text style={[nums, { fontSize: 20, fontWeight: "700", letterSpacing: -0.5, color: th(sobra >= 0 ? GREEN : RED) }]}>
          {hidden ? "R$ •••" : `${sobra < 0 ? "−" : ""}${money(Math.abs(sobra))}`}
        </Text>
      </View>
    </Surface>
  );
}

function Half({ kind, total, done, hidden }: { kind: "in" | "out"; total: number; done: number; hidden?: boolean }) {
  const inflow = kind === "in";
  const tone = inflow ? GREEN : RED;
  const left = Math.max(0, total - done);
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const Icon = inflow ? ArrowDownLeft : ArrowUpRight;
  return (
    <View style={{ flex: 1, minWidth: 0, borderRadius: 20, padding: 14, backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: th(inflow ? "rgba(103,205,103,0.16)" : "rgba(255,90,95,0.16)", "bg") }}>
          <Icon size={17} color={th(tone)} strokeWidth={2.4} />
        </View>
        <Text style={{ fontSize: 14.5, color: th(INK.soft) }}>{inflow ? "Entrou" : "Saiu"}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginTop: 12, fontSize: 21, fontWeight: "700", letterSpacing: -0.6, color: th("#fff") }]}>
        {hidden ? "R$ •••" : whole(total)}
        {!hidden && <Text style={{ color: th(INK.faint) }}>{cents(total)}</Text>}
      </Text>
      <View style={{ marginTop: 10, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.10)", "bg") }}>
        <View style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 3, backgroundColor: th(tone, "bg") }} />
      </View>
      <Text numberOfLines={1} style={[nums, { marginTop: 7, fontSize: 12.5, color: th(INK.soft) }]}>
        {total <= 0 ? "Nada este mês" : left <= 0.004 ? (inflow ? "Tudo recebido" : "Tudo pago") : `${hidden ? "R$ •••" : money(left)} ${inflow ? "a receber" : "a pagar"}`}
      </Text>
    </View>
  );
}
