import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getInvoices, getInvoiceItems } from "@/services/invoiceService";
import { getCreditCards } from "@/services/transactionService";
import { readInvoice, type InvoiceLine } from "@/lib/invoice/readModel";
import { cardHex as hexFor } from "@/hooks/useCardsOverview";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import { InvoiceLineRow } from "~/components/fatura/InvoiceRecentCard";
import LineDetail from "~/components/fatura/LineDetail";
import SegmentedTabs from "~/components/SegmentedTabs";
import { Search } from "~/components/icons";
import { money } from "~/lib/money";
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
  const month = Number(qMonth) || today.getMonth() + 1;
  const year = Number(qYear) || today.getFullYear();

  const [items, setItems] = useState<any[]>([]);
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
      const [cards, invs] = await Promise.all([getCreditCards(), getInvoices(cardId)]);
      if (!alive) return;
      const card = (cards as any[]).find((c) => c.id === cardId);
      if (card) {
        setHex(hexFor(card.color));
        setCardName(card.name);
      }
      const invoice = (invs as any[]).find((i) => i.month === month && i.year === year);
      if (!invoice) {
        setItems([]);
        return;
      }
      const rows = await getInvoiceItems(invoice.id);
      if (alive) setItems(rows as any[]);
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

  const shown = useMemo(
    () =>
      lines.filter((line) => {
        if (tab === "parcelados" && !line.installment) return false;
        if (search && !line.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [lines, tab, search],
  );

  const parceladoCount = lines.filter((l) => l.installment).length;

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
        <View style={{ height: 44, justifyContent: "center" }}>
          <BackButton />
        </View>

        <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Lançamentos</Text>
        <Text style={{ marginTop: 4, paddingHorizontal: 4, fontSize: 13, color: INK.soft }}>
          Fatura de {MONTH_NAMES[month - 1]} de {year}
          <Text style={{ color: "rgba(255,255,255,0.2)" }}> · </Text>
          {lines.length} {lines.length === 1 ? "linha" : "linhas"}
        </Text>

        {/* The split is the answer; the list below is the evidence for it. */}
        <View style={{ marginTop: 20, flexDirection: "row", gap: 16, paddingHorizontal: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={[T.eyebrow, { fontSize: 11 }]}>Parcelado</Text>
            <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 22, fontWeight: "800", letterSpacing: -0.7, color: "#fff" }}>
                {money(split.parcelado)}
              </Text>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#A78BFA" }} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T.eyebrow, { fontSize: 11 }]}>À vista</Text>
            <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 22, fontWeight: "800", letterSpacing: -0.7, color: "#fff" }}>
              {money(split.avista)}
            </Text>
          </View>
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
            shown.map((line) => <InvoiceLineRow key={line.id} line={line} onPress={() => setOpenLine(line)} />)
          )}
        </View>
      </ScrollView>

      <LineDetail line={openLine} cardName={cardName} onClose={() => setOpenLine(null)} onChanged={() => setReload((n) => n + 1)} />
    </Room>
  );
}
