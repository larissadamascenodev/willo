import { View } from "react-native";
import { AlertOctagon, Droplets, GraduationCap, Moon, Repeat, Wallet } from "lucide-react-native";
import { getCategoryHexColor, getCategoryIcon } from "@/lib/categoryUtils";
import { currencySymbol } from "@/lib/currency";
import type { RaioXData } from "@/hooks/useRaioX";
import { ProgressBar, Text, colors, white } from "~/ui";
import { LinearGradient } from "expo-linear-gradient";
import { tint } from "~/lib/color";
import { Card, Section, Verdict, brl, brlCents } from "./primitives";

export function AnalysesTab({ data }: { data: RaioXData }) {
  return (
    <>
      <CategoriesAndLeaks data={data} />
      <CashFlowReading data={data} />
      <Lessons data={data} />
    </>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ marginTop: 7, width: 6, height: 6, borderRadius: 3, backgroundColor: white(0.35) }} />
      <Text size={13} color={white(0.82)} style={{ flex: 1, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}

/** Onde o dinheiro escapa: o que foge do seu padrão e as cobranças que passam despercebidas. */
function CategoriesAndLeaks({ data }: { data: RaioXData }) {
  const { categories, villain, leaks, duplicates, impulse, anomalies } = data;
  if (categories.length === 0) return null;

  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
  const overspending = categories
    .filter((c) => c.average > 0 && c.spent > c.average)
    .map((c) => ({ ...c, excess: c.spent - c.average }))
    .sort((x, y) => y.excess - x.excess)
    .slice(0, 3);
  const excessTotal = overspending.reduce((sum, c) => sum + c.excess, 0);
  const monthlyDrains = leaks.leaks.reduce((sum, l) => sum + l.monthly, 0);
  const escaping = excessTotal + monthlyDrains;

  const drains = [
    ...leaks.leaks.map((l) => ({ id: l.id, Icon: l.kind === "taxa" ? AlertOctagon : Repeat, title: l.title, detail: l.detail })),
    ...duplicates.map((d) => ({ id: `dup-${d.name}-${d.dates[0]}`, Icon: AlertOctagon, title: `${d.name} cobrado 2x`, detail: `${brlCents(d.amount)} em ${d.dates.map((x) => `${x.slice(8, 10)}/${x.slice(5, 7)}`).join(" e ")} · confira se foi engano` })),
    ...(impulse ? [{ id: "impulso", Icon: Moon, title: "Compras por impulso", detail: impulse.message }] : []),
  ];

  const topAnomaly = anomalies.find((x) => x.category);
  const verdict = escaping > 0
    ? `Voltando ao seu padrão nessas categorias e revisando as cobranças fixas, você libera cerca de ${brl(escaping)} por mês, ${brl(escaping * 12)} em um ano.`
    : topAnomaly ? `${topAnomaly.what} ${topAnomaly.action}` : "Nenhum vazamento por aqui: seus gastos estão dentro do seu padrão 👏";
  const VillainIcon = villain ? getCategoryIcon(villain.name) : null;
  const tone = escaping > 0 ? "#FCD34D" : "#C8F36D";

  return (
    <Section icon={Droplets} title="Onde seu dinheiro escapa" hint="O que está fugindo do seu padrão">
      <View style={{ marginBottom: 8, borderRadius: 26, borderWidth: 1, borderColor: tint(tone, 0.22), padding: 20, overflow: "hidden" }}>
        <LinearGradient colors={[tint(tone, 0.13), "rgba(20,20,20,0.95)"]} locations={[0, 0.65]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <Text size={11} weight="bold" color={tone} style={{ letterSpacing: 1.3, textTransform: "uppercase" }}>{escaping > 0 ? "Escapando por mês" : "Tudo sob controle"}</Text>
        <Text weight="extrabold" size={34} tabular numberOfLines={1} style={{ marginTop: 4, letterSpacing: -0.8 }}>{brl(escaping)}</Text>
        <Text size={12.5} color={white(0.74)} style={{ marginTop: 6, lineHeight: 18 }}>
          {escaping > 0 ? `${brl(excessTotal)} em gastos acima da sua média e ${brl(monthlyDrains)} em cobranças recorrentes` : "Nenhum gasto acima da média nem cobrança esquecida neste mês"}
        </Text>
      </View>

      {villain && VillainIcon && (
        <Card style={{ padding: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(248,113,113,0.15)" }}><VillainIcon size={24} color={colors.red} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={11} weight="bold" color={colors.red} style={{ letterSpacing: 1.3, textTransform: "uppercase" }}>Vilã do mês 😈</Text>
              <Text weight="bold" size={18} numberOfLines={1}>{villain.name}</Text>
              <Text size={12} color={white(0.7)} tabular numberOfLines={1}>{brl(villain.spent)} · {Math.round((villain.spent / (totalSpent || 1)) * 100)}% de tudo que você gastou</Text>
            </View>
          </View>
          <Text size={13} color={white(0.82)} style={{ marginTop: 12, lineHeight: 18 }}>{villain.diagnosis}</Text>
        </Card>
      )}

      {overspending.length > 0 && (
        <Card style={{ padding: 16, marginBottom: 8 }}>
          <Text size={12} color={white(0.62)} style={{ marginBottom: 12 }}>Gastando acima do seu normal</Text>
          <View style={{ gap: 16 }}>
            {overspending.map((c) => {
              const Icon = getCategoryIcon(c.name);
              const hex = getCategoryHexColor(c.name);
              const scale = Math.max(c.spent, c.average) || 1;
              return (
                <View key={c.name}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.12) }}><Icon size={17} color={hex} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text size={14.5} numberOfLines={1}>{c.name}</Text>
                      <Text size={11.5} color={white(0.62)} tabular numberOfLines={1}>{brl(c.spent)} este mês · média {brl(c.average)}</Text>
                    </View>
                    <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(248,113,113,0.15)" }}><Text size={12} weight="bold" color={colors.red} tabular>+{brl(c.excess)}</Text></View>
                  </View>
                  <View style={{ marginLeft: 48, marginTop: 8, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text size={10} color={white(0.5)} style={{ width: 40 }}>média</Text>
                      <View style={{ flex: 1 }}><ProgressBar ratio={c.average / scale} color={white(0.3)} height={6} track={white(0.06)} /></View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text size={10} color={white(0.7)} style={{ width: 40 }}>agora</Text>
                      <View style={{ flex: 1 }}><ProgressBar ratio={c.spent / scale} color={hex} height={6} track={white(0.06)} /></View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {drains.length > 0 && (
        <Card style={{ padding: 16, marginBottom: 8 }}>
          <Text size={12} color={white(0.62)} style={{ marginBottom: 10 }}>Cobranças que passam despercebidas</Text>
          <View style={{ gap: 12 }}>
            {drains.slice(0, 5).map((d) => (
              <View key={d.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ marginTop: 2, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(252,211,77,0.1)" }}><d.Icon size={16} color={colors.amber} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size={14} numberOfLines={1}>{d.title}</Text>
                  <Text size={12} color={white(0.62)} style={{ lineHeight: 17 }}>{d.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card style={{ padding: 16 }}><Verdict hex={tone}>{verdict}</Verdict></Card>
    </Section>
  );
}

/** O fluxo das contas lido como uma análise: o que entra, o que sai e o que isso diz. */
function CashFlowReading({ data }: { data: RaioXData }) {
  const f = data.cashFlow;
  const { comparison } = data;
  if (f.income === 0 && f.expense === 0) return null;

  const burn = f.income > 0 ? f.expense / f.income : 1;
  const heaviest = f.weeks.reduce((m, w, i) => (w.expense > f.weeks[m].expense ? i : m), 0);
  const firstHalf = f.weeks.slice(0, 2).reduce((s, w) => s + w.expense, 0);
  const firstHalfShare = f.expense > 0 ? firstHalf / f.expense : 0;
  const biggestOutShare = f.biggestOut && f.income > 0 ? f.biggestOut.amount / f.income : 0;
  const incomeConcentration = f.biggestIn && f.income > 0 ? f.biggestIn.amount / f.income : 0;
  const sym = currencySymbol();

  const readings = [
    `De cada ${sym} 100 que entraram, você já usou ${sym} ${Math.round(Math.min(burn, 9.99) * 100)}.`,
    firstHalfShare >= 0.6 ? `${Math.round(firstHalfShare * 100)}% das saídas acontecem na primeira quinzena, logo depois que o dinheiro entra.` : `As saídas estão bem distribuídas no mês; a semana ${f.weeks[heaviest].label} foi a mais pesada.`,
    f.biggestOut ? `Maior saída: ${f.biggestOut.name}, ${brlCents(f.biggestOut.amount)}${biggestOutShare > 0.1 ? ` (${Math.round(biggestOutShare * 100)}% da renda do mês)` : ""}.` : null,
    incomeConcentration >= 0.9 && f.biggestIn ? `Toda a sua renda vem de uma fonte só (${f.biggestIn.name}). Uma segunda entrada deixaria o mês menos sensível a atrasos.` : null,
    comparison.hasBefore ? (comparison.expense.now > comparison.expense.before ? `No mês passado, até aqui, tinham saído ${brl(comparison.expense.before)}. Você está gastando mais rápido.` : `No mês passado, até aqui, tinham saído ${brl(comparison.expense.before)}. Você está gastando mais devagar.`) : null,
  ].filter(Boolean) as string[];

  const verdict = burn >= 1 ? "Está saindo mais do que entra nas contas. Nesse ritmo o mês fecha no vermelho ou come a reserva."
    : burn >= 0.85 ? "Sobra pouco depois das contas: qualquer imprevisto vira dívida. Vale abrir mais folga."
      : `Boa margem: sobra ${Math.round((1 - burn) * 100)}% do que entra nas contas.`;

  return (
    <Section icon={Wallet} title="Fluxo das contas" hint="O que entra, o que sai e o que isso diz">
      <Card style={{ padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={12} color={white(0.62)}>Comprometido do que entrou</Text>
            <Text weight="extrabold" size={32} tabular color={burn >= 1 ? colors.red : burn >= 0.85 ? colors.amber : "#fff"} style={{ letterSpacing: -0.6 }}>{Math.round(Math.min(burn, 9.99) * 100)}%</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text size={12} color={white(0.62)}>Resultado do mês</Text>
            <Text weight="bold" size={16} tabular color={f.net < 0 ? colors.red : colors.green}>{brl(f.net)}</Text>
          </View>
        </View>
        <View style={{ marginTop: 16 }}><ProgressBar ratio={Math.min(burn, 1)} color="rgba(248,113,113,0.8)" height={12} track={white(0.06)} /></View>
        <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
          <Text size={11.5} color={white(0.62)} tabular>Entrou {brl(f.income)}</Text>
          <Text size={11.5} color={white(0.62)} tabular>Saiu {brl(f.expense)}</Text>
        </View>
        <View style={{ marginTop: 16, gap: 6, borderTopWidth: 1, borderTopColor: white(0.06), paddingTop: 12 }}>
          {readings.map((r, i) => <Bullet key={i}>{r}</Bullet>)}
        </View>
        <View style={{ marginTop: 12 }}><Verdict hex={burn >= 1 ? "#F87171" : burn >= 0.85 ? "#FCD34D" : "#C8F36D"}>{verdict}</Verdict></View>
      </Card>
    </Section>
  );
}

function Lessons({ data }: { data: RaioXData }) {
  if (data.lessons.length === 0) return null;
  return (
    <Section icon={GraduationCap} title="O que este mês ensinou" hint="Padrões que aparecem no seu histórico">
      <Card style={{ padding: 16, gap: 10 }}>
        {data.lessons.map((l, i) => <Bullet key={i}>{l}</Bullet>)}
      </Card>
    </Section>
  );
}
