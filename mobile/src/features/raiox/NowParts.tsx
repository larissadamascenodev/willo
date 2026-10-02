import { useState } from "react";
import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Activity, ArrowDownRight, ArrowUpRight, ChevronDown, HelpCircle, Scale } from "lucide-react-native";
import type { RaioXData } from "@/hooks/useRaioX";
import type { Reason } from "@/services/raioXForecast";
import { Text, colors, white } from "~/ui";
import { tint } from "~/lib/color";
import { Card, Section, Verdict, brl } from "./primitives";

/** O "por quê?" que abre o cálculo por trás de uma previsão. */
export function Why({ reasons, label = "Por quê?" }: { reasons: Reason[]; label?: string }) {
  const [open, setOpen] = useState(false);
  if (reasons.length === 0) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Pressable onPress={() => setOpen((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <HelpCircle size={14} color={white(0.66)} />
        <Text size={12} weight="medium" color={white(0.66)}>{label}</Text>
        <ChevronDown size={14} color={white(0.66)} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </Pressable>
      {open && (
        <View style={{ marginTop: 8, gap: 6, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.25)", padding: 12 }}>
          {reasons.map((r) => (
            <View key={r.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text size={12.5} color={white(0.74)} numberOfLines={1} style={{ flex: 1 }}>{r.label}</Text>
              <Text size={12.5} weight="semibold" tabular color={r.amount < 0 ? colors.red : colors.green}>{r.amount < 0 ? "−" : "+"}{brl(Math.abs(r.amount))}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Quanto de uma barra segmentada cada parte ocupa. */
function Segments({ parts, height, base }: { parts: { key: string; value: number; hex: string }[]; height: number; base: number }) {
  return (
    <View style={{ height, flexDirection: "row", gap: 3, borderRadius: height / 2, overflow: "hidden", backgroundColor: white(0.06) }}>
      {parts.filter((p) => p.value > 0).map((p) => <View key={p.key} style={{ width: `${(p.value / Math.max(base, 1)) * 100}%`, backgroundColor: p.hex }} />)}
    </View>
  );
}

/** Como você está: o saldo, como o mês termina, quanto ainda pode gastar e onde a renda já está comprometida. */
export function CurrentScenario({ data }: { data: RaioXData }) {
  const { forecast, current, today, commitment } = data;
  const monthName = today.toLocaleDateString("pt-BR", { month: "long" });
  const toPay = Math.max(current.despesas - current.despesasPagas, 0);
  const negative = forecast.endBalance < 0;
  const hex = negative || forecast.negativeDay !== null ? "#F87171" : forecast.tightWindow ? "#FCD34D" : "#C8F36D";
  const paidShare = current.despesas > 0 ? current.despesasPagas / current.despesas : 0;
  const spendable = Math.max(forecast.safeToSpend, 0);

  const insight = forecast.negativeDay !== null
    ? `No ritmo atual seu saldo fica negativo no dia ${forecast.negativeDay}. Segurar ${brl(Math.max(forecast.estimatedRest * 0.25, 50))} nos gastos do dia a dia já resolve.`
    : forecast.tightWindow
      ? `O caixa aperta entre os dias ${forecast.tightWindow.from} e ${forecast.tightWindow.to}: deixe as compras maiores para depois disso.`
      : forecast.endBalance >= current.receitas * 0.2
        ? `Do jeito que está, sobra ${brl(forecast.endBalance)} no fim do mês. Já dá pra reservar uma parte.`
        : "O mês fecha no azul, mas sem muita folga. Vale segurar os gastos variáveis.";

  const split = [
    { key: "fixed", label: "Contas fixas", value: commitment.fixed, hex: "#60A5FA" },
    { key: "inst", label: "Parcelas", value: commitment.installments, hex: "#C084FC" },
    { key: "card", label: "Cartão", value: commitment.card, hex: "#F472B6" },
    { key: "var", label: "Dia a dia", value: commitment.variable, hex: "#FCD34D" },
  ];

  return (
    <Section icon={Activity} title="Como você está" hint={`Fechamento previsto de ${monthName}`}>
      <View style={{ borderRadius: 28, borderWidth: 1, borderColor: white(0.12), padding: 20, overflow: "hidden", backgroundColor: "#0E0E0E" }}>
        <LinearGradient colors={[tint(hex, 0.11), "rgba(20,20,20,0.96)", "#0E0E0E"]} locations={[0, 0.55, 1]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={12} color={white(0.66)}>Saldo na conta</Text>
            <Text weight="extrabold" size={30} tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ letterSpacing: -0.6 }}>{brl(current.saldoAtual)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text size={12} color={white(0.66)}>Deve sobrar</Text>
            <Text weight="extrabold" size={22} tabular numberOfLines={1} color={negative ? colors.red : colors.green}>{brl(forecast.endBalance)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text size={12} color={white(0.62)}>Despesas do mês <Text size={12} weight="semibold" tabular>{brl(current.despesas)}</Text></Text>
            <Text size={12} color={white(0.62)} tabular>{Math.round(paidShare * 100)}% pago</Text>
          </View>
          <View style={{ marginTop: 8 }}>
            <Segments height={12} base={Math.max(current.despesas, 1)} parts={[{ key: "p", value: current.despesasPagas, hex: "rgba(255,255,255,0.7)" }, { key: "t", value: toPay, hex: "rgba(252,211,77,0.7)" }]} />
          </View>
          <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
            {[
              { label: "Já paguei", value: current.despesasPagas, dot: "rgba(255,255,255,0.7)" },
              { label: "Falta pagar", value: toPay, dot: "rgba(252,211,77,0.7)" },
              { label: "Entra no mês", value: current.receitas, dot: "#C8F36D" },
            ].map((s) => (
              <View key={s.label} style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.dot }} />
                  <Text size={10.5} color={white(0.62)} numberOfLines={1}>{s.label}</Text>
                </View>
                <Text size={13.5} weight="semibold" tabular numberOfLines={1}>{brl(s.value)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 16, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.3)", padding: 14 }}>
          <Text size={12} color={white(0.7)}>Você ainda pode gastar</Text>
          <Text weight="extrabold" size={24} tabular numberOfLines={1}>{brl(spendable)}</Text>
          <Text size={12} color={white(0.62)} style={{ lineHeight: 17 }}>sem fechar o mês no vermelho · cerca de {brl(forecast.dailyAllowance)} por dia</Text>
        </View>

        {commitment.income > 0 && (
          <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: white(0.12), paddingTop: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text size={12} color={white(0.62)}>Renda comprometida</Text>
              <Text size={12} weight="bold" tabular color={commitment.committedPct >= 0.6 ? colors.red : commitment.committedPct >= 0.4 ? colors.amber : "#fff"}>{Math.round(commitment.committedPct * 100)}%</Text>
            </View>
            <View style={{ marginTop: 8 }}>
              <Segments height={10} base={commitment.income} parts={[...split, { key: "free", value: Math.max(commitment.free, 0), hex: "#C8F36D" }]} />
            </View>
            <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 4 }}>
              {split.filter((p) => p.value > 0).map((p) => (
                <View key={p.key} style={{ width: "47%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.hex }} />
                    <Text size={11.5} color={white(0.66)} numberOfLines={1}>{p.label}</Text>
                  </View>
                  <Text size={12.5} weight="semibold" tabular>{brl(p.value)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
          {[
            { label: "Conservador", value: forecast.conservative },
            { label: "Provável", value: forecast.endBalance },
            { label: "Otimista", value: forecast.optimistic },
          ].map((s, i) => (
            <View key={s.label} style={{ flex: 1, minWidth: 0, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: i === 1 ? white(0.08) : "rgba(0,0,0,0.25)" }}>
              <Text size={10} color={white(0.62)} numberOfLines={1}>{s.label}</Text>
              <Text size={13} weight="bold" tabular numberOfLines={1} color={s.value < 0 ? colors.red : "#fff"}>{brl(s.value)}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 12 }}><Verdict hex={hex}>{insight}</Verdict></View>
        <Why reasons={forecast.reasons} label="Como cheguei nessa previsão?" />
      </View>
    </Section>
  );
}

/** Este mês contra o mês passado, até o mesmo dia. */
export function MonthComparison({ data }: { data: RaioXData }) {
  const c = data.comparison;
  const last = new Date(data.today.getFullYear(), data.today.getMonth() - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
  const rows = [
    { label: "Entrou", now: c.income.now, before: c.income.before, goodWhenUp: true },
    { label: "Saiu", now: c.expense.now, before: c.expense.before, goodWhenUp: false },
    { label: "Sobrou", now: c.saved.now, before: c.saved.before, goodWhenUp: true },
  ];
  return (
    <Section icon={Scale} title={`Este mês x ${last}`} hint="Comparando até o mesmo dia do mês">
      <Card style={{ padding: 20 }}>
        <View style={{ gap: 12 }}>
          {rows.map((r) => {
            const diff = r.now - r.before;
            const good = r.goodWhenUp ? diff >= 0 : diff <= 0;
            return (
              <View key={r.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text size={13.5} color={white(0.74)}>{r.label}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {c.hasBefore && <Text size={12} color={white(0.5)} tabular>{brl(r.before)} →</Text>}
                  <Text size={15} weight="bold" tabular>{brl(r.now)}</Text>
                  {c.hasBefore && Math.abs(diff) >= 1 && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: good ? "rgba(200,243,109,0.15)" : "rgba(248,113,113,0.15)" }}>
                      {diff > 0 ? <ArrowUpRight size={12} color={good ? colors.green : colors.red} /> : <ArrowDownRight size={12} color={good ? colors.green : colors.red} />}
                      <Text size={11} weight="bold" tabular color={good ? colors.green : colors.red}>{brl(Math.abs(diff))}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
        {c.categories.length > 0 && (
          <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: white(0.06), paddingTop: 12 }}>
            <Text size={12} color={white(0.62)} style={{ marginBottom: 8 }}>Maiores mudanças por categoria</Text>
            <View style={{ gap: 6 }}>
              {c.categories.map((cat) => (
                <View key={cat.name} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <Text size={13} color={white(0.85)} numberOfLines={1} style={{ flex: 1 }}>{cat.name}</Text>
                  <Text size={13} weight="semibold" tabular color={cat.diff > 0 ? colors.red : colors.green}>{cat.diff > 0 ? "+" : "−"}{brl(Math.abs(cat.diff))}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        <View style={{ marginTop: 12 }}><Verdict hex={c.expense.now > c.expense.before ? "#FCD34D" : "#C8F36D"}>{c.message}</Verdict></View>
      </Card>
    </Section>
  );
}
