import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getInvoices, getInvoiceItems, getInvoicePayments, type InvoicePayment } from "@/services/invoiceService";
import { getAccounts, getCreditCards } from "@/services/transactionService";
import { readInvoice, type InvoiceLine } from "@/lib/invoice/readModel";
import { cardHex as hexFor } from "@/hooks/useCardsOverview";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import { InvoiceLineRow } from "~/components/fatura/InvoiceRecentCard";
import LineDetail from "~/components/fatura/LineDetail";
import CountUp from "~/components/CountUp";
import MonthStrip from "~/components/MonthStrip";
import { mergeEntries, PaymentDetail, PaymentRow, paymentName } from "~/components/fatura/InvoicePayments";
import SegmentedTabs from "~/components/SegmentedTabs";
import { Search } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * The whole statement.
 *
 * The panel shows the last few; this is every line of one invoice, with the one
 * division that actually changes what you are looking at: what is an instalment of
 * something bought earlier, and what was bought outright this month. The totals of
 * the two sit above the list, because the split is the answer and the list is the
 * evidence for it.
 */

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export default function Lancamentos() {
  const { cardId, month: qMonth, year: qYear } = useLocalSearchParams<{
    cardId: string;
    month?: string;
    year?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const today = useMemo(() => new Date(), []);
  /* Starts on the invoice the panel was showing; the strip at the top moves it. */
  const [month, setMonth] = useState(Number(qMonth) || today.getMonth() + 1);
  const [year, setYear] = useState(Number(qYear) || today.getFullYear());

  const [invoices, setInvoices] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [closingDay, setClosingDay] = useState<number | null>(null);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [openPayment, setOpenPayment] = useState<InvoicePayment | null>(null);
  const [hex, setHex] = useState("#8B5CF6");
  const [tab, setTab] = useState<"todos" | "parcelados">("todos");
  const [search, setSearch] = useState("");
  const [openLine, setOpenLine] = useState<InvoiceLine | null>(null);
  const [cardName, setCardName] = useState<string | undefined>(undefined);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!cardId || !user) return;
    void (async () => {
      const [cards, invs, accs] = await Promise.all([getCreditCards(), getInvoices(cardId), getAccounts()]);
      if (!alive) return;
      const card = (cards as any[]).find((c) => c.id === cardId);
      if (card) {
        setHex(hexFor(card.color));
        setCardName(card.name);
        setClosingDay(card.closing_day);
      }
      setAccountNames(Object.fromEntries((accs as any[]).map((a) => [a.id, a.name])));
      setInvoices(invs as any[]);
      const invoice = (invs as any[]).find((i) => i.month === month && i.year === year);
      if (!invoice) {
        setItems([]);
        setPayments([]);
        return;
      }
      const [rows, pays] = await Promise.all([getInvoiceItems(invoice.id), getInvoicePayments(invoice.id)]);
      if (!alive) return;
      setItems(rows as any[]);
      setPayments(pays);
    })();
    return () => {
      alive = false;
    };
  }, [cardId, user, month, year, reload]);

  const { lines } = useMemo(() => readInvoice(items), [items]);

  const split = useMemo(() => {
    let parcelado = 0;
    let avista = 0;
    for (const line of lines) {
      if (line.amount < 0) continue;
      if (line.installment) parcelado += line.amount;
      else avista += line.amount;
    }
    return { parcelado, avista };
  }, [lines]);

  const nameOf = (pay: InvoicePayment) => paymentName(pay, month, year, closingDay);
  /* Purchases and payments together, newest at the top. */
  const shown = useMemo(
    () =>
      mergeEntries(lines, tab === "parcelados" ? [] : payments, Object.fromEntries(items.map((i) => [i.id, i.created_at]))).filter((entry) => {
        if (entry.kind === "line" && tab === "parcelados" && !entry.line.installment) return false;
        const name = entry.kind === "line" ? entry.line.name : nameOf(entry.payment);
        if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, payments, items, tab, search, closingDay, month, year],
  );

  const parceladoCount = lines.filter((l) => l.installment).length;

  const current = invoices.find((i) => i.month === month && i.year === year);
  const total = current ? Number(current.total_amount) : lines.reduce((sum, l) => sum + l.amount, 0);
  const paid = current ? Number(current.paid_amount ?? 0) : 0;
  /* What the invoice asks for now — what the bank shows: purchases less what was paid. */
  const due = Math.max(0, total - paid);

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back, and which invoice — on one line, as the transactions page has it. */}
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <BackButton />
          <MonthStrip
            month={month - 1}
            year={year}
            onChange={(m, y) => {
              setMonth(m + 1);
              setYear(y);
              setTab("todos");
              setSearch("");
            }}
          />
        </View>

        <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Lançamentos</Text>

        {/* What the invoice asks for now, and how many lines make it. */}
        <View style={{ marginTop: 18, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 13, color: INK.soft }}>
            Fatura de {MONTH_NAMES[month - 1]} de {year}
          </Text>
          <CountUp value={due} numberOfLines={1} style={{ marginTop: 4, fontSize: 38, fontWeight: "800", letterSpacing: -1.5, color: "#fff", fontVariant: ["tabular-nums"] }} />
          <Text style={{ marginTop: 2, fontSize: 13, color: INK.softer }}>
            {lines.length} {lines.length === 1 ? "lançamento" : "lançamentos"}
          </Text>
        </View>

        {/* How it divides, each half marked by its own dot. */}
        <View style={{ marginTop: 18, flexDirection: "row", gap: 16, paddingHorizontal: 4 }}>
          <SplitFigure dot="#A78BFA" label="Parcelado" value={split.parcelado} />
          <SplitFigure dot="#7CC4FF" label="À vista" value={split.avista} />
        </View>

        <View style={{ marginTop: 20 }}>
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { key: "todos" as const, label: `Todos (${lines.length})` },
              { key: "parcelados" as const, label: `Parcelados (${parceladoCount})` },
            ]}
          />
        </View>

        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            height: 44,
            borderRadius: 999,
            paddingHorizontal: 16,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <Search size={15} color={INK.softer} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar lançamento..."
            placeholderTextColor={INK.faint}
            style={{ flex: 1, minWidth: 0, fontSize: 14.5, color: "#fff" }}
          />
        </View>

        <View style={{ marginTop: 14 }}>
          {shown.length === 0 ? (
            <Text style={{ marginTop: 24, textAlign: "center", fontSize: 14, color: INK.softer }}>
              {lines.length === 0 ? "Nenhum lançamento nesta fatura." : "Nada encontrado."}
            </Text>
          ) : (
            shown.map((entry) =>
              entry.kind === "line" ? (
                <InvoiceLineRow key={entry.line.id} line={entry.line} onPress={() => setOpenLine(entry.line)} />
              ) : (
                <PaymentRow
                  key={entry.payment.id}
                  payment={entry.payment}
                  name={nameOf(entry.payment)}
                  accountName={entry.payment.account_id ? accountNames[entry.payment.account_id] : undefined}
                  onPress={() => setOpenPayment(entry.payment)}
                />
              ),
            )
          )}
        </View>
      </ScrollView>

      <PaymentDetail
        payment={openPayment}
        name={openPayment ? nameOf(openPayment) : ""}
        cardName={cardName}
        onClose={() => setOpenPayment(null)}
        onChanged={() => setReload((n) => n + 1)}
      />

      <LineDetail line={openLine} cardName={cardName} onClose={() => setOpenLine(null)} onChanged={() => setReload((n) => n + 1)} />
    </Room>
  );
}

function SplitFigure({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
        <Text style={{ fontSize: 12, color: INK.softer }}>{label}</Text>
      </View>
      <CountUp value={value} numberOfLines={1} style={{ marginTop: 3, fontSize: 15.5, fontWeight: "700", letterSpacing: -0.3, color: "#fff", fontVariant: ["tabular-nums"] }} />
    </View>
  );
}
