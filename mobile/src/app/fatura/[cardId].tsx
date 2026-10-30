import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { getInvoices, getInvoiceItems, type Invoice } from "@/services/invoiceService";
import { getCreditCards, updateCreditCard } from "@/services/transactionService";
import { invoicePeriodIndex } from "@/lib/installments";
import type { InvoiceLine } from "@/lib/invoice/readModel";
import { cardHex as hexFor } from "@/hooks/useCardsOverview";
import { shade } from "@/lib/tone";
import { categoryHex } from "@/lib/categoryData";
import Room from "~/components/Room";
import RoundButton from "~/components/RoundButton";
import BackButton from "~/components/BackButton";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import CardFormSheet, { type CardDraft } from "~/components/wallet/CardFormSheet";
import InvoiceForecastChart from "~/components/fatura/InvoiceForecastChart";
import InvoiceRecentCard from "~/components/fatura/InvoiceRecentCard";
import LineDetail from "~/components/fatura/LineDetail";
import CountUp from "~/components/CountUp";
import PayInvoiceSheet from "~/components/fatura/PayInvoiceSheet";
import AddToCardSheet from "~/components/fatura/AddToCardSheet";
import AnchoredMenu, { MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import { AlertTriangle, CalendarClock, Check, Clock, Lock, MoreVertical, Pencil, Plus, Trash2, Wallet } from "~/components/icons";
import { showToast } from "~/lib/toast";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * The card's own panel.
 *
 * One question at a time, in the order it is asked: what does this bill want, when
 * does it want it, how much room is left on the card, and only then what is on it.
 * The figure is what the invoice asks for *today* — a payment already made has left
 * it — because a bill you have half paid is not the bill it was.
 */

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

interface CardInfo {
  id: string;
  name: string;
  limit: number;
  used_limit: number;
  closing_day: number;
  due_day: number;
  color: string | null;
  last_four_digits: string | null;
}

export default function Fatura() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [card, setCard] = useState<CardInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openLine, setOpenLine] = useState<InvoiceLine | null>(null);
  const [menuAt, setMenuAt] = useState<AnchorRect | null>(null);
  const dotsRef = useRef<ComponentRef<typeof View>>(null);

  const load = useCallback(async () => {
    if (!cardId || !user) {
      setLoading(false);
      return;
    }
    try {
      const [cards, invs] = await Promise.all([getCreditCards(), getInvoices(cardId)]);
      const found = (cards as unknown as CardInfo[]).find((c) => c.id === cardId) ?? null;
      setCard(found);
      setInvoices(invs as unknown as Invoice[]);
    } finally {
      setLoading(false);
    }
  }, [cardId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Opening a card should land on the statement that still needs attention — the
     oldest one not yet settled, or the period currently collecting purchases when
     everything is paid. A settled month stays reachable through the strip, not as
     the landing screen. */
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current || !card) return;
    picked.current = true;

    const unpaid = invoices
      .filter((inv) => !inv.is_paid && Number(inv.total_amount) > 0)
      .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))[0];

    if (unpaid) {
      setMonth(unpaid.month);
      setYear(unpaid.year);
      return;
    }
    const period = invoicePeriodIndex(new Date().toISOString().slice(0, 10), card.closing_day);
    setMonth((period % 12) + 1);
    setYear(Math.floor(period / 12));
  }, [card, invoices]);

  const current = useMemo(
    () => invoices.find((i) => i.month === month && i.year === year),
    [invoices, month, year],
  );

  useEffect(() => {
    let alive = true;
    if (!current) {
      setItems([]);
      return;
    }
    getInvoiceItems(current.id)
      .then((rows) => alive && setItems(rows as any[]))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [current]);

  const hex = hexFor(card?.color ?? null);
  const freeTone = shade(hex, 0.58);

  const total = current ? Number(current.total_amount) : 0;
  const paid = current ? Number((current as any).paid_amount ?? 0) : 0;
  const outstanding = Math.max(0, total - paid);
  /* What the invoice asks for today. A payment already made is gone from it. */
  const headline = outstanding > 0 ? outstanding : total;

  const limitTotal = card ? Number(card.limit) : 0;
  const usedLimit = card ? Number(card.used_limit) : 0;
  const available = limitTotal - usedLimit;
  const usedPct = limitTotal > 0 ? Math.min((usedLimit / limitTotal) * 100, 100) : 0;

  /* While the invoice is open, the only date you can act on is the closing one — it
     is the deadline for what still goes on this bill. Once it shuts, the question
     changes to when it has to be paid, and so does the line. */
  const cycle = useMemo(() => {
    if (!card) return null;
    const dayIn = (y: number, m: number, d: number) =>
      new Date(y, m - 1, Math.min(d, new Date(y, m, 0).getDate()));

    const closing = dayIn(year, month, card.closing_day);
    let due = dayIn(year, month, card.due_day);
    if (due <= closing) due = dayIn(year, month + 1, card.due_day);

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const days = (d: Date) => Math.round((d.getTime() - now.getTime()) / 86_400_000);
    const toClose = days(closing);
    const toDue = days(due);
    const plural = (n: number) => `${n} dia${n === 1 ? "" : "s"}`;

    const line =
      total > 0 && outstanding <= 0
        ? "Fatura paga"
        : toClose > 0
          ? toClose === 1
            ? "Fecha amanhã"
            : `Fecha em ${plural(toClose)}`
          : toDue < 0
            ? `Venceu há ${plural(Math.abs(toDue))}`
            : toDue === 0
              ? "Vence hoje"
              : toDue === 1
                ? "Vence amanhã"
                : `Vence em ${plural(toDue)}`;

    return { line, overdue: toDue < 0 && outstanding > 0 };
  }, [card, month, year, total, outstanding]);

  const closed = !!card && new Date() > new Date(year, month - 1, card.closing_day);
  const [paying, setPaying] = useState(false);
  const [adding, setAdding] = useState(false);
  const refresh = () => {
    void load();
    if (current) void getInvoiceItems(current.id).then((rows) => setItems(rows as any[])).catch(() => undefined);
  };

  /* Where the bill stands, as a mark with its own colour and glyph: paid is green and
     ticked, overdue is red, closed is locked and waiting for its due day, open is still
     collecting purchases. */
  const status = useMemo(() => {
    if (!current) return null;
    /* Paid ahead while still collecting purchases, it is still open — only a closed one is "paga". */
    if (current.is_paid && outstanding <= 0 && closed) return { label: "Paga", tone: GREEN, Icon: Check };
    if (cycle?.overdue) return { label: "Vencida", tone: RED, Icon: AlertTriangle };
    if (closed) return { label: "Fechada", tone: "#F5C26B", Icon: Lock };
    /* Only the invoice collecting today's purchases is open; the ones after it are still to come. */
    if (card && year * 12 + (month - 1) > invoicePeriodIndex(new Date().toISOString().slice(0, 10), card.closing_day))
      return { label: "Futura", tone: "rgba(255,255,255,0.7)", Icon: CalendarClock };
    return { label: "Aberta", tone: "#8FC7FF", Icon: Clock };
  }, [current, closed, outstanding, cycle, card, month, year]);
  const paidOff = status?.label === "Paga";

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveCard = async (draft: CardDraft) => {
    if (!card) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateCreditCard(card.id, {
        name: draft.name,
        limit: draft.limit,
        closing_day: draft.closing_day,
        due_day: draft.due_day,
        last_four_digits: draft.last_four_digits,
      });
      setEditing(false);
      await load();
      showToast("Cartão atualizado");
    } catch {
      setSaveError("Não foi possível salvar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };


  return (
    <Room>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* The card is what this screen is about, so it sits where a title sits. */}
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BackButton to="/cartoes" />

          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 56,
              right: 56,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                width: 24,
                height: 18,
                borderRadius: 5,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: hex,
              }}
            >
              <View style={{ width: 6, height: 4, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.85)" }} />
            </View>
            <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: "#fff" }}>
              {card?.name ?? ""}
              {card?.last_four_digits ? (
                <Text style={{ color: INK.softer }}> ••••{card.last_four_digits}</Text>
              ) : null}
            </Text>
          </View>

          <RoundButton
            label="Opções do cartão"
            hostRef={dotsRef}
            onPress={() => {
              dotsRef.current?.measureInWindow((x, y, w, h) =>
                setMenuAt({ top: y, bottom: y + h, left: x, width: w }),
              );
            }}
          >
            <MoreVertical size={18} color="rgba(255,255,255,0.9)" />
          </RoundButton>
        </View>

        {loading && user ? (
          <View style={{ marginTop: 24, gap: 16 }}>
            <View style={{ height: 120, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
            <Surface style={{ height: 220 }}><View /></Surface>
          </View>
        ) : (
          <>
            {/* ── What it asks for ── */}
            <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: 20, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.62)" }}>
                  Fatura de {MONTH_NAMES[month - 1]}
                </Text>
                {status && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      height: 28,
                      paddingLeft: 4,
                      paddingRight: 11,
                      borderRadius: 14,
                      backgroundColor: `${status.tone}1F`,
                    }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: status.tone }}>
                      <status.Icon size={11} color="#0B0B0B" strokeWidth={3} />
                    </View>
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: status.tone }}>{status.label}</Text>
                  </View>
                )}
              </View>
              <CountUp
                value={headline}
                numberOfLines={1}
                style={{ marginTop: 4, fontSize: 42, fontWeight: "800", letterSpacing: -1.7, color: paidOff ? "rgba(255,255,255,0.55)" : "#fff", fontVariant: ["tabular-nums"] }}
              />
              {cycle && (
                <Text style={{ marginTop: 10, fontSize: 13, color: cycle.overdue ? RED : INK.soft }}>
                  {cycle.line}
                </Text>
              )}
            </Animated.View>

            {/* ── Limite, solto embaixo ── */}
            <Animated.View entering={FadeInDown.delay(60).duration(450)} style={{ marginTop: 28, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <Text style={[T.eyebrow, { fontSize: 11.5 }]}>Limite</Text>
                <Text style={{ fontSize: 12, fontWeight: "600", color: usedLimit > limitTotal ? RED : INK.softer }}>
                  {usedPct.toFixed(0)}% usado
                </Text>
              </View>

              {/* Inside a card the card's own colour rules; what is left is its
                  lighter tone. */}
              <View style={{ marginTop: 12, flexDirection: "row", height: 10, gap: 3 }}>
                <Bar
                  share={Math.min(usedPct, 100) / 100}
                  color={hex}
                  minWidth={usedLimit > 0 ? 6 : 0}
                  delay={0.08}
                />
                <Bar
                  share={limitTotal > 0 ? Math.max(1 - usedPct / 100, 0) : 1}
                  color={freeTone}
                  minWidth={available > 0 ? 6 : 0}
                  delay={0.16}
                />
              </View>

              <View style={{ marginTop: 16, flexDirection: "row", gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hex }} />
                    <Text style={{ fontSize: 11.5, color: INK.softer }}>Usado</Text>
                  </View>
                  <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 16, fontWeight: "700", color: "#fff" }}>
                    {money(usedLimit)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: freeTone }} />
                    <Text style={{ fontSize: 11.5, color: INK.softer }}>Disponível</Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      marginTop: 4,
                      fontSize: 16,
                      fontWeight: "700",
                      color: available > 0 ? "#fff" : RED,
                    }}
                  >
                    {money(available)}
                  </Text>
                </View>
              </View>

              <Text style={{ marginTop: 12, fontSize: 11.5, color: INK.faint }}>
                Limite total {money(limitTotal)}
              </Text>
            </Animated.View>

            {/* ── Pagar, e acrescentar ── */}
            <View style={{ marginTop: 24, flexDirection: "row", gap: 10, paddingHorizontal: 4 }}>
              {current && outstanding > 0 ? (
                <Pressable
                  onPress={() => setPaying(true)}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 56,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 999,
                    backgroundColor: "#fff",
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <Wallet size={16} color="#0B0B0B" />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#0B0B0B" }}>
                    Pagar fatura · {money(outstanding)}
                  </Text>
                </Pressable>
              ) : (
                <View
                  style={{
                    flex: 1,
                    height: 56,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: INK.edge,
                  }}
                >
                  <Check size={16} color={GREEN} strokeWidth={3} />
                  <Text style={{ fontSize: 14.5, fontWeight: "600", color: INK.soft }}>
                    Nada a pagar nesta fatura
                  </Text>
                </View>
              )}
              <Pressable
                accessibilityLabel="Adicionar lançamento"
                onPress={() => setAdding(true)}
                style={({ pressed }) => ({
                  width: 56,
                  height: 56,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.14)",
                  backgroundColor: "rgba(255,255,255,0.07)",
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                })}
              >
                <Plus size={20} color="#fff" strokeWidth={2.4} />
              </Pressable>
            </View>

            {/* What this card is about to ask for, month by month. */}
            <View style={{ marginTop: 28 }}>
              <InvoiceForecastChart
                invoices={invoices}
                selectedMonth={month}
                selectedYear={year}
                onSelect={(m, y) => {
                  setMonth(m);
                  setYear(y);
                }}
                closingDay={card?.closing_day}
                hex={hex}
              />
            </View>

            <View style={{ marginTop: 32 }}>
              <InvoiceRecentCard
                items={items}
                /* The month travels with the tap. Without it the list falls back to
                   the calendar month, which is rarely the invoice you were reading —
                   past the closing day the open one is already the next. */
                onSeeAll={() =>
                  router.push({
                    pathname: "/fatura/[cardId]/lancamentos",
                    params: { cardId: String(cardId), month: String(month), year: String(year) },
                  } as never)
                }
                onOpen={setOpenLine}
              />
            </View>
          </>
        )}
      </ScrollView>

      <LineDetail
        line={openLine}
        cardName={card?.name}
        onClose={() => setOpenLine(null)}
        onChanged={() => {
          void load();
          if (current) void getInvoiceItems(current.id).then((rows) => setItems(rows as any[])).catch(() => undefined);
        }}
      />

      <PayInvoiceSheet
        open={paying}
        invoiceId={current?.id ?? null}
        outstanding={outstanding}
        closed={closed}
        onClose={() => setPaying(false)}
        onPaid={refresh}
      />

      <AddToCardSheet
        open={adding}
        card={card ? { id: card.id, dueDay: card.due_day } : null}
        month={month}
        year={year}
        onClose={() => setAdding(false)}
        onImported={refresh}
      />

      <CardFormSheet
        open={editing}
        initial={card}
        used={usedLimit}
        saving={saving}
        error={saveError}
        onClose={() => setEditing(false)}
        onSave={(d) => void saveCard(d)}
      />

      {/* What can be done to the card itself. */}
      <AnchoredMenu open={!!menuAt} anchor={menuAt} onClose={() => setMenuAt(null)}>
        <MenuRow
          icon={Pencil}
          label="Editar cartão"
          onPress={() => {
            setMenuAt(null);
            setSaveError(null);
            setEditing(true);
          }}
        />
        <MenuRow icon={Trash2} label="Excluir cartão" danger last onPress={() => setMenuAt(null)} />
      </AnchoredMenu>
    </Room>
  );
}
