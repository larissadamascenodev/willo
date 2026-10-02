import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { CalendarDays, ChevronRight, CreditCard, PiggyBank, ShieldCheck, Sparkles, X, type LucideIcon } from "lucide-react-native";
import type { RaioXData } from "@/hooks/useRaioX";
import type { ForecastDay } from "@/services/raioXForecast";
import { Glass, Text, colors, white } from "~/ui";
import { tint } from "~/lib/color";
import { Card, Section, Verdict, brl, brlCents } from "./primitives";

const PRESSURE_HEX = { tranquilo: "rgba(255,255,255,0.14)", atencao: "#FCD34D", pressao: "#F87171" } as const;

/** O calendário do mês: quais dias pesam no caixa; toque num dia para ver o que acontece nele. */
export function PressureCalendar({ data }: { data: RaioXData }) {
  const { forecast, today } = data;
  const [selected, setSelected] = useState<ForecastDay | null>(null);
  const firstWeekday = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const heavy = forecast.days.filter((d) => !d.isPast && d.pressure !== "tranquilo").slice(0, 3);
  const insight = forecast.negativeDay !== null
    ? `Dia ${forecast.negativeDay} é o ponto crítico: é quando o saldo pode ficar negativo.`
    : heavy.length > 0
      ? `Os dias mais pesados daqui pra frente são ${heavy.map((d) => d.day).join(", ")}. Prepare o caixa para eles.`
      : "Nenhum dia pesado à vista pelo resto do mês. Caminho livre 🙌";
  const cells: (ForecastDay | null)[] = [...Array.from({ length: firstWeekday }, () => null), ...forecast.days];

  return (
    <Section icon={CalendarDays} title="O que vem pela frente" hint="Toque num dia para ver o que acontece nele">
      <Card style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", marginBottom: 8 }}>
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <Text key={i} size={10} color={white(0.5)} align="center" style={{ flex: 1 }}>{d}</Text>)}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {cells.map((d, i) => (
            <View key={i} style={{ width: `${100 / 7}%`, padding: 3, aspectRatio: 1 }}>
              {d && (
                <Pressable onPress={() => setSelected(d)} style={{ flex: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: d.isPast ? white(0.03) : d.pressure === "tranquilo" ? white(0.05) : tint(PRESSURE_HEX[d.pressure], 0.18), borderWidth: d.isToday ? 2 : 0, borderColor: "#fff" }}>
                  <Text size={12} weight="medium" color={d.isPast ? white(0.38) : "#fff"}>{d.day}</Text>
                  {!d.isPast && d.pressure !== "tranquilo" && <View style={{ position: "absolute", bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: PRESSURE_HEX[d.pressure] }} />}
                  {d.inflow > 0 && <View style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green }} />}
                </Pressable>
              )}
            </View>
          ))}
        </View>
        <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6 }}>
          {[{ label: "Tranquilo", hex: "rgba(255,255,255,0.2)" }, { label: "Atenção", hex: PRESSURE_HEX.atencao }, { label: "Pressão", hex: PRESSURE_HEX.pressao }, { label: "Entrada", hex: "#C8F36D" }].map((l) => (
            <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.hex }} />
              <Text size={11} color={white(0.62)}>{l.label}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 12 }}><Verdict hex={forecast.negativeDay !== null ? "#F87171" : heavy.length ? "#FCD34D" : "#C8F36D"}>{insight}</Verdict></View>
      </Card>

      {selected && (
        <Glass radius={22} style={{ marginTop: 8, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View>
              <Text weight="bold" size={16}>{selected.day} de {today.toLocaleDateString("pt-BR", { month: "long" })}</Text>
              {!selected.isPast && <Text size={13} tabular color={selected.balance < 0 ? colors.red : white(0.7)}>Saldo previsto: {brl(selected.balance)}</Text>}
            </View>
            <Pressable onPress={() => setSelected(null)} accessibilityLabel="Fechar" hitSlop={10}><X size={20} color={white(0.56)} /></Pressable>
          </View>
          {selected.items.length > 0 ? (
            <View style={{ marginTop: 12, gap: 6 }}>
              {selected.items.map((i, k) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <Text size={13} color={white(0.82)} numberOfLines={1} style={{ flex: 1 }}>{i.name}</Text>
                  <Text size={13} weight="semibold" tabular color={i.type === "receita" ? colors.green : "#fff"}>{i.type === "receita" ? "+" : "−"}{brlCents(i.amount)}</Text>
                </View>
              ))}
            </View>
          ) : <Text size={13} color={white(0.62)} style={{ marginTop: 12 }}>Nenhum compromisso agendado neste dia.</Text>}
          {selected.estimated > 0 && <Text size={12} color={white(0.56)} style={{ marginTop: 8 }}>+ {brl(selected.estimated)} estimados de gastos do dia a dia.</Text>}
          {!selected.isPast && selected.pressure !== "tranquilo" && (
            <Text size={12.5} color={PRESSURE_HEX[selected.pressure]} style={{ marginTop: 10 }}>{selected.pressure === "pressao" ? "Dia de maior pressão financeira do mês." : "Dia de atenção: tem conta pesada por aqui."}</Text>
          )}
        </Glass>
      )}
    </Section>
  );
}

function Tile({ label, value, color = "#fff", bg = white(0.04) }: { label: string; value: string; color?: string; bg?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, borderRadius: 16, backgroundColor: bg, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Text size={11} color={white(0.62)} numberOfLines={1}>{label}</Text>
      <Text size={17} weight="bold" tabular numberOfLines={1} color={color}>{value}</Text>
    </View>
  );
}

/** Fatura inteligente: uma leitura do cartão, não uma lista. */
export function SmartInvoice({ data }: { data: RaioXData }) {
  const inv = data.invoice;
  const { installments, card, commitment, impulse, categories } = data;
  if (!inv) return null;

  const share = commitment.income > 0 ? inv.projectedClose / commitment.income : 0;
  const cardCategory = card?.topCategories[0];
  const heaviest = categories.find((c) => c.name === cardCategory?.name);

  const readings: string[] = [];
  if (installments.purchases.length > 0) readings.push(`Você tem ${installments.purchases.length} ${installments.purchases.length === 1 ? "compra parcelada" : "compras parceladas"} rodando: ${brl(installments.monthly)} por mês até ${installments.freeFrom ?? "os próximos meses"}.`);
  if (cardCategory) readings.push(`${cardCategory.name} é o que mais pesa no cartão: ${brl(cardCategory.amount)}${heaviest && heaviest.average > 0 && heaviest.spent > heaviest.average ? `, ${brl(heaviest.spent - heaviest.average)} acima da sua média` : ""}.`);
  if (impulse) readings.push(impulse.message);
  if (share >= 0.4) readings.push(`A fatura prevista come ${Math.round(share * 100)}% da sua renda do mês.`);
  const saving = Math.max((card?.avgTicket ?? 0) * 2, 80);

  return (
    <Section icon={CreditCard} title="Fatura inteligente" hint={`Fecha em ${inv.daysToClose} ${inv.daysToClose === 1 ? "dia" : "dias"}`}>
      <Card style={{ padding: 20 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tile label="Fatura atual" value={brl(inv.current)} />
          <Tile label="Previsão ao fechar" value={brl(inv.projectedClose)} />
        </View>
        <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
          <Tile label="Limite seguro" value={brl(inv.safeForNewPurchases)} color={colors.green} bg="rgba(200,243,109,0.08)" />
          <Tile label="% da renda" value={`${Math.round(share * 100)}%`} color={share >= 0.5 ? colors.red : share >= 0.3 ? colors.amber : "#fff"} />
        </View>
        {inv.futureInstallments > 0 && <Text size={13} color={white(0.74)} style={{ marginTop: 12, lineHeight: 18 }}><Text size={13} weight="bold">{brl(inv.futureInstallments)}</Text> das próximas faturas já estão comprometidos com parcelas.</Text>}
        {readings.length > 0 && (
          <View style={{ marginTop: 12, gap: 6, borderTopWidth: 1, borderTopColor: white(0.06), paddingTop: 12 }}>
            {readings.map((r, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ marginTop: 7, width: 6, height: 6, borderRadius: 3, backgroundColor: white(0.35) }} />
                <Text size={13} color={white(0.82)} style={{ flex: 1, lineHeight: 18 }}>{r}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ marginTop: 12 }}>
          <Verdict hex={share >= 0.5 ? "#F87171" : "#7DD3FC"}>
            {share >= 0.5 ? `Cortando ${brl(saving)} em compras no crédito, a fatura volta para um patamar saudável.` : inv.safeForNewPurchases > 0 ? `Dá pra colocar até ${brl(inv.safeForNewPurchases)} no cartão sem apertar o mês.` : "Segure novas compras no crédito até a fatura fechar."}
          </Verdict>
        </View>
      </Card>
    </Section>
  );
}

/** Sobra inteligente: para onde mandar o que deve sobrar no fim do mês. */
export function Surplus({ data }: { data: RaioXData }) {
  const router = useRouter();
  const s = data.surplus;
  const { reserveInfo } = data;
  if (!s) return null;
  const needsReserve = reserveInfo.coverage < 3;
  const rows: { key: string; label: string; value: number; hex: string; Icon: LucideIcon; note: string; go: (() => void) | null }[] = [
    {
      key: "reserva", label: "Reserva de emergência", value: s.reserve, hex: "#C8F36D", Icon: ShieldCheck,
      note: needsReserve ? `sua reserva cobre ${reserveInfo.coverage.toFixed(1).replace(".", ",")} ${reserveInfo.coverage < 2 ? "mês" : "meses"} de gastos essenciais` : "sua reserva já está firme",
      go: () => router.push("/gestao"),
    },
    { key: "cofrinho", label: "Cofrinhos", value: s.goal + s.invest, hex: "#7DD3FC", Icon: PiggyBank, note: "para objetivos e investimentos", go: () => router.push("/metas") },
    { key: "livre", label: "Livre pra usar", value: s.free, hex: "#A6A6A6", Icon: Sparkles, note: "sem culpa", go: null },
  ].filter((r) => r.value > 0);

  return (
    <Section icon={Sparkles} title="Sobra inteligente">
      <Card style={{ padding: 20 }}>
        <Text size={13} color={white(0.66)}>Você deve terminar o mês com</Text>
        <Text weight="extrabold" size={30} tabular color={colors.green} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ letterSpacing: -0.6 }}>{brl(s.surplus)} livres</Text>
        <Text size={13} color={white(0.7)} style={{ marginTop: 4 }}>Sugestão de destino para essa sobra:</Text>
        <View style={{ marginTop: 12, gap: 8 }}>
          {rows.map((r) => (
            <View key={r.key} style={{ borderRadius: 18, backgroundColor: white(0.04), padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tint(r.hex, 0.12) }}><r.Icon size={18} color={r.hex} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="semibold" size={14} numberOfLines={1}>{r.label}</Text>
                  <Text size={12} color={white(0.62)} numberOfLines={2}>{r.note}</Text>
                </View>
                <Text weight="bold" size={16} tabular>{brl(r.value)}</Text>
              </View>
              {r.go && (
                <Pressable onPress={r.go} style={({ pressed }) => ({ marginTop: 10, height: 36, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "#fff", opacity: pressed ? 0.85 : 1 })}>
                  <Text weight="semibold" size={13} color={colors.black}>{r.key === "reserva" ? "Guardar na reserva" : "Escolher cofrinho"}</Text>
                  <ChevronRight size={16} color={colors.black} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
        <View style={{ marginTop: 12 }}>
          <Verdict hex="#C8F36D">{needsReserve ? "Enquanto a reserva não cobrir três meses de gastos essenciais, ela é o melhor destino para a sobra." : "Com a reserva firme, essa sobra rende mais indo para um cofrinho ou investimento."}</Verdict>
        </View>
      </Card>
    </Section>
  );
}
