import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowRight, CalendarDays, ChevronRight, Info, TrendingDown, TrendingUp } from "lucide-react-native";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { MONTH_NAMES, MONTH_SHORT, useMoney } from "@/components/projecoes/shared";
import { BalanceTrendChart } from "~/features/projecoes/BalanceTrendChart";
import { FutureMonthCard, type ProjectionRow } from "~/features/projecoes/FutureMonthCard";
import { MonthBalanceCard } from "~/features/projecoes/MonthBalanceCard";
import { Button, Glass, PageHeader, Screen, SectionTitle, Text, white, colors } from "~/ui";

const keyOf = (r: { month: number; year: number }) => `${r.month}-${r.year}`;

/**
 * Uma tela só para o dinheiro à frente: o mês em que estamos, como balanço, e os meses
 * seguintes com o que já está fixo, parcelas e faturas. Parte sempre de hoje.
 * Cada mês soma só o que está cadastrado nas transações; mês vazio fica zerado.
 */
export default function Projecoes() {
  const router = useRouter();
  const { compact } = useMoney();
  const today = new Date();
  const { projections, data, loading, monthDataMap, futureReady } = useFinancialProjection({ month: today.getMonth(), year: today.getFullYear() });
  const [expanded, setExpanded] = useState<string | null>(null);

  const scroll = useRef<ScrollView>(null);
  const listY = useRef(0);
  const cardY = useRef<Record<string, number>>({});
  const topY = useRef(0);

  const rows: ProjectionRow[] = useMemo(
    () =>
      projections.map((p, i) => ({
        month: p.month,
        year: p.year,
        income: p.income,
        expense: p.expense,
        delta: p.delta,
        balance: p.balance,
        prevBalance: i > 0 ? projections[i - 1].balance : data.previousMonthEndingBalance,
        risk: p.risk,
        // o mês em andamento sempre tem os próprios números; os seguintes ficam vazios se nada foi cadastrado
        empty: i > 0 && p.income === 0 && p.expense === 0,
        short: MONTH_SHORT[p.month],
        yearTag: p.year !== today.getFullYear() ? String(p.year).slice(2) : "",
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projections, data.previousMonthEndingBalance],
  );
  const ahead = rows.slice(1);

  const pickMonth = useCallback((i: number) => {
    const target = rows[i];
    if (!target) return;
    const key = keyOf(target);
    setExpanded(i === 0 ? null : key);
    const y = i === 0 ? topY.current : listY.current + (cardY.current[key] ?? 0);
    // espera o cartão abrir para a rolagem cair na posição final
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }));
  }, [rows]);

  if (loading) {
    return (
      <Screen>
        <PageHeader title="Projeções" subtitle="Este mês e os próximos" />
        <View style={{ marginTop: 24, gap: 12 }}>
          <View style={{ height: 288, borderRadius: 28, backgroundColor: white(0.06) }} />
          <View style={{ height: 176, borderRadius: 22, backgroundColor: white(0.06) }} />
        </View>
      </Screen>
    );
  }

  if ((!data.transactions.length && !data.events.length) || rows.length === 0) {
    return (
      <Screen>
        <PageHeader title="Projeções" subtitle="Este mês e os próximos" />
        <View style={{ marginTop: 40, alignItems: "center", paddingHorizontal: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: white(0.12), backgroundColor: white(0.05), alignItems: "center", justifyContent: "center" }}>
            <CalendarDays size={32} color={white(0.56)} />
          </View>
          <Text weight="bold" size={18} style={{ marginTop: 20 }}>Ainda sem dados suficientes</Text>
          <Text size={14} color={white(0.62)} align="center" style={{ marginTop: 4 }}>Adicione transações para ver suas projeções.</Text>
          <View style={{ marginTop: 20 }}>
            <Button label="Ver transações" height={44} onPress={() => router.push("/transacoes")} />
          </View>
        </View>
      </Screen>
    );
  }

  const last = rows[rows.length - 1];
  const growth = last.balance - data.saldoAtual;
  const firstNegative = rows.find((r) => r.balance < 0);
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.balance)), 1);
  const selectedIdx = expanded ? rows.findIndex((r) => keyOf(r) === expanded) : null;

  const headline = firstNegative
    ? `Com o que já está cadastrado, seu saldo fica negativo a partir de ${MONTH_NAMES[firstNegative.month].toLowerCase()}. Dá tempo de mudar isso.`
    : growth >= 0
      ? `Com o que já está cadastrado, você termina com ${compact(last.balance)} em ${MONTH_NAMES[last.month].toLowerCase()}.`
      : `Com o que já está cadastrado, seu saldo encolhe ${compact(Math.abs(growth))} até ${MONTH_NAMES[last.month].toLowerCase()}.`;

  return (
    <Screen scrollRef={scroll}>
      <PageHeader title="Projeções" subtitle="Este mês e os próximos" />

      <View onLayout={(e) => (topY.current = e.nativeEvent.layout.y)}>
        <MonthBalanceCard data={data} month={today.getMonth()} year={today.getFullYear()} />
      </View>

      <SectionTitle>Para onde seu saldo vai</SectionTitle>
      {!futureReady ? (
        <View style={{ gap: 12 }}>
          <View style={{ height: 176, borderRadius: 28, backgroundColor: white(0.06) }} />
          <View style={{ height: 208, borderRadius: 22, backgroundColor: white(0.06) }} />
        </View>
      ) : (
        <>
          <Animated.View entering={FadeInDown.duration(350)}>
            <Glass radius={28} style={{ padding: 20, borderColor: white(0.12) }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flexShrink: 1 }}>
                  <Text size={12} color={white(0.62)}>Hoje</Text>
                  <Text weight="bold" size={20} tabular numberOfLines={1}>{compact(data.saldoAtual)}</Text>
                </View>
                <ArrowRight size={20} color={white(0.45)} style={{ marginBottom: 6 }} />
                <View style={{ flexShrink: 1, alignItems: "flex-end" }}>
                  <Text size={12} color={white(0.62)} numberOfLines={1}>{MONTH_NAMES[last.month]}{last.yearTag ? `/${last.yearTag}` : ""}</Text>
                  <Text weight="extrabold" size={30} tabular numberOfLines={1} color={last.balance < 0 ? colors.red : "#fff"} style={{ letterSpacing: -0.6 }}>
                    {compact(last.balance)}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: 12, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: white(0.08), paddingHorizontal: 12, paddingVertical: 6 }}>
                {growth >= 0 ? <TrendingUp size={14} color={colors.green} /> : <TrendingDown size={14} color={colors.red} />}
                <Text size={13} weight="semibold" tabular color={growth >= 0 ? colors.green : colors.red}>{growth >= 0 ? "+" : "−"}{compact(Math.abs(growth))}</Text>
                <Text size={12} color={white(0.66)}>até {MONTH_SHORT[last.month]}</Text>
              </View>

              <Text size={13} color={white(0.85)} style={{ marginTop: 12, lineHeight: 19, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 14, paddingVertical: 10, overflow: "hidden" }}>
                {headline}
              </Text>
            </Glass>
          </Animated.View>

          <View style={{ marginTop: 12 }}>
            <BalanceTrendChart rows={rows} selectedIdx={selectedIdx} onSelect={pickMonth} maxAbs={maxAbs} />
          </View>
        </>
      )}

      <SectionTitle>Próximos meses</SectionTitle>
      <View style={{ gap: 10 }} onLayout={(e) => (listY.current = e.nativeEvent.layout.y)}>
        {ahead.map((row) => {
          const key = keyOf(row);
          return (
            <FutureMonthCard
              key={key}
              row={row}
              composition={monthDataMap.get(key)?.composition}
              loading={!futureReady && !monthDataMap.has(key)}
              expanded={expanded === key}
              onToggle={() => setExpanded((cur) => (cur === key ? null : key))}
              onLayout={(e) => (cardY.current[key] = e.nativeEvent.layout.y)}
            />
          );
        })}
      </View>

      <Pressable onPress={() => router.push("/fluxo-de-caixa")} style={({ pressed }) => ({ marginTop: 24, opacity: pressed ? 0.8 : 1 })}>
        <Glass radius={22} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16 }}>
          <View>
            <Text size={15} weight="semibold">Fluxo de caixa</Text>
            <Text size={12.5} color={white(0.58)}>O que já entrou e saiu, dia a dia</Text>
          </View>
          <ChevronRight size={20} color={white(0.45)} />
        </Glass>
      </Pressable>

      <View style={{ marginTop: 20, flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 }}>
        <Info size={14} color={white(0.5)} style={{ marginTop: 2 }} />
        <Text size={12} color={white(0.5)} style={{ flex: 1, lineHeight: 17 }}>
          A projeção soma só o que está cadastrado nas suas transações: receitas e despesas futuras, contas fixas, parcelas e faturas. Mês sem nada cadastrado fica zerado, sem valor estimado. Novos lançamentos ajustam o cálculo na hora.
        </Text>
      </View>
    </Screen>
  );
}
