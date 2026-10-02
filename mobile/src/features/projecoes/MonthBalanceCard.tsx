import { View } from "react-native";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, Equal } from "lucide-react-native";
import type { DashboardData } from "@/types/finance";
import { GREEN, MONTH_NAMES, RED, useMoney } from "@/components/projecoes/shared";
import { Glass, Surface, Text, white } from "~/ui";
import { tint } from "~/lib/color";

interface Props {
  data: DashboardData;
  month: number;
  year: number;
}

/** Um lado do mês: o que já aconteceu e o que ainda falta, na mesma barra. */
function FlowRow({ label, doneLabel, pendingLabel, done, pending, base, hex, Icon, delay }: {
  label: string; doneLabel: string; pendingLabel: string; done: number; pending: number; base: number; hex: string; Icon: typeof ArrowDownLeft; delay: number;
}) {
  const { fmt } = useMoney();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon size={16} color={hex} strokeWidth={2.5} />
          <Text size={13} color={white(0.74)}>{label}</Text>
        </View>
        <Text weight="bold" size={16} tabular>{fmt(done + pending)}</Text>
      </View>

      {/* sólido = já aconteceu, esmaecido = ainda vem; os dois medidos contra o lado maior */}
      <View style={{ marginTop: 6, height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: white(0.06) }}>
        <View style={{ flexDirection: "row", height: 10 }}>
          <View style={{ width: `${(done / base) * 100}%`, backgroundColor: hex }} />
          <View style={{ width: `${(pending / base) * 100}%`, backgroundColor: tint(hex, 0.33) }} />
        </View>
      </View>

      <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hex }} />
          <Text size={12.5} color={white(0.66)}>{doneLabel} <Text size={12.5} weight="semibold" color={white(0.9)} tabular>{fmt(done)}</Text></Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint(hex, 0.33) }} />
          <Text size={12.5} color={white(0.66)}>{pendingLabel} <Text size={12.5} weight="semibold" color={white(0.9)} tabular>{fmt(pending)}</Text></Text>
        </View>
      </View>
    </View>
  );
}

/** O mês em que estamos, como balanço: o que entrou e o que vai entrar, o que saiu e o que vai sair, e o que sobra. */
export function MonthBalanceCard({ data, month, year }: Props) {
  const { fmt, compact } = useMoney();
  const now = new Date();

  const income = data.receitas;
  const expense = data.despesas;
  const sobra = income - expense;
  const base = Math.max(income, expense, 1);
  const share = income > 0 ? sobra / income : 0;
  const pct = Math.round(share * 100);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getMonth() === month && now.getFullYear() === year ? now.getDate() : daysInMonth;
  const daysLeft = daysInMonth - today;

  const verdict = sobra < 0
    ? `Se nada mudar, o mês fecha ${fmt(-sobra)} no vermelho.`
    : sobra === 0
      ? "Entradas e saídas previstas empatam no mês."
      : share >= 0.2
        ? `Devem sobrar ${pct}% da renda. Mês redondo 👏`
        : `Devem sobrar ${pct >= 1 ? `${pct}%` : "uma fatia pequena"} da renda. Dá pra abrir mais folga segurando os gastos variáveis.`;

  return (
    <View>
      <Text size={13} color={white(0.62)} style={{ marginTop: 24 }}>Balanço de {MONTH_NAMES[month]}</Text>

      <Glass radius={28} style={{ marginTop: 8, padding: 20, borderColor: white(0.12) }}>
        <Text size={13} color={white(0.7)}>{sobra < 0 ? "Falta prevista" : "Sobra prevista"}</Text>
        <Text weight="extrabold" size={42} tabular numberOfLines={1} color={sobra < 0 ? RED : "#fff"} style={{ letterSpacing: -1 }}>
          {fmt(Math.abs(sobra))}
        </Text>
        <Text size={12.5} color={white(0.56)}>no fim de {MONTH_NAMES[month].toLowerCase()}, com o que já está lançado</Text>

        <View style={{ marginTop: 20, gap: 20 }}>
          <FlowRow label="Entradas" doneLabel="Entrou" pendingLabel="A entrar" done={data.receitasRecebidas} pending={data.receitasPendentes} base={base} hex={GREEN} Icon={ArrowDownLeft} delay={150} />
          <FlowRow label="Saídas" doneLabel="Saiu" pendingLabel="A sair" done={data.despesasPagas} pending={data.despesasPendentes} base={base} hex={RED} Icon={ArrowUpRight} delay={270} />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: white(0.12), paddingTop: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Equal size={16} color={white(0.66)} strokeWidth={2.5} />
              <Text size={13} color={white(0.74)}>Balanço do mês</Text>
            </View>
            <Text weight="extrabold" size={18} tabular color={sobra < 0 ? RED : "#C8F36D"}>
              {sobra > 0 ? "+" : ""}{fmt(sobra)}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 14, paddingVertical: 12 }}>
          <View style={{ flexShrink: 1 }}>
            <Text size={11.5} color={white(0.56)}>Saldo hoje</Text>
            <Text weight="bold" size={15} tabular numberOfLines={1}>{compact(data.saldoAtual)}</Text>
          </View>
          <ArrowRight size={16} color={white(0.4)} />
          <View style={{ flexShrink: 1, alignItems: "flex-end" }}>
            <Text size={11.5} color={white(0.56)}>Previsto no fim do mês</Text>
            <Text weight="bold" size={15} tabular numberOfLines={1} color={data.saldoPrevisto < 0 ? RED : "#fff"}>{compact(data.saldoPrevisto)}</Text>
          </View>
        </View>

        <Text size={13} color={white(0.85)} style={{ marginTop: 12, lineHeight: 19 }}>{verdict}</Text>
      </Glass>

      {daysLeft >= 0 && (
        <Surface style={{ marginTop: 12, padding: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <CalendarDays size={16} color={white(0.62)} />
              <Text size={13} color={white(0.74)}>Mês em andamento</Text>
            </View>
            <Text size={12} color={white(0.62)} tabular>{daysLeft} {daysLeft === 1 ? "dia restante" : "dias restantes"}</Text>
          </View>
          <View style={{ marginTop: 10, flexDirection: "row", gap: 2 }}>
            {Array.from({ length: daysInMonth }, (_, d) => (
              <View key={d} style={{ flex: 1, height: 16, borderRadius: 3, backgroundColor: d + 1 < today ? white(0.55) : d + 1 === today ? "#fff" : white(0.08) }} />
            ))}
          </View>
        </Surface>
      )}
    </View>
  );
}
