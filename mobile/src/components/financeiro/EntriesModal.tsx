import { useCallback, useEffect, useState } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { getFinancialSummary, type RawTransaction } from "@/lib/financeEngine";
import { MONTH_NAMES } from "@/lib/projectionRows";
import { categoryHex } from "@/lib/categoryData";
import CenterModal from "~/components/CenterModal";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";

/**
 * One side of the month — receitas or despesas — lifted into a pane in the middle of the screen.
 *
 * Its total, one bar of how much of it is fixed (the salary, the bills, the installments
 * that come every month whatever happens) and how much varies, and then the two parts
 * written out, each with its own total and every entry in it.
 *
 * It reads the same month the home does — the same entries, the same cards counted only
 * when their invoice is in this month — so the totals here are the ones on the page.
 * Money put into a caixinha is not here: it is not spent, only moved.
 */

export type Side = "receitas" | "despesas";

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

export default function EntriesModal({
  side,
  month,
  year,
  onClose,
}: {
  side: Side | null;
  month: number;
  year: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<Month | null>(null);
  const [failed, setFailed] = useState(false);
  /* The side stays drawn while the pane leaves, rather than going blank under it. */
  const [shown, setShown] = useState<Side>("despesas");
  useEffect(() => {
    if (side) setShown(side);
  }, [side]);

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

  /* Read when opened, so it is always the month as it is now. */
  useEffect(() => {
    if (!side) return;
    setData(null);
    void load();
  }, [side, load]);

  const receita = shown === "receitas";
  const list = data ? data[shown] : [];
  const fixed = list.filter(isFixed);
  const varied = list.filter((t) => !isFixed(t));
  const extra = receita && data && data.openingIncome > 0.5 ? data.openingIncome : 0;
  const sum = (l: RawTransaction[]) => l.reduce((s, t) => s + Number(t.amount), 0);
  const a = sum(fixed);
  const b = sum(varied) + extra;
  const total = a + b;
  const tone = receita ? GREEN : RED;

  return (
    <CenterModal
      open={!!side}
      onClose={onClose}
      title={receita ? "Receitas" : "Despesas"}
      subtitle={`${MONTH_NAMES[month]}${year !== new Date().getFullYear() ? ` de ${year}` : ""}`}
    >
      {failed ? (
        <Text style={{ paddingVertical: 30, textAlign: "center", fontSize: 14, color: INK.soft }}>Não foi possível carregar o mês.</Text>
      ) : !data ? (
        <View style={{ gap: 10, paddingVertical: 6 }}>
          <View style={{ height: 40, width: "60%", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)" }} />
          <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.05)" }} />
          <View style={{ height: 160, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)" }} />
        </View>
      ) : (
        <View>
          {/* ══ The total, and how much of it is fixed ══ */}
          <Text style={[{ fontSize: 34, fontWeight: "800", letterSpacing: -1.2, color: "#fff" }, nums]}>{money(total)}</Text>
          <View style={{ marginTop: 12, height: 8, borderRadius: 4, overflow: "hidden", flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)" }}>
            {total > 0 && (
              <>
                <View style={{ width: `${(a / total) * 100}%`, backgroundColor: tone }} />
                <View style={{ flex: 1, backgroundColor: `${tone}55` }} />
              </>
            )}
          </View>
          <View style={{ marginTop: 12, flexDirection: "row" }}>
            <Part dot={tone} label={receita ? "Fixas" : "Fixas e parcelas"} value={a} />
            <View style={{ width: 1, marginHorizontal: 14, backgroundColor: RULE }} />
            <Part dot={`${tone}55`} label="Variáveis" value={b} />
          </View>

          {/* ══ The two parts, written out ══ */}
          <Group title={receita ? "Fixas" : "Fixas e parcelas"} hint={receita ? "Salário e o que entra todo mês" : "Contas, assinaturas e parcelas"} items={fixed} receita={receita} />
          <Group title="Variáveis" hint={receita ? "O que entrou só neste mês" : "Os gastos do dia a dia"} items={varied} receita={receita} extra={extra} />
        </View>
      )}
    </CenterModal>
  );
}

function Part({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
        <Text style={{ fontSize: 12.5, color: INK.soft }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[{ marginTop: 3, fontSize: 17, fontWeight: "700", color: "#fff" }, nums]}>
        {money(value)}
      </Text>
    </View>
  );
}

function Group({ title, hint, items, receita, extra = 0 }: { title: string; hint: string; items: RawTransaction[]; receita: boolean; extra?: number }) {
  const sorted = [...items].sort((x, y) => y.date.localeCompare(x.date));
  const total = items.reduce((s, t) => s + Number(t.amount), 0) + extra;
  return (
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: RULE }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{title}</Text>
          <Text style={{ marginTop: 1, fontSize: 12, color: INK.softer }}>{hint}</Text>
        </View>
        <Text style={[{ fontSize: 15, fontWeight: "800", color: "#fff" }, nums]}>{money(total)}</Text>
      </View>
      {items.length === 0 && !extra ? (
        <Text style={{ paddingVertical: 14, fontSize: 13.5, color: INK.softer }}>Nada por aqui neste mês.</Text>
      ) : (
        <>
          {extra > 0 && <Line name="Saldo inicial das contas" category="Outros" sub="Conta aberta neste mês" amount={extra} receita />}
          {sorted.map((t) => {
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
        <Icon size={16} color={chipInk(hex)} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: "#fff" }}>{name}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: INK.soft }}>
          {sub}
          {pending ? <Text style={{ color: AMBER }}>{sub ? " · " : ""}{receita ? "a receber" : "a pagar"}</Text> : null}
        </Text>
      </View>
      <Text style={[{ fontSize: 14.5, fontWeight: "600", color: receita ? GREEN : "#fff" }, nums]}>
        {receita ? "+" : "−"}
        {money(Math.abs(amount))}
      </Text>
    </View>
  );
}
