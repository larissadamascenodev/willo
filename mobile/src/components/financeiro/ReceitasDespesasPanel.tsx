import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { getFinancialSummary, type RawTransaction } from "@/lib/financeEngine";
import { MONTH_NAMES } from "@/lib/projectionRows";
import { categoryHex } from "@/lib/categoryData";
import SegmentedTabs from "~/components/SegmentedTabs";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What came in and what went out, in the month.
 *
 * The month's two totals first, side by side. Under them one side at a time — receitas
 * or despesas — split the way people think about their money: what is fixed, the
 * salary and the bills and the installments that come every month whatever happens,
 * and what varies. Each group says its total and then every entry in it.
 *
 * It reads the same month the home does — the same entries, the same cards counted only
 * when their invoice is in this month — so the totals here are the ones on the home's card.
 * Money put into a caixinha is not here: it is not spent, only moved.
 */

type Side = "receitas" | "despesas";

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const RULE = "rgba(255,255,255,0.08)";
const SHOWN = 6;

/** Fixed: comes every month whatever happens — recurring, or an installment already agreed. */
const isFixed = (t: RawTransaction) => t.recurrence_type === "fixa" || t.recurrence_type === "parcelado";

interface Month {
  receitas: RawTransaction[];
  despesas: RawTransaction[];
  /** Accounts opened this month count their opening balance as income on the home. */
  openingIncome: number;
}

export default function ReceitasDespesasPanel() {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [side, setSide] = useState<Side>("despesas");
  const [data, setData] = useState<Month | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setFailed(false);
    try {
      const { summary, transactions, invoicesDetail } = await getFinancialSummary(month, year, { includeHistorical: false, userId: user.id });
      /* A card's purchases count in the month its invoice is, as on the home. */
      const cardsWithInvoice = new Set(
        (invoicesDetail as { credit_card_id: string; total_amount: number }[])
          .filter((inv) => Number(inv.total_amount) > 0)
          .map((inv) => inv.credit_card_id),
      );
      const counted = transactions.filter((t) =>
        t.payment_method === "cartao" && t.credit_card_id ? cardsWithInvoice.has(t.credit_card_id) : true,
      );
      const receitas = counted.filter((t) => t.type === "receita");
      const despesas = counted.filter((t) => t.type === "despesa");
      const listed = receitas.reduce((s, t) => s + Number(t.amount), 0);
      setData({ receitas, despesas, openingIncome: Math.max(0, Number(summary.income) - listed) });
    } catch {
      setFailed(true);
    }
  }, [user, month, year]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  useEffect(() => {
    const again = () => void load();
    window.addEventListener("finance-data-changed", again);
    return () => window.removeEventListener("finance-data-changed", again);
  }, [load]);

  const step = (by: number) => {
    const d = new Date(year, month + by, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };

  const totals = useMemo(() => {
    if (!data) return null;
    const sum = (list: RawTransaction[]) => list.reduce((s, t) => s + Number(t.amount), 0);
    return { receitas: sum(data.receitas) + data.openingIncome, despesas: sum(data.despesas) };
  }, [data]);

  const list = data ? data[side] : [];
  const fixed = list.filter(isFixed);
  const varied = list.filter((t) => !isFixed(t));
  const isReceita = side === "receitas";

  return (
    <View style={{ marginTop: 18 }}>
      {/* ══ Which month ══ */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable accessibilityLabel="Mês anterior" onPress={() => step(-1)} hitSlop={10} style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}>
          <ChevronLeft size={20} color="rgba(255,255,255,0.8)" strokeWidth={2.2} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
          {MONTH_NAMES[month]} {year !== now.getFullYear() ? year : ""}
        </Text>
        <Pressable accessibilityLabel="Próximo mês" onPress={() => step(1)} hitSlop={10} style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}>
          <ChevronRight size={20} color="rgba(255,255,255,0.8)" strokeWidth={2.2} />
        </Pressable>
      </View>

      {failed ? (
        <Text style={{ marginTop: 40, textAlign: "center", fontSize: 14, color: INK.soft }}>Não foi possível carregar o mês. Puxe para tentar de novo.</Text>
      ) : !data || !totals ? (
        <View style={{ marginTop: 18, gap: 12 }}>
          <View style={{ height: 76, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.04)" }} />
          <View style={{ height: 220, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.04)" }} />
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(260)}>
          {/* ══ The two totals ══ */}
          <View style={{ marginTop: 16, flexDirection: "row" }}>
            <Total label="Receitas" value={totals.receitas} dot={GREEN} />
            <View style={{ width: 1, marginHorizontal: 16, backgroundColor: RULE }} />
            <Total label="Despesas" value={totals.despesas} dot={RED} />
          </View>

          <View style={{ marginTop: 20 }}>
            <SegmentedTabs
              value={side}
              onChange={setSide}
              options={[
                { key: "despesas" as const, label: "Despesas" },
                { key: "receitas" as const, label: "Receitas" },
              ]}
            />
          </View>

          <Group
            key={`${side}-fixas`}
            title={isReceita ? "Fixas" : "Fixas e parcelas"}
            hint={isReceita ? "Salário e o que entra todo mês" : "Contas, assinaturas e parcelas"}
            items={fixed}
            receita={isReceita}
          />
          <Group
            key={`${side}-variaveis`}
            title="Variáveis"
            hint={isReceita ? "O que entrou só neste mês" : "Os gastos do dia a dia"}
            items={varied}
            receita={isReceita}
            extra={isReceita && data.openingIncome > 0.5 ? { name: "Saldo inicial das contas", amount: data.openingIncome } : undefined}
          />
        </Animated.View>
      )}
    </View>
  );
}

function Total({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
        <Text style={{ fontSize: 12.5, color: INK.soft }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[{ marginTop: 4, fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: "#fff" }, nums]}>
        {money(value)}
      </Text>
    </View>
  );
}

/** One group: its name and total, then each entry in it, longest first only when asked. */
function Group({
  title,
  hint,
  items,
  receita,
  extra,
}: {
  title: string;
  hint: string;
  items: RawTransaction[];
  receita: boolean;
  /** A line that is not an entry, like the opening balance of a new account. */
  extra?: { name: string; amount: number };
}) {
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => [...items].sort((a, b) => b.date.localeCompare(a.date)), [items]);
  const total = items.reduce((s, t) => s + Number(t.amount), 0) + (extra?.amount ?? 0);
  const shown = all ? sorted : sorted.slice(0, SHOWN);
  const empty = items.length === 0 && !extra;

  return (
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: RULE }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={T.eyebrow}>{title}</Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: INK.softer }}>{hint}</Text>
        </View>
        <Text style={[{ fontSize: 16, fontWeight: "800", color: "#fff" }, nums]}>{money(total)}</Text>
      </View>

      {empty ? (
        <Text style={{ paddingVertical: 18, fontSize: 13.5, color: INK.softer }}>Nada por aqui neste mês.</Text>
      ) : (
        <>
          {extra && <Line name={extra.name} category="Outros" sub="Conta aberta neste mês" amount={extra.amount} receita />}
          {shown.map((t) => {
            const day = new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
            const kind = t.recurrence_type === "parcelado" ? "Parcela" : t.recurrence_type === "fixa" ? "Fixa" : t.payment_method === "cartao" ? "Cartão" : null;
            return (
              <Line
                key={t.id}
                name={t.name}
                category={t.category}
                sub={[day, kind].filter(Boolean).join(" · ")}
                amount={Number(t.amount)}
                receita={receita}
                pending={t.status === "pendente"}
              />
            );
          })}
          {sorted.length > SHOWN && (
            <Pressable
              onPress={() => setAll((v) => !v)}
              style={({ pressed }) => ({ marginTop: 6, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: pressed ? 0.6 : 1 })}
            >
              {all ? <ChevronUp size={15} color={INK.soft} /> : <ChevronDown size={15} color={INK.soft} />}
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: INK.soft }}>{all ? "Mostrar menos" : `Ver todas (${sorted.length})`}</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

function Line({
  name,
  category,
  sub,
  amount,
  receita,
  pending = false,
}: {
  name: string;
  category: string;
  sub: string;
  amount: number;
  receita: boolean;
  pending?: boolean;
}) {
  const Icon = categoryIcon(category);
  const hex = categoryHex(category);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
        <Icon size={18} color={chipInk(hex)} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>{name}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>
          {sub}
          {pending ? <Text style={{ color: AMBER }}>{sub ? " · " : ""}{receita ? "a receber" : "a pagar"}</Text> : null}
        </Text>
      </View>
      <Text style={[{ fontSize: 15, fontWeight: "600", color: receita ? GREEN : "#fff" }, nums]}>
        {receita ? "+" : "−"}
        {money(Math.abs(amount))}
      </Text>
    </View>
  );
}
