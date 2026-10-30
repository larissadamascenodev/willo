import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useCardsOverview, monthKey, type OverviewCard } from "@/hooks/useCardsOverview";
import { getInvoiceStatusLabel, type CreditCardItem } from "@/lib/invoiceCycle";
import { colorFor } from "@/lib/banks";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import AnchoredMenu, { MenuHeader, MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import CardFaceTile, { FREE_LIMIT_HEX, USED_LIMIT_HEX } from "~/components/wallet/CardFaceTile";
import CardFormSheet, { type CardDraft } from "~/components/wallet/CardFormSheet";
import { createCreditCard, updateCreditCard } from "@/services/transactionService";
import { CreditCard, Pencil, Plus, Trash2 } from "~/components/icons";
import { showToast } from "~/lib/toast";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * The wallet.
 *
 * Arriving here there are two questions, in this order: what do all of these add up
 * to, and which card do I want. So the total is the first thing on the page, with
 * nothing drawn around it, and under it the limit — the only thing the sum of the
 * cards needs to say, because what each one is spending is on the card itself.
 *
 * Every figure is the open invoice, the one still to be paid. A credit card is a
 * bill, not a balance.
 */
export default function Cartoes() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { cards, invoices, items, loading, refresh } = useCardsOverview();
  const [held, setHeld] = useState<OverviewCard | null>(null);
  const [heldRect, setHeldRect] = useState<AnchorRect | null>(null);
  /* The card sheet: { card: null } makes a new one, { card } changes that one. */
  const [form, setForm] = useState<{ card: OverviewCard | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const saveCard = async (draft: CardDraft) => {
    if (!user) return;
    setSaving(true);
    setFormError(null);
    try {
      if (form?.card) {
        await updateCreditCard(form.card.id, {
          name: draft.name,
          limit: draft.limit,
          closing_day: draft.closing_day,
          due_day: draft.due_day,
          last_four_digits: draft.last_four_digits,
        });
      } else {
        await createCreditCard(draft, user.id);
      }
      const made = !form?.card;
      setForm(null);
      await refresh();
      showToast(made ? "Cartão criado" : "Cartão atualizado");
    } catch {
      setFormError("Não foi possível salvar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => {
    const now = new Date();
    const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);

    return cards.map((card) => {
      /* The invoice actually open: the earliest from this month on that still owes
         something. Not the calendar month — past the closing day those differ. */
      const open =
        invoices
          .filter(
            (i) =>
              i.cardId === card.id &&
              !i.isPaid &&
              i.total > 0 &&
              monthKey(i.year, i.month) >= currentKey,
          )
          .sort((a, b) => monthKey(a.year, a.month) - monthKey(b.year, b.month))[0] ?? null;

      const item: CreditCardItem = {
        id: card.id,
        name: card.name,
        limit: card.limit,
        used_limit: card.used,
        closing_day: card.closingDay,
        due_day: card.dueDay,
        color: card.color,
        last_four_digits: card.lastFour,
      };

      return {
        card,
        hex: colorFor(card.name, card.color, "#8B5CF6"),
        open,
        /* What the invoice asks for today: a payment already made has left it. */
        total: open ? Math.max(open.total - open.paid, 0) : 0,
        status: getInvoiceStatusLabel(
          item,
          open
            ? { amount: open.total, month: open.month, year: open.year, isPaid: open.isPaid }
            : undefined,
        ),
      };
    });
  }, [cards, invoices]);

  const sums = useMemo(() => {
    /* The lines of the invoices that are open — how many there are, and how many of
       them are instalments of something bought earlier. */
    const openKey = new Map(
      rows.filter((r) => r.open).map((r) => [r.card.id, monthKey(r.open!.year, r.open!.month)]),
    );
    const lines = items.filter((i) => openKey.get(i.cardId) === monthKey(i.year, i.month));

    const limite = rows.reduce((s, r) => s + r.card.limit, 0);
    const usado = rows.reduce((s, r) => s + r.card.used, 0);

    return {
      faturas: rows.reduce((s, r) => s + r.total, 0),
      lancamentos: lines.length,
      parcelados: lines.filter((i) => i.isParcelado).length,
      limite,
      usado,
      disponivel: Math.max(limite - usado, 0),
      usadoPct: limite > 0 ? Math.min((usado / limite) * 100, 100) : 0,
    };
  }, [rows, items]);

  return (
    <Room lit sky>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 44, justifyContent: "center" }}>
          {/* Cartões is a page off the dashboard, and that is where back goes. */}
          <BackButton to="/" />
        </View>

        {/* The shared hook never settles without a session; that is not loading, it
            is nothing to show. */}
        {loading && user ? (
          <View style={{ marginTop: 20, gap: 16 }}>
            <View style={{ height: 90, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
            <Surface style={{ height: 420 }}><View /></Surface>
          </View>
        ) : cards.length === 0 ? (
          <Surface radius={26} style={{ marginTop: 16, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, alignItems: "center" }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: INK.edge,
                backgroundColor: "rgba(255,255,255,0.04)",
              }}
            >
              <CreditCard size={22} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            </View>
            <Text style={{ marginTop: 14, fontSize: 17, fontWeight: "700", color: "#fff" }}>
              Nenhum cartão cadastrado
            </Text>
            <Text style={{ marginTop: 6, maxWidth: 256, textAlign: "center", fontSize: 13.5, lineHeight: 18, color: INK.soft }}>
              Cadastre um cartão para acompanhar faturas, limite e parcelamentos.
            </Text>
          </Surface>
        ) : (
          <>
            {/* ══ The figure itself, with nothing drawn around it ══ */}
            <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 4, paddingTop: 12 }}>
              <Text style={{ fontSize: 13.5, color: "rgba(255,255,255,0.62)" }}>Total em faturas</Text>
              <Text
                numberOfLines={1}
                style={{ marginTop: 4, fontSize: 40, fontWeight: "800", letterSpacing: -1.6, color: "#fff" }}
              >
                {money(sums.faturas)}
              </Text>
              <Text style={{ marginTop: 10, fontSize: 12.5, color: INK.soft }}>
                {sums.lancamentos} {sums.lancamentos === 1 ? "lançamento" : "lançamentos"}
                {sums.parcelados > 0 ? (
                  <Text>
                    <Text style={{ color: "rgba(255,255,255,0.2)" }}> · </Text>
                    {sums.parcelados} parcelado{sums.parcelados === 1 ? "" : "s"}
                  </Text>
                ) : null}
              </Text>
            </Animated.View>

            {/* ══ The limit, loose on the page under the total ══ */}
            <Animated.View entering={FadeInDown.delay(60).duration(450)} style={{ marginTop: 28, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <Text style={[T.eyebrow, { fontSize: 11.5 }]}>Limite</Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: sums.usadoPct >= 100 ? RED : INK.softer,
                  }}
                >
                  {sums.usadoPct.toFixed(0)}% usado
                </Text>
              </View>

              {/* One bar split the way the limit itself is split: each card's share of
                  what is spent, and what is still free at the end. */}
              <View style={{ marginTop: 12, flexDirection: "row", height: 10, gap: 3 }}>
                {rows.map((r, i) => {
                  const share = sums.limite > 0 ? r.card.used / sums.limite : 0;
                  if (share < 0.005) return null;
                  return (
                    <Bar
                      key={r.card.id}
                      share={share}
                      color={USED_LIMIT_HEX}
                      minWidth={6}
                      delay={0.1 + i * 0.06}
                    />
                  );
                })}
                <Bar
                  share={sums.limite > 0 ? sums.disponivel / sums.limite : 1}
                  color={FREE_LIMIT_HEX}
                  minWidth={sums.disponivel > 0 ? 6 : 0}
                  delay={0.2}
                />
              </View>

              {/* Two columns, so the figures are not read as one sentence. */}
              <View style={{ marginTop: 16, flexDirection: "row", gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: USED_LIMIT_HEX }} />
                    <Text style={{ fontSize: 11.5, color: INK.softer }}>Usado</Text>
                  </View>
                  <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 16, fontWeight: "700", color: "rgba(255,255,255,0.72)" }}>
                    {money(sums.usado)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: FREE_LIMIT_HEX }} />
                    <Text style={{ fontSize: 11.5, color: INK.softer }}>Disponível</Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      marginTop: 4,
                      fontSize: 16,
                      fontWeight: "700",
                      color: sums.disponivel > 0 ? FREE_LIMIT_HEX : RED,
                    }}
                  >
                    {money(sums.disponivel)}
                  </Text>
                </View>
              </View>

              <Text style={{ marginTop: 12, fontSize: 11.5, color: INK.faint }}>
                Limite total {money(sums.limite)}
              </Text>
            </Animated.View>

            {/* ══ The cards ══ */}
            <View style={{ marginTop: 24, gap: 12 }}>
              {rows.map((r, i) => (
                <CardFaceTile
                  key={r.card.id}
                  index={i}
                  hex={r.hex}
                  card={{
                    id: r.card.id,
                    name: r.card.name,
                    lastFour: r.card.lastFour,
                    closingDay: r.card.closingDay,
                    dueDay: r.card.dueDay,
                    limit: r.card.limit,
                    used: r.card.used,
                  }}
                  owed={r.total}
                  status={r.status}
                  onOpen={() => router.push(`/fatura/${r.card.id}` as never)}
                  onHold={(rect) => {
                    setHeld(r.card);
                    setHeldRect(rect);
                  }}
                />
              ))}

              <Pressable
                onPress={() => {
                  setFormError(null);
                  setForm({ card: null });
                }}
                style={({ pressed }) => ({
                  height: 54,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: "rgba(255,255,255,0.2)",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Plus size={18} color="rgba(255,255,255,0.82)" strokeWidth={2.4} />
                <Text style={{ fontSize: 14.5, fontWeight: "600", color: "rgba(255,255,255,0.82)" }}>
                  Adicionar cartão
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      <AnchoredMenu open={!!held} anchor={heldRect} onClose={() => setHeld(null)}>
        <MenuHeader title={held?.name ?? ""} subtitle="Cartão de crédito" />
        <MenuRow
          icon={Pencil}
          label="Editar"
          onPress={() => {
            setForm(held ? { card: held } : null);
            setFormError(null);
            setHeld(null);
          }}
        />
        <MenuRow icon={Trash2} label="Excluir" danger last onPress={() => setHeld(null)} />
      </AnchoredMenu>

      <CardFormSheet
        open={!!form}
        initial={
          form?.card
            ? {
                name: form.card.name,
                last_four_digits: form.card.lastFour,
                limit: form.card.limit,
                closing_day: form.card.closingDay,
                due_day: form.card.dueDay,
                color: form.card.color,
              }
            : null
        }
        used={form?.card?.used ?? 0}
        saving={saving}
        error={formError}
        onClose={() => setForm(null)}
        onSave={(d) => void saveCard(d)}
      />
    </Room>
  );
}
