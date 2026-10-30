import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { getFinancialSummary, type RawTransaction } from "@/lib/financeEngine";
import { MONTH_NAMES } from "@/lib/projectionRows";
import { categoryHex } from "@/lib/categoryData";
import BottomSheet from "~/components/BottomSheet";
import { SURFACE_FILL } from "~/components/Surface";
import { ChevronRight } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";

/**
 * What came in and what went out, in the month.
 *
 * Two pieces of glass, receitas and despesas, each with its total, one bar of how much of
 * it is fixed — the salary, the bills, the installments that come every month whatever
 * happens — and how much varies, and those two parts as rows. The entries themselves are
 * not on the page: a row opens them, so the page stays a summary you can take in at once.
 *
 * It reads the same month the home does — the same entries, the same cards counted only
 * when their invoice is in this month — so the totals here are the ones on the home's card.
 * Money put into a caixinha is not here: it is not spent, only moved.
 */

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const RULE = "rgba(255,255,255,0.08)";

/** Fixed: comes every month whatever happens — recurring, or an installment already agreed. */
const isFixed = (t: RawTransaction) => t.recurrence_type === "fixa" || t.recurrence_type === "parcelado";

interface Month {
  receitas: RawTransaction[];
  despesas: RawTransaction[];
  /** Accounts opened this month count their opening balance as income on the home. */
  openingIncome: number;
}

export default function ReceitasDespesasPanel({ month, year }: { month: number; year: number }) {
  const { user } = useAuth();
  const [open, setOpen] = useState<(GroupData & { receita: boolean }) | null>(null);
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

  const sum = (list: RawTransaction[]) => list.reduce((s, t) => s + Number(t.amount), 0);

  return (
    <View>
      {failed ? (
        <Text style={{ marginTop: 40, textAlign: "center", fontSize: 14, color: INK.soft }}>Não foi possível carregar o mês.</Text>
      ) : !data ? (
        <View style={{ gap: 12 }}>
          <View style={{ height: 190, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.04)" }} />
          <View style={{ height: 190, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.04)" }} />
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(260)} style={{ gap: 12 }}>
          <Side
            receita
            title="Receitas"
            tone={GREEN}
            fixed={{ label: "Fixas", hint: "Salário e o que entra todo mês", items: data.receitas.filter(isFixed) }}
            varied={{
              label: "Variáveis",
              hint: "O que entrou só neste mês",
              items: data.receitas.filter((t) => !isFixed(t)),
              extra: data.openingIncome > 0.5 ? data.openingIncome : 0,
            }}
            onOpen={(g) => setOpen({ ...g, receita: true })}
            sum={sum}
          />
          <Side
            receita={false}
            title="Despesas"
            tone={RED}
            fixed={{ label: "Fixas e parcelas", hint: "Contas, assinaturas e parcelas", items: data.despesas.filter(isFixed) }}
            varied={{ label: "Variáveis", hint: "Os gastos do dia a dia", items: data.despesas.filter((t) => !isFixed(t)) }}
            onOpen={(g) => setOpen({ ...g, receita: false })}
            sum={sum}
          />
        </Animated.View>
      )}

      {/* ══ One group's entries, only when asked for ══ */}
      <BottomSheet open={!!open} onClose={() => setOpen(null)} full>
        {open && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <Text style={{ fontSize: 13, color: INK.soft }}>
              {open.receita ? "Receitas" : "Despesas"} · {MONTH_NAMES[month].toLocaleLowerCase("pt-BR")}
            </Text>
            <View style={{ marginTop: 2, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>{open.label}</Text>
              <Text style={[{ fontSize: 20, fontWeight: "800", letterSpacing: -0.5, color: open.receita ? GREEN : "#fff" }, nums]}>
                {money(sum(open.items) + (open.extra ?? 0))}
              </Text>
            </View>
            <View style={{ marginTop: 10 }}>
              {(open.extra ?? 0) > 0 && <Line name="Saldo inicial das contas" category="Outros" sub="Conta aberta neste mês" amount={open.extra ?? 0} receita />}
              {[...open.items]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((t) => {
                  const day = new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
                  const kind = t.recurrence_type === "parcelado" ? "Parcela" : t.recurrence_type === "fixa" ? "Fixa" : t.payment_method === "cartao" ? "Cartão" : null;
                  return (
                    <Line
                      key={t.id}
                      name={t.name}
                      category={t.category}
                      sub={[day, kind].filter(Boolean).join(" · ")}
                      amount={Number(t.amount)}
                      receita={open.receita}
                      pending={t.status === "pendente"}
                    />
                  );
                })}
              {open.items.length === 0 && !(open.extra ?? 0) && (
                <Text style={{ paddingVertical: 24, textAlign: "center", fontSize: 14, color: INK.softer }}>Nada por aqui neste mês.</Text>
              )}
            </View>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

interface GroupData {
  label: string;
  hint: string;
  items: RawTransaction[];
  /** Money counted in the group that is not an entry, like a new account's opening balance. */
  extra?: number;
}

/**
 * One side of the month in a single piece of glass: its total, a bar of how much of it is
 * fixed and how much varies, and the two parts as rows that open their entries.
 */
function Side({
  receita,
  title,
  tone,
  fixed,
  varied,
  onOpen,
  sum,
}: {
  receita: boolean;
  title: string;
  tone: string;
  fixed: GroupData;
  varied: GroupData;
  onOpen: (g: GroupData) => void;
  sum: (l: RawTransaction[]) => number;
}) {
  const a = sum(fixed.items) + (fixed.extra ?? 0);
  const b = sum(varied.items) + (varied.extra ?? 0);
  const total = a + b;
  const share = total > 0 ? a / total : 0;

  return (
    <View style={{ borderRadius: 26, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: SURFACE_FILL, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
        <Text style={{ fontSize: 14, fontWeight: "600", color: INK.soft }}>{title}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[{ marginTop: 4, fontSize: 30, fontWeight: "800", letterSpacing: -1, color: "#fff" }, nums]}>
        {money(total)}
      </Text>

      {/* Fixed against variable, as one bar: the fixed part solid, the rest a lighter shade. */}
      <View style={{ marginTop: 14, height: 6, borderRadius: 3, overflow: "hidden", flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)" }}>
        {total > 0 && (
          <>
            <View style={{ width: `${share * 100}%`, backgroundColor: tone }} />
            <View style={{ flex: 1, backgroundColor: `${tone}55` }} />
          </>
        )}
      </View>

      <View style={{ marginTop: 8 }}>
        <Row group={fixed} value={a} dot={tone} onPress={() => onOpen(fixed)} />
        <Peek items={fixed.items} receita={receita} onMore={() => onOpen(fixed)} />
        <View style={{ height: 1, marginTop: 4, backgroundColor: RULE }} />
        <Row group={varied} value={b} dot={`${tone}55`} onPress={() => onOpen(varied)} last />
        <Peek items={varied.items} receita={receita} onMore={() => onOpen(varied)} />
      </View>
    </View>
  );
}

function Row({ group, value, dot, onPress }: { group: GroupData; value: number; dot: string; onPress: () => void; last?: boolean }) {
  const count = group.items.length + ((group.extra ?? 0) > 0 ? 1 : 0);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 13,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>{group.label}</Text>
        <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: INK.softer }}>
          {count === 0 ? group.hint : `${count} ${count === 1 ? "lançamento" : "lançamentos"}`}
        </Text>
      </View>
      <Text style={[{ fontSize: 16, fontWeight: "700", color: "#fff" }, nums]}>{money(value)}</Text>
      <ChevronRight size={16} color={INK.softer} />
    </Pressable>
  );
}

/** The three largest entries of a group, small, under its row; the rest a tap away. */
function Peek({ items, receita, onMore }: { items: RawTransaction[]; receita: boolean; onMore: () => void }) {
  if (items.length === 0) return null;
  const top = [...items].sort((x, y) => Number(y.amount) - Number(x.amount)).slice(0, 3);
  return (
    <View style={{ paddingLeft: 22, paddingBottom: 8 }}>
      {top.map((t) => {
        const Icon = categoryIcon(t.category);
        const hex = categoryHex(t.category);
        return (
          <View key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
              <Icon size={14} color={chipInk(hex)} strokeWidth={2.2} />
            </View>
            <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 14, color: "rgba(255,255,255,0.82)" }}>{t.name}</Text>
            <Text style={[{ fontSize: 14, fontWeight: "600", color: receita ? GREEN : "rgba(255,255,255,0.82)" }, nums]}>
              {receita ? "+" : "−"}
              {money(Math.abs(Number(t.amount)))}
            </Text>
          </View>
        );
      })}
      {items.length > 3 && (
        <Pressable onPress={onMore} hitSlop={6} style={({ pressed }) => ({ paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: INK.soft }}>Ver todos os {items.length}</Text>
        </Pressable>
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
