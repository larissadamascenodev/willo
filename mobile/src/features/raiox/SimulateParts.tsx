import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Check, ChevronDown, Plus, Scissors, ShoppingBag } from "lucide-react-native";
import { getCategoryHexColor, getCategoryIcon } from "@/lib/categoryUtils";
import { currencySymbol } from "@/lib/currency";
import type { RaioXData } from "@/hooks/useRaioX";
import { BottomSheet, Text, colors, fonts, white } from "~/ui";
import { tint } from "~/lib/color";
import { MoneyField } from "../wallet/sheetParts";
import { Card, LIGHT_HEX, MONTHS_SHORT, Section, Verdict, brl, brlCents } from "./primitives";

export function SimulateTab({ data }: { data: RaioXData }) {
  return (
    <>
      <PurchaseCopilot data={data} />
      <CutSimulator data={data} />
    </>
  );
}

const TIMES = [1, 2, 3, 4, 5, 6];

function Pill({ label, on, onPress, flex = 1, accent }: { label: string; on: boolean; onPress: () => void; flex?: number; accent?: string }) {
  return (
    <Pressable onPress={onPress} style={{ flex, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: on ? (accent ?? "#fff") : white(0.04), borderWidth: on ? 0 : 1, borderColor: white(0.12) }}>
      <Text size={12} weight="semibold" color={on ? colors.black : white(0.82)}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value, sub, color = "#fff" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, borderRadius: 16, backgroundColor: white(0.04), padding: 12 }}>
      <Text size={11} color={white(0.62)} numberOfLines={1}>{label}</Text>
      <Text size={17} weight="bold" tabular numberOfLines={1} color={color}>{value}</Text>
      {!!sub && <Text size={11} color={white(0.56)} numberOfLines={1} tabular>{sub}</Text>}
    </View>
  );
}

/** Posso comprar?: o impacto de uma compra, à vista ou parcelada, no orçamento dos próximos meses. */
function PurchaseCopilot({ data }: { data: RaioXData }) {
  const [cents, setCents] = useState(0);
  const [times, setTimes] = useState(1);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const { report, installments, goals, today, commitment } = data;
  const income = commitment.income;
  const value = cents / 100;

  const sim = useMemo(() => {
    if (value <= 0) return null;
    const monthly = value / times;
    const baseNet = report.projection.avgNet;
    const months = Array.from({ length: times }, (_, k) => {
      const existing = installments.purchases.filter((p) => p.remaining > k).reduce((s, p) => s + p.amount, 0);
      const free = k === 0 ? report.pulse.free : baseNet + installments.monthly - existing;
      const date = new Date(today.getFullYear(), today.getMonth() + k, 1);
      return { label: `${MONTHS_SHORT[date.getMonth()]}${date.getFullYear() !== today.getFullYear() ? `/${String(date.getFullYear()).slice(2)}` : ""}`, before: free, after: free - monthly };
    });
    const worst = Math.min(...months.map((m) => m.after));
    const light: "verde" | "amarelo" | "vermelho" = worst < 0 ? "vermelho" : worst < income * 0.1 ? "amarelo" : "verde";
    const goal = goals.find((g) => g.monthly > 0);
    const goalDelay = goal ? Math.ceil(value / goal.monthly) : null;
    const verdict = light === "vermelho" ? `Essa compra deixa ${months.find((m) => m.after < 0)?.label} no vermelho. Melhor esperar ou dividir em mais vezes 🛑`
      : light === "amarelo" ? "Dá pra comprar, mas o orçamento fica apertado. Pense duas vezes 🤔" : "Cabe no seu bolso sem apertar. Pode ir tranquilo ✅";
    return { monthly, months, light, goal, goalDelay, verdict, share: income > 0 ? monthly / income : null };
  }, [value, times, report, installments, goals, today, income]);

  const applyCustom = () => {
    const n = Math.min(Math.max(Number(custom.replace(/\D/g, "")) || 0, 1), 60);
    if (n > 0) setTimes(n);
    setCustom(""); setCustomOpen(false);
  };

  return (
    <Section icon={ShoppingBag} title="Posso comprar?" hint="Veja o impacto antes de decidir">
      <Card style={{ padding: 16 }}>
        <Text size={12} color={white(0.62)} style={{ marginBottom: 8 }}>Quanto custa o que você quer comprar?</Text>
        <MoneyField cents={cents} onChange={setCents} />

        <Text size={12} color={white(0.62)} style={{ marginTop: 16 }}>Como vai pagar?</Text>
        <View style={{ marginTop: 8, flexDirection: "row", gap: 6 }}>
          <Pill flex={2} label="À vista" on={times === 1} onPress={() => setTimes(1)} />
          {TIMES.slice(1).map((n) => <Pill key={n} label={`${n}x`} on={times === n} onPress={() => setTimes(n)} />)}
          <Pressable onPress={() => setCustomOpen((v) => !v)} accessibilityLabel="Outro número de parcelas" style={{ flex: 1, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: times > 6 ? "#fff" : white(0.04), borderWidth: times > 6 ? 0 : 1, borderColor: white(0.12) }}>
            {times > 6 ? <Text size={12} weight="semibold" color={colors.black}>{times}x</Text> : <Plus size={16} color={white(0.82)} />}
          </Pressable>
        </View>

        {customOpen && (
          <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
            <TextInput autoFocus value={custom} onChangeText={(t) => setCustom(t.replace(/\D/g, "").slice(0, 2))} onSubmitEditing={applyCustom} keyboardType="number-pad" placeholder="Ex.: 18" placeholderTextColor={white(0.45)} style={{ flex: 1, height: 40, borderRadius: 20, borderWidth: 1, borderColor: white(0.12), backgroundColor: white(0.04), paddingHorizontal: 16, color: "#fff", fontSize: 14, fontFamily: fonts.regular }} />
            <Pressable onPress={applyCustom} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}><Check size={16} color={colors.black} strokeWidth={3} /></Pressable>
          </View>
        )}

        {sim && (
          <View>
            <View style={{ marginTop: 16, flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 18, padding: 14, backgroundColor: tint(LIGHT_HEX[sim.light], 0.08) }}>
              <View style={{ marginTop: 4, width: 12, height: 12, borderRadius: 6, backgroundColor: LIGHT_HEX[sim.light] }} />
              <Text size={13} color={white(0.85)} style={{ flex: 1, lineHeight: 18 }}>{sim.verdict}</Text>
            </View>
            <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
              <Stat label={times === 1 ? "Sai este mês" : "Por mês"} value={brlCents(sim.monthly)} sub={sim.share !== null ? `${Math.round(sim.share * 100)}% da renda` : undefined} />
              <Stat label="Sobra depois" value={brl(sim.months[0].after)} color={sim.months[0].after < 0 ? colors.red : "#fff"} sub={`antes: ${brl(sim.months[0].before)}`} />
            </View>
            {times > 1 && (
              <View style={{ marginTop: 10, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.25)", padding: 12 }}>
                <Text size={11} color={white(0.62)} style={{ marginBottom: 8 }}>Sobra de cada mês com a parcela</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {sim.months.slice(0, 12).map((m) => {
                    const hex = m.after < 0 ? "#F87171" : m.after < income * 0.1 ? "#FCD34D" : "#C8F36D";
                    return (
                      <View key={m.label} style={{ width: "23.5%", borderRadius: 12, backgroundColor: white(0.04), paddingHorizontal: 6, paddingVertical: 8, alignItems: "center" }}>
                        <Text size={10} color={white(0.62)} numberOfLines={1}>{m.label}</Text>
                        <Text size={11} weight="bold" tabular color={hex} numberOfLines={1}>{brl(m.after)}</Text>
                      </View>
                    );
                  })}
                </View>
                {sim.months.length > 12 && <Text size={11} color={white(0.56)} style={{ marginTop: 8 }}>+{sim.months.length - 12} meses no mesmo ritmo</Text>}
              </View>
            )}
            {sim.goal && sim.goalDelay !== null && (
              <Text size={12} color={white(0.74)} style={{ marginTop: 10, lineHeight: 17 }}>🎯 Equivale a <Text size={12} weight="bold">{sim.goalDelay} {sim.goalDelay === 1 ? "mês" : "meses"}</Text> de depósitos na meta “{sim.goal.goal.name}”.</Text>
            )}
          </View>
        )}
      </Card>
    </Section>
  );
}

const CUT_STEPS = [50, 100, 200, 300, 500];

/** Simulador de corte: e se você gastasse menos em uma categoria? */
function CutSimulator({ data }: { data: RaioXData }) {
  const options = data.categories.filter((c) => c.spent >= 20 || c.average >= 20);
  const [category, setCategory] = useState<string | null>(options[0]?.name ?? null);
  const [cut, setCut] = useState(100);
  const [pickerOpen, setPickerOpen] = useState(false);
  if (options.length === 0) return null;

  const selected = options.find((c) => c.name === category) ?? options[0];
  const base = Math.max(selected.average, selected.spent);
  const effective = Math.min(cut, base);
  const { avgNet, start } = data.report.projection;
  const keep12 = start + avgNet * 12;
  const adjust12 = keep12 + effective * 12;
  const SelIcon = getCategoryIcon(selected.name);
  const selHex = getCategoryHexColor(selected.name);

  return (
    <Section icon={Scissors} title="Simulador de corte" hint="E se você gastasse menos em uma categoria?">
      <Card style={{ padding: 16 }}>
        <Pressable onPress={() => setPickerOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, borderColor: white(0.12), backgroundColor: white(0.04), paddingHorizontal: 14, paddingVertical: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tint(selHex, 0.12) }}><SelIcon size={18} color={selHex} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={11} color={white(0.62)}>Categoria</Text>
            <Text weight="semibold" size={15} numberOfLines={1}>{selected.name}</Text>
          </View>
          <ChevronDown size={16} color={white(0.56)} />
        </Pressable>

        <Text size={12} color={white(0.66)} style={{ marginTop: 14, lineHeight: 17 }}>Você gasta cerca de <Text size={12} weight="bold">{brl(base)}</Text> por mês aqui. Quanto quer cortar?</Text>
        <View style={{ marginTop: 8, flexDirection: "row", gap: 6 }}>
          {CUT_STEPS.map((s) => (
            <View key={s} style={{ flex: 1, opacity: s > base && s !== CUT_STEPS[0] ? 0.3 : 1 }} pointerEvents={s > base && s !== CUT_STEPS[0] ? "none" : "auto"}>
              <Pill label={String(s)} on={cut === s} onPress={() => setCut(s)} accent={colors.green} />
            </View>
          ))}
        </View>

        <View style={{ marginTop: 16, flexDirection: "row", gap: 6 }}>
          {[3, 6, 12].map((m) => (
            <View key={m} style={{ flex: 1, minWidth: 0, borderRadius: 16, backgroundColor: "rgba(200,243,109,0.08)", paddingHorizontal: 8, paddingVertical: 10, alignItems: "center" }}>
              <Text size={10} color={white(0.66)}>{m === 12 ? "1 ano" : `${m} meses`}</Text>
              <Text size={15} weight="extrabold" tabular color={colors.green} numberOfLines={1}>+{brl(effective * m)}</Text>
            </View>
          ))}
        </View>

        <Text size={12} weight="semibold" style={{ marginTop: 16, marginBottom: 8 }}>Seu saldo daqui a 1 ano</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Stat label="Se continuar assim" value={brl(keep12)} color={keep12 < 0 ? colors.red : "#fff"} />
          <View style={{ flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1, borderColor: "rgba(200,243,109,0.25)", backgroundColor: "rgba(200,243,109,0.08)", padding: 12 }}>
            <Text size={11} color={white(0.74)} numberOfLines={1}>Se ajustar</Text>
            <Text size={17} weight="bold" tabular numberOfLines={1} color={adjust12 < 0 ? colors.red : colors.green}>{brl(adjust12)}</Text>
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <Verdict hex="#C8F36D">Cortando {brl(effective)} por mês em {selected.name}, você junta {brl(effective * 12)} em um ano{effective * 12 >= 1000 ? ". Dá uma viagem, hein? ✈️" : ". Pequenos cortes, grande diferença 💡"}</Verdict>
        </View>
      </Card>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <Text display weight="bold" size={20}>Escolha a categoria</Text>
          <View style={{ marginTop: 12 }}>
            {options.map((c, i) => {
              const Icon = getCategoryIcon(c.name);
              const hex = getCategoryHexColor(c.name);
              return (
                <Pressable key={c.name} onPress={() => { setCategory(c.name); setPickerOpen(false); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: white(0.06) }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.12) }}><Icon size={18} color={hex} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size={15} numberOfLines={1}>{c.name}</Text>
                    <Text size={12} color={white(0.62)} tabular>{brl(Math.max(c.average, c.spent))} por mês</Text>
                  </View>
                  {c.name === selected.name && <Check size={20} color="#fff" />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </BottomSheet>
    </Section>
  );
}
