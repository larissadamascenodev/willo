import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getCategoryHexColor, getCategoryIcon } from "@/lib/categoryUtils";
import { useCashFlow, periodStart, sumFlow, toDateKey, type CashFlowEntry, type CashFlowPeriod } from "@/hooks/useCashFlow";
import { MONTH_NAMES, useMoney } from "@/components/projecoes/shared";
import { Button, Chip, PageHeader, Screen, SectionTitle, Segmented, Text, colors, white } from "~/ui";

const SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
type Sub = "geral" | "entradas" | "saidas";

interface Bucket { key: string; label: string; entradas: number; saidas: number; isCurrent: boolean }

function buildBuckets(entries: CashFlowEntry[], period: CashFlowPeriod): Bucket[] {
  const now = new Date();
  if (period === "mes") {
    const days = now.getDate();
    return Array.from({ length: days }, (_, i) => {
      const key = toDateKey(new Date(now.getFullYear(), now.getMonth(), i + 1));
      const { entradas, saidas } = sumFlow(entries.filter((e) => e.date === key));
      return { key, label: String(i + 1).padStart(2, "0"), entradas, saidas, isCurrent: i + 1 === days };
    });
  }
  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    const prefix = toDateKey(d).slice(0, 7);
    const { entradas, saidas } = sumFlow(entries.filter((e) => e.date.startsWith(prefix)));
    return { key: prefix, label: SHORT[d.getMonth()], entradas, saidas, isCurrent: i === months - 1 };
  });
}

const HEIGHT = 200;

function Bar({ value, max, width, colors: grad, onPress, dotted }: { value: number; max: number; width: number; colors: [string, string]; onPress: () => void; dotted: boolean }) {
  if (value <= 0) {
    return dotted
      ? <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: white(0.25) }} />
      : <View style={{ width, height: 2, borderRadius: 1, backgroundColor: grad[1], opacity: 0.6 }} />;
  }
  return (
    <Pressable onPress={onPress} style={{ width, height: Math.max((value / max) * HEIGHT, width), borderRadius: 999, overflow: "hidden" }}>
      <LinearGradient colors={grad} style={{ flex: 1 }} />
    </Pressable>
  );
}

/** Fluxo de caixa: o que já entrou e saiu das contas, dia a dia e mês a mês. */
export default function FluxoDeCaixa() {
  const router = useRouter();
  const { fmt, hidden } = useMoney();
  const { entries, loading } = useCashFlow();
  const [sub, setSub] = useState<Sub>("geral");
  const [period, setPeriod] = useState<CashFlowPeriod>("mes");
  const scroller = useRef<ScrollView>(null);

  const inPeriod = useMemo(() => {
    const from = toDateKey(periodStart(period));
    return entries.filter((e) => e.date >= from);
  }, [entries, period]);
  const totals = useMemo(() => sumFlow(inPeriod), [inPeriod]);
  const buckets = useMemo(() => buildBuckets(inPeriod, period), [inPeriod, period]);
  const latest = useMemo(() => inPeriod.filter((e) => sub === "geral" || (sub === "entradas" ? e.kind === "entrada" : e.kind === "saida")).slice(0, 6), [inPeriod, sub]);

  const single = sub !== "geral";
  const max = Math.max(...buckets.map((b) => (sub === "entradas" ? b.entradas : sub === "saidas" ? b.saidas : Math.max(b.entradas, b.saidas))), 1);
  const scrollable = period === "mes" || period === "1a";
  const slot = single ? 52 : 58;
  const barW = single ? 44 : 20;

  useEffect(() => { setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 50); }, [buckets, sub, period]);

  const headline = sub === "geral" ? totals.net : sub === "entradas" ? totals.entradas : totals.saidas;
  const subject = sub === "geral" ? "Fluxo geral" : sub === "entradas" ? "Entradas" : "Saídas";
  const title = period === "mes" ? `${subject} em ${MONTH_NAMES[new Date().getMonth()]}` : period === "1a" ? `${subject} no último ano` : `${subject} nos últimos ${period === "3m" ? 3 : 6} meses`;

  const chart = (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: scrollable ? 12 : 24, justifyContent: scrollable ? "flex-start" : "center", minWidth: scrollable ? undefined : "100%" }}>
      {buckets.map((b) => (
        <View key={b.key} style={{ width: slot, alignItems: "center" }}>
          <View style={{ height: HEIGHT, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
            {sub !== "saidas" && <Bar value={b.entradas} max={max} width={barW} colors={["#D9FF72", "#A8E63A"]} dotted={period === "mes"} onPress={() => setSub("entradas")} />}
            {sub !== "entradas" && <Bar value={b.saidas} max={max} width={barW} colors={["#FF8080", "#EF4444"]} dotted={period === "mes"} onPress={() => setSub("saidas")} />}
          </View>
          <Text size={13} tabular weight={b.isCurrent ? "semibold" : "regular"} color={b.isCurrent ? "#fff" : white(0.62)} style={{ marginTop: 12 }}>{b.label}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <Screen onRefresh={async () => {}}>
      <PageHeader title="Fluxo de caixa" subtitle="O que já entrou e saiu" />

      <View style={{ marginTop: 24, flexDirection: "row", gap: 8 }}>
        {([["geral", "Geral"], ["entradas", "Entradas"], ["saidas", "Saídas"]] as const).map(([k, l]) => <Chip key={k} label={l} on={sub === k} onPress={() => setSub(k)} />)}
      </View>

      <View style={{ marginTop: 20 }}>
        <Text size={14} color={white(0.66)}>{title}</Text>
        <Text weight="extrabold" size={34} tabular numberOfLines={1} style={{ letterSpacing: -0.8 }}>
          {loading ? "…" : `${sub === "geral" && headline < 0 && !hidden ? "-" : ""}${fmt(Math.abs(headline))}`}
        </Text>
        {sub === "geral" && (
          <View style={{ marginTop: 8, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green }} /><Text size={14} color={white(0.74)} tabular>Entradas {fmt(totals.entradas)}</Text></View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" }} /><Text size={14} color={white(0.74)} tabular>Saídas {fmt(totals.saidas)}</Text></View>
          </View>
        )}
        <Text size={12} color={white(0.56)} style={{ marginTop: 12, lineHeight: 17 }}>Considera só o dinheiro que entrou e saiu das contas. Compras no cartão entram quando a fatura é paga.</Text>
      </View>

      <View style={{ marginTop: 24 }}>
        {scrollable ? (
          <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16 }}>{chart}</ScrollView>
        ) : chart}
      </View>

      <View style={{ marginTop: 24 }}>
        <Segmented<CashFlowPeriod> options={[{ key: "mes", label: "Este mês" }, { key: "3m", label: "3m" }, { key: "6m", label: "6m" }, { key: "1a", label: "1a" }]} value={period} onChange={setPeriod} />
      </View>

      <SectionTitle>{sub === "geral" ? "Últimos lançamentos" : sub === "entradas" ? "Últimas entradas" : "Últimas saídas"}</SectionTitle>
      {latest.length === 0 ? (
        <Text size={14} color={white(0.56)} align="center" style={{ paddingVertical: 32 }}>Nada por aqui neste período</Text>
      ) : (
        latest.map((e) => {
          const Icon = getCategoryIcon(e.category);
          const hex = getCategoryHexColor(e.category);
          const isIn = e.kind === "entrada";
          const date = new Date(`${e.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
          return (
            <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#1C1C1C" }}><Icon size={20} color={hex} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="semibold" size={16} numberOfLines={1}>{e.name}</Text>
                <Text size={13} color={white(0.62)} numberOfLines={1}>{date} · {e.category}{e.accountName ? ` · ${e.accountName}` : ""}</Text>
              </View>
              <Text weight="semibold" size={15} tabular color={isIn ? colors.green : "#F87171"}>{hidden ? fmt(0) : `${isIn ? "+" : "-"}${fmt(e.amount)}`}</Text>
            </View>
          );
        })
      )}
      <Button label="Ver todos os lançamentos" variant="glass" height={52} style={{ marginTop: 16 }} onPress={() => router.push("/transacoes")} />
    </Screen>
  );
}
