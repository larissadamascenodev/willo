import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Clock, CreditCard, Plus } from "lucide-react-native";
import {
  useCardsOverview, cardHex, invoiceDueDate, monthKey,
  type OverviewCard, type OverviewInstallment, type OverviewInvoice,
} from "@/hooks/useCardsOverview";
import { getCategoryHexColor, getCategoryIcon } from "@/lib/categoryUtils";
import { type CreditCardItem, type OpenInvoiceInfo } from "@/lib/cardInvoice";
import { MONTH_NAMES, useMoney } from "@/components/projecoes/shared";
import { CardCreateSheet } from "~/features/wallet/CardCreateSheet";
import { CreditCardTile } from "~/features/wallet/CreditCardTile";
import { BottomSheet, Glass, PageHeader, ProgressBar, Screen, Segmented, Text, colors, white } from "~/ui";
import { tint } from "~/lib/color";

type Tab = "cartoes" | "faturas" | "parcelas";

const SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

interface MonthSlot { key: number; year: number; month: number; label: string }

function monthSlots(fromOffset: number, count: number): MonthSlot[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + fromOffset + i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return { key: monthKey(year, month), year, month, label: `${SHORT[month - 1]}${year !== now.getFullYear() ? `/${String(year).slice(2)}` : ""}` };
  });
}

const keyLabel = (key: number) => {
  const year = Math.floor(key / 12);
  const month = key % 12;
  return `${SHORT[month].charAt(0)}${SHORT[month].slice(1).toLowerCase()}/${String(year).slice(2)}`;
};

const BAR_SLOT = 54;
const BAR_HEIGHT = 150;

/** Uma barra por mês com o total das faturas; toque para escolher o mês. */
function MonthBars({ slots, values, selected, onSelect }: { slots: MonthSlot[]; values: number[]; selected: number; onSelect: (key: number) => void }) {
  const ref = useRef<ScrollView>(null);
  const max = Math.max(...values, 1);

  useEffect(() => {
    const i = slots.findIndex((s) => s.key === selected);
    ref.current?.scrollTo({ x: Math.max(i * (BAR_SLOT + 8) - 120, 0), animated: true });
  }, [selected, slots]);

  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
      {slots.map((slot, i) => {
        const value = values[i];
        const on = slot.key === selected;
        return (
          <Pressable key={slot.key} onPress={() => onSelect(slot.key)} style={{ width: BAR_SLOT, alignItems: "center" }}>
            <View style={{ height: BAR_HEIGHT, justifyContent: "flex-end", alignItems: "center" }}>
              {value > 0 ? (
                <View style={{ width: 36, height: Math.max((value / max) * BAR_HEIGHT, 36), borderRadius: 18, backgroundColor: on ? "#fff" : white(0.25) }} />
              ) : (
                <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: on ? white(0.7) : white(0.25) }} />
              )}
            </View>
            <Text size={12} tabular weight={on ? "semibold" : "regular"} color={on ? "#fff" : white(0.62)} style={{ marginTop: 12 }}>{slot.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const EmptyState = ({ text }: { text: string }) => (
  <Glass radius={20} style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
    <Clock size={20} color={white(0.62)} />
    <Text size={15} color={white(0.62)}>{text}</Text>
  </Glass>
);

export default function Cartoes() {
  const router = useRouter();
  const { fmt } = useMoney();
  const { aba } = useLocalSearchParams<{ aba?: string }>();
  const [tab, setTab] = useState<Tab>(aba === "faturas" || aba === "parcelas" ? aba : "cartoes");
  const { cards, invoices, installments, loading, refresh } = useCardsOverview();
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);

  const now = new Date();
  const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);
  const [selectedKey, setSelectedKey] = useState(currentKey);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const visibleCards = cardFilter ? cards.filter((c) => c.id === cardFilter) : cards;
  const filteredInvoices = cardFilter ? invoices.filter((i) => i.cardId === cardFilter) : invoices;
  const filteredInstallments = cardFilter ? installments.filter((i) => i.cardId === cardFilter) : installments;

  const slots = useMemo(() => monthSlots(-3, 15), []);
  const selectedIdx = Math.max(slots.findIndex((s) => s.key === selectedKey), 0);
  const selectedSlot = slots[selectedIdx];
  const values = slots.map((s) => filteredInvoices.filter((i) => monthKey(i.year, i.month) === s.key).reduce((sum, i) => sum + i.total, 0));
  const monthInvoices = filteredInvoices.filter((i) => monthKey(i.year, i.month) === selectedSlot.key && i.total > 0).sort((a, b) => b.total - a.total);
  const filterLabel = cardFilter ? cardById.get(cardFilter)?.name ?? "Cartão" : "Todos os cartões";

  return (
    <Screen onRefresh={refresh}>
      <PageHeader title="Cartões" />

      <View style={{ marginTop: 8 }}>
        <Segmented<Tab>
          options={[{ key: "cartoes", label: "Cartões" }, { key: "faturas", label: "Faturas" }, { key: "parcelas", label: "Parcelas" }]}
          value={tab}
          onChange={(t) => { setTab(t); setSelectedKey(currentKey); }}
        />
      </View>

      {cards.length > 1 && (
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={{ marginTop: 16, alignSelf: "flex-start", height: 40, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: "#fff" }}
        >
          <CreditCard size={16} color={colors.black} />
          <Text weight="medium" size={14} color={colors.black}>{filterLabel}</Text>
        </Pressable>
      )}

      <View style={{ marginTop: 24 }}>
        {loading ? (
          <View style={{ height: 256, borderRadius: 22, backgroundColor: white(0.06) }} />
        ) : cards.length === 0 ? (
          <View style={{ gap: 12 }}>
            <EmptyState text="Nenhum cartão cadastrado" />
            <AddCardButton onPress={() => setShowAddCard(true)} />
          </View>
        ) : tab === "cartoes" ? (
          <CardsList cards={visibleCards} invoices={filteredInvoices} onAdd={() => setShowAddCard(true)} />
        ) : tab === "parcelas" ? (
          <InstallmentsOverview installments={filteredInstallments} cardById={cardById} currentKey={currentKey} />
        ) : (
          <View>
            <Text size={15} color={white(0.66)}>Total em faturas em {MONTH_NAMES[selectedSlot.month - 1]}</Text>
            <Text weight="extrabold" size={38} tabular style={{ letterSpacing: -1 }}>{fmt(values[selectedIdx] ?? 0)}</Text>
            <View style={{ marginTop: 24 }}>
              <MonthBars slots={slots} values={values} selected={selectedSlot.key} onSelect={setSelectedKey} />
            </View>
            <View style={{ marginTop: 24 }}>
              {monthInvoices.length === 0 ? (
                <EmptyState text="Nenhuma fatura encontrada" />
              ) : (
                <InvoiceList invoices={monthInvoices} cardById={cardById} onOpen={(id) => router.push({ pathname: "/fatura/[cardId]", params: { cardId: id } })} />
              )}
            </View>
          </View>
        )}
      </View>

      <CardCreateSheet open={showAddCard} onClose={() => setShowAddCard(false)} onCreated={refresh} />

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text display weight="bold" size={20}>Filtrar por cartão</Text>
          <View style={{ marginTop: 8 }}>
            {[{ id: null as string | null, name: "Todos os cartões", color: null as string | null }, ...cards].map((c) => (
              <Pressable
                key={c.id ?? "all"}
                onPress={() => { setCardFilter(c.id); setPickerOpen(false); }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: white(0.06) }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: c.id ? tint(cardHex(c.color), 0.15) : white(0.08) }}>
                  <CreditCard size={16} color={c.id ? cardHex(c.color) : "#fff"} />
                </View>
                <Text size={16} style={{ flex: 1 }}>{c.name}</Text>
                {cardFilter === c.id && <Check size={20} color="#fff" />}
              </Pressable>
            ))}
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function AddCardButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ height: 52, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", borderColor: white(0.2), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: pressed ? 0.7 : 1 })}
    >
      <Plus size={18} color={white(0.82)} />
      <Text weight="medium" size={15} color={white(0.82)}>Adicionar cartão</Text>
    </Pressable>
  );
}

function InvoiceList({ invoices, cardById, onOpen }: { invoices: OverviewInvoice[]; cardById: Map<string, OverviewCard>; onOpen: (cardId: string) => void }) {
  const { fmt } = useMoney();
  return (
    <Glass radius={22} style={{ paddingHorizontal: 16 }}>
      {invoices.map((inv, i) => {
        const card = cardById.get(inv.cardId);
        if (!card) return null;
        const due = invoiceDueDate(card, inv.year, inv.month);
        const hex = cardHex(card.color);
        return (
          <Pressable key={inv.id} onPress={() => onOpen(card.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: white(0.06) }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.15) }}>
              <CreditCard size={18} color={hex} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text weight="medium" size={15} numberOfLines={1}>{card.name}</Text>
              <Text size={12} color={inv.isPaid ? white(0.56) : "#FCD34D"}>
                {inv.isPaid ? "Paga" : `Vence ${due.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`}
              </Text>
            </View>
            <Text weight="semibold" size={15} tabular color={inv.isPaid ? white(0.62) : "#fff"}>{fmt(inv.total)}</Text>
          </Pressable>
        );
      })}
    </Glass>
  );
}

interface InstallmentPurchase {
  groupId: string;
  name: string;
  category: string;
  cardId: string;
  amount: number;
  total: number;
  current: number;
  remaining: number;
  lastKey: number;
}

/** Parcelas: toda compra parcelada em andamento, em todos os cartões. */
function InstallmentsOverview({ installments, cardById, currentKey }: { installments: OverviewInstallment[]; cardById: Map<string, OverviewCard>; currentKey: number }) {
  const { fmt } = useMoney();
  const purchases = useMemo(() => {
    const groups = new Map<string, OverviewInstallment[]>();
    for (const it of installments) groups.set(it.groupId, [...(groups.get(it.groupId) ?? []), it]);

    const list: InstallmentPurchase[] = [];
    groups.forEach((items, groupId) => {
      const upcoming = items.filter((i) => monthKey(i.year, i.month) >= currentKey);
      if (upcoming.length === 0) return;
      const first = items[0];
      const thisMonth = items.find((i) => monthKey(i.year, i.month) === currentKey) ?? [...upcoming].sort((a, b) => a.number - b.number)[0];
      const lastKey = Math.max(...items.map((i) => monthKey(i.year, i.month)));
      list.push({
        groupId, name: first.name, category: first.category, cardId: first.cardId,
        amount: thisMonth.amount, total: first.total, current: thisMonth.number,
        remaining: first.total - thisMonth.number + 1, lastKey,
      });
    });
    return list.sort((a, b) => b.amount * b.remaining - a.amount * a.remaining);
  }, [installments, currentKey]);

  const monthly = purchases.reduce((s, p) => s + p.amount, 0);
  const remainingTotal = purchases.reduce((s, p) => s + p.amount * p.remaining, 0);
  const freeKey = purchases.length ? Math.max(...purchases.map((p) => p.lastKey)) : null;

  if (purchases.length === 0) return <EmptyState text="Nenhuma parcela em andamento" />;

  return (
    <View>
      <Text size={15} color={white(0.66)}>Parcelado no cartão a pagar</Text>
      <Text weight="extrabold" size={38} tabular style={{ letterSpacing: -1 }}>{fmt(remainingTotal)}</Text>
      <Text size={15} color={white(0.66)}>{purchases.length} {purchases.length === 1 ? "compra parcelada" : "compras parceladas"}</Text>

      <Glass radius={22} style={{ marginTop: 20, flexDirection: "row", paddingVertical: 14 }}>
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <Text size={12} color={white(0.62)}>Por mês</Text>
          <Text weight="bold" size={18} tabular>{fmt(monthly)}</Text>
        </View>
        <View style={{ flex: 1, paddingHorizontal: 16, borderLeftWidth: 1, borderLeftColor: white(0.12) }}>
          <Text size={12} color={white(0.62)}>Livre das parcelas</Text>
          <Text weight="bold" size={18}>{freeKey !== null ? keyLabel(freeKey + 1) : "—"}</Text>
        </View>
      </Glass>

      <View style={{ marginTop: 16, gap: 10 }}>
        {purchases.map((p) => {
          const Icon = getCategoryIcon(p.category);
          const hex = getCategoryHexColor(p.category);
          const card = cardById.get(p.cardId);
          return (
            <Glass key={p.groupId} radius={22} style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: tint(hex, 0.12) }}>
                  <Icon size={18} color={hex} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="medium" size={15} numberOfLines={1}>{p.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {card && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cardHex(card.color) }} />}
                    <Text size={12} color={white(0.56)} numberOfLines={1}>{card?.name ?? "Cartão"}</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text weight="semibold" size={15} tabular>{fmt(p.amount)}</Text>
                  <Text size={11} color={white(0.56)}>por mês</Text>
                </View>
              </View>
              <View style={{ marginTop: 12 }}>
                <ProgressBar ratio={(p.current - 1) / p.total} color="#fff" track={white(0.08)} />
              </View>
              <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
                <Text size={12} color={white(0.62)} tabular>Parcela {p.current} de {p.total}</Text>
                <Text size={12} color={white(0.62)} tabular>Faltam {fmt(p.amount * p.remaining)} · até {keyLabel(p.lastKey)}</Text>
              </View>
            </Glass>
          );
        })}
      </View>
    </View>
  );
}

/** Cada cartão, um embaixo do outro, com a fatura em aberto e a barra do limite. */
function CardsList({ cards, invoices, onAdd }: { cards: OverviewCard[]; invoices: OverviewInvoice[]; onAdd: () => void }) {
  const openByCard = new Map<string, OpenInvoiceInfo>();
  for (const inv of invoices) {
    if (inv.isPaid || inv.total <= 0) continue;
    const prev = openByCard.get(inv.cardId);
    const isEarlier = !prev || inv.year < prev.year || (inv.year === prev.year && inv.month < prev.month);
    if (isEarlier) openByCard.set(inv.cardId, { amount: inv.total - inv.paid, month: inv.month, year: inv.year, isPaid: false });
  }

  return (
    <View style={{ gap: 10 }}>
      {cards.map((c) => {
        const item: CreditCardItem = {
          id: c.id, name: c.name, limit: c.limit, used_limit: c.used,
          closing_day: c.closingDay, due_day: c.dueDay, color: c.color, last_four_digits: c.lastFour,
        };
        return <CreditCardTile key={c.id} card={item} invoiceInfo={openByCard.get(c.id)} />;
      })}
      <AddCardButton onPress={onAdd} />
    </View>
  );
}
