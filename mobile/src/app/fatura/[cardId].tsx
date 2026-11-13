import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { getInvoices, getInvoiceItems, getInvoicePayments, type Invoice, type InvoicePayment } from "@/services/invoiceService";
import { getAccounts, getCreditCards, updateCreditCard } from "@/services/transactionService";
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
import { PaymentDetail, paymentName } from "~/components/fatura/InvoicePayments";
import PayInvoiceSheet from "~/components/fatura/PayInvoiceSheet";
import AddToCardSheet from "~/components/fatura/AddToCardSheet";
import AnchoredMenu, { MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import { AlertTriangle, CalendarClock, Check, Clock, Lock, MoreVertical, Pencil, Plus, Trash2, Undo2, Wallet } from "~/components/icons";
import DeleteCardModal from "~/components/wallet/DeleteCardModal";
import CenterModal from "~/components/CenterModal";
import { removePayment } from "~/lib/invoicePayments";
import { showToast } from "~/lib/toast";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th, useThemeRedraw } from "~/theme/theme";
import StatusTag, { TAG_TONES } from "~/components/StatusTag";
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
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
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
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [openPayment, setOpenPayment] = useState<InvoicePayment | null>(null);
  /* Undoing what was paid on the invoice on screen: asked, then every payment of it goes. */
  const [undoing, setUndoing] = useState(false);
  const [deletingCard, setDeletingCard] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
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

  useEffect(() => {
    getAccounts()
      .then((list) => setAccountNames(Object.fromEntries((list as any[]).map((a) => [a.id, a.name]))))
      .catch(() => undefined);
  }, []);

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
      setPayments([]);
      return;
    }
    getInvoiceItems(current.id)
      .then((rows) => alive && setItems(rows as any[]))
      .catch(() => alive && setItems([]));
    getInvoicePayments(current.id)
      .then((rows) => alive && setPayments(rows))
      .catch(() => alive && setPayments([]));
    return () => {
      alive = false;
    };
  }, [current]);

  const hex = hexFor(card?.color ?? null);
  const freeTone = shade(hex, 0.58);

  const total = current ? Number(current.total_amount) : 0;
  const paid = current ? Number((current as any).paid_amount ?? 0) : 0;
  const outstanding = Math.max(0, total - paid);
  /* Paid before the invoice closed: that money already left, as its own line. */
  const early = useMemo(() => {
    if (!card) return 0;
    const closingAt = new Date(year, month - 1, Math.min(card.closing_day, new Date(year, month, 0).getDate()));
    return payments.filter((pay) => new Date(pay.paid_at) < closingAt).reduce((sum, pay) => sum + Number(pay.amount), 0);
  }, [payments, card, year, month]);
  /* What the invoice asks for today. A payment already made is gone from it; once it is
     paid, what settled it after it closed — not the whole bill again. */
  const headline = outstanding > 0 ? outstanding : Math.max(0, total - early) || total;

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
    if (current) {
      void getInvoiceItems(current.id).then((rows) => setItems(rows as any[])).catch(() => undefined);
      void getInvoicePayments(current.id).then(setPayments).catch(() => undefined);
    }
  };

  /* Something written elsewhere — a photo read onto this card, a statement imported —
     shows here the moment this page is back in front. */
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const on = () => refreshRef.current();
    window.addEventListener("finance-data-changed", on);
    window.addEventListener("transaction-created", on);
    return () => {
      window.removeEventListener("finance-data-changed", on);
      window.removeEventListener("transaction-created", on);
    };
  }, []);

  /* Where the bill stands, as a mark with its own colour and glyph: paid is green and
     ticked, overdue is red, closed is locked and waiting for its due day, open is still
     collecting purchases. */
  const status = useMemo(() => {
    if (!current) return null;
    /* Paid ahead while still collecting purchases, it is still open — only a closed one is "paga". */
    if (current.is_paid && outstanding <= 0 && closed) return { label: "Paga", tone: TAG_TONES.paid, Icon: Check };
    if (cycle?.overdue) return { label: "Vencida", tone: TAG_TONES.overdue, Icon: AlertTriangle };
    if (closed) return { label: "Fechada", tone: TAG_TONES.closed, Icon: Lock };
    /* Only the invoice collecting today's purchases is open; the ones after it are still to come. */
    if (card && year * 12 + (month - 1) > invoicePeriodIndex(new Date().toISOString().slice(0, 10), card.closing_day))
      return { label: "Futura", tone: "#B4B8C2", Icon: CalendarClock };
    return { label: "Aberta", tone: TAG_TONES.open, Icon: Clock };
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
                backgroundColor: th(hex, "bg"),
              }}
            >
              <View style={{ width: 6, height: 4, borderRadius: 1, backgroundColor: th("rgba(255,255,255,0.85)", "bg") }} />
            </View>
            <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>
              {card?.name ?? ""}
              {card?.last_four_digits ? (
                <Text style={{ color: th(INK.softer) }}> ••••{card.last_four_digits}</Text>
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
            <MoreVertical size={18} color={th("rgba(255,255,255,0.9)")} />
          </RoundButton>
        </View>

        {loading && user ? (
          <View style={{ marginTop: 24, gap: 16 }}>
            <View style={{ height: 120, borderRadius: 24, backgroundColor: th("rgba(255,255,255,0.04)", "bg") }} />
            <Surface style={{ height: 220 }}><View /></Surface>
          </View>
        ) : (
          <>
            {/* ── What it asks for ── */}
            <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: 20, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ fontSize: 13, color: th("rgba(255,255,255,0.62)") }}>
                  Fatura de {MONTH_NAMES[month - 1]}
                </Text>
                {status && <StatusTag label={status.label} tone={status.tone} Icon={status.Icon} />}
              </View>
              <CountUp
                value={headline}
                numberOfLines={1}
                style={{ marginTop: 4, fontSize: 42, fontWeight: "800", letterSpacing: -1.7, color: th(paidOff ? "rgba(255,255,255,0.55)" : "#fff"), fontVariant: ["tabular-nums"] }}
              />
              {cycle && (
                <Text style={{ marginTop: 10, fontSize: 13, color: th(cycle.overdue ? RED : INK.soft) }}>
                  {cycle.line}
                  {outstanding <= 0 && total > 0 && early > 0 ? ` · ${money(early)} pago antecipado` : ""}
                </Text>
              )}
            </Animated.View>

            {/* ── Limite, solto embaixo ── */}
            <Animated.View entering={FadeInDown.delay(60).duration(450)} style={{ marginTop: 28, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <Text style={[T.eyebrow, { fontSize: 11.5 }]}>Limite</Text>
                <Text style={{ fontSize: 12, fontWeight: "600", color: th(usedLimit > limitTotal ? RED : INK.softer) }}>
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
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th(hex, "bg") }} />
                    <Text style={{ fontSize: 11.5, color: th(INK.softer) }}>Usado</Text>
                  </View>
                  <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 16, fontWeight: "700", color: th("#fff") }}>
                    {money(usedLimit)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th(freeTone, "bg") }} />
                    <Text style={{ fontSize: 11.5, color: th(INK.softer) }}>Disponível</Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      marginTop: 4,
                      fontSize: 16,
                      fontWeight: "700",
                      color: th(available > 0 ? "#fff" : RED),
                    }}
                  >
                    {money(available)}
                  </Text>
                </View>
              </View>

              <Text style={{ marginTop: 12, fontSize: 11.5, color: th(INK.faint) }}>
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
                    backgroundColor: th("#fff", "bg"),
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <Wallet size={16} color={th("#0B0B0B")} />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: th("#0B0B0B") }}>
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
                    borderColor: th(INK.edge, "line"),
                  }}
                >
                  <Check size={16} color={th(GREEN)} strokeWidth={3} />
                  <Text style={{ fontSize: 14.5, fontWeight: "600", color: th(INK.soft) }}>
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
                  borderColor: th("rgba(255,255,255,0.14)", "line"),
                  backgroundColor: th("rgba(255,255,255,0.07)", "bg"),
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                })}
              >
                <Plus size={20} color={th("#fff")} strokeWidth={2.4} />
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
                dueDay={card?.due_day}
                hex={hex}
              />
            </View>

            <View style={{ marginTop: 32 }}>
              <InvoiceRecentCard
                items={items}
                payments={payments}
                accountNames={accountNames}
                paymentLabel={(pay) => paymentName(pay, month, year, card?.closing_day)}
                onOpenPayment={setOpenPayment}
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

      <PaymentDetail
        payment={openPayment}
        name={openPayment ? paymentName(openPayment, month, year, card?.closing_day) : ""}
        cardName={card?.name}
        onClose={() => setOpenPayment(null)}
        onChanged={refresh}
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
        card={card ? { id: card.id, dueDay: card.due_day, name: card.name } : null}
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

      {/* What can be done to the card, and to the payment of the invoice on screen. */}
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
        {payments.length > 0 && (
          <MenuRow
            icon={Undo2}
            label="Desfazer pagamento"
            onPress={() => {
              setMenuAt(null);
              setUndoing(true);
            }}
          />
        )}
        <MenuRow
          icon={Trash2}
          label="Excluir cartão"
          danger
          last
          onPress={() => {
            setMenuAt(null);
            setDeletingCard(true);
          }}
        />
      </AnchoredMenu>

      <DeleteCardModal card={deletingCard && card ? { id: card.id, name: card.name } : null} onClose={() => setDeletingCard(false)} onDeleted={() => router.replace("/cartoes" as never)} />

      <CenterModal open={undoing} onClose={() => !undoBusy && setUndoing(false)} title="Desfazer pagamento" subtitle={`Fatura de ${MONTH_NAMES[month - 1]?.toLowerCase() ?? ""} · ${card?.name ?? ""}`}>
        {(() => {
          const total = payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
          const from = [...new Set(payments.map((pay) => (pay.account_id ? accountNames[pay.account_id] : null)).filter(Boolean))].join(" e ");
          return (
            <View>
              <Text style={{ fontSize: 15, lineHeight: 21, color: th(INK.soft) }}>
                {money(total)} volta{from ? ` para ${from}` : " para a conta"} e a fatura fica em aberto de novo.
              </Text>
              <View style={{ marginTop: 22, flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => setUndoing(false)}
                  disabled={undoBusy}
                  style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.10)", "bg"), opacity: pressed ? 0.7 : 1 })}
                >
                  <Text style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>Cancelar</Text>
                </Pressable>
                <Pressable
                  disabled={undoBusy}
                  onPress={async () => {
                    setUndoBusy(true);
                    try {
                      for (const pay of payments) await removePayment(pay);
                      setUndoing(false);
                      showToast("Pagamento desfeito · a fatura voltou a ficar em aberto");
                      refresh();
                    } catch {
                      showToast("Não consegui desfazer agora. Tente de novo.");
                    } finally {
                      setUndoBusy(false);
                    }
                  }}
                  style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: undoBusy ? 0.5 : pressed ? 0.8 : 1 })}
                >
                  <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#0B0B0B" }}>{undoBusy ? "Desfazendo…" : "Desfazer"}</Text>
                </Pressable>
              </View>
            </View>
          );
        })()}
      </CenterModal>
    </Room>
  );
}
