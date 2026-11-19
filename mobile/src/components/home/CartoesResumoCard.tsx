import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useCardsOverview, monthKey } from "@/hooks/useCardsOverview";
import { useAuth } from "~/lib/auth";
import { keepValue, keptValue } from "~/lib/warmStart";
import { getInvoiceStatusLabel, type CreditCardItem } from "@/lib/invoiceCycle";
import { colorFor } from "@/lib/banks";
import { shade } from "@/lib/tone";
import Surface from "~/components/Surface";
import BankMark from "~/components/BankMark";
import { ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { LinearGradient } from "expo-linear-gradient";
import { type as T } from "~/theme/type";

import { th } from "~/theme/theme";
/**
 * What the cards add up to, and which one owes what.
 *
 * A credit card is a bill, so every figure here is the open invoice — the one still
 * to be paid — rather than the limit or the spend. One bar splits the total by card,
 * in each card's own colour, so the shape of the debt is read before any figure is.
 */
export default function CartoesResumoCard({ size = "full" }: { size?: "half" | "full" } = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const live = useCardsOverview();
  /* The last cards seen are drawn while the fresh ones load, never a blank box. */
  const kept = useMemo(
    () => keptValue<{ cards: typeof live.cards; invoices: typeof live.invoices }>("cartoes", user?.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id],
  );
  useEffect(() => {
    if (!live.loading && user) keepValue("cartoes", user.id, { cards: live.cards, invoices: live.invoices });
  }, [live.loading, live.cards, live.invoices, user]);
  const showKept = live.loading && !!kept;
  const cards = showKept ? kept!.cards : live.cards;
  const invoices = showKept ? kept!.invoices : live.invoices;
  const loading = live.loading && !kept;

  const rows = useMemo(() => {
    const now = new Date();
    const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);

    return cards.map((card) => {
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
        owed: open ? Math.max(open.total - open.paid, 0) : 0,
        available: Math.max(card.limit - card.used, 0),
        status: getInvoiceStatusLabel(
          item,
          open
            ? { amount: open.total, month: open.month, year: open.year, isPaid: open.isPaid }
            : undefined,
        ),
      };
    });
  }, [cards, invoices]);

  /* The shared hook never settles without a session; that is not loading, it is
     nothing to show. */
  if (loading && user) return <Surface style={{ height: 196 }}><View /></Surface>;
  if (rows.length === 0) {
    return (
      <Surface onPress={() => router.push("/cartoes")} style={{ flex: 1, padding: size === "half" ? 14 : 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text numberOfLines={1} style={[T.cardLabel, { flex: 1 }, size === "half" && { fontSize: 13 }]}>{size === "half" ? "Cartões" : "Cartões de crédito"}</Text>
          <ChevronRight size={16} color={th(INK.faint)} />
        </View>
        <Text style={{ marginTop: 10, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>Nenhum cartão ainda. Toque para adicionar o primeiro.</Text>
      </Surface>
    );
  }

  const total = rows.reduce((s, r) => s + r.owed, 0);
  const free = rows.reduce((s, r) => s + r.available, 0);
  /* An invoice past its due day is said under the figure, in red, instead of "open". */
  const late = rows.filter((r) => r.owed > 0 && r.status.label.startsWith("Venceu")).length;
  const owedLine = late > 0 ? (late === 1 ? "1 fatura vencida" : `${late} faturas vencidas`) : "em faturas abertas";

  /* One word on the whole: overdue, due soon, or fine. */
  const soon = rows
    .filter((r) => r.owed > 0 && /^Vence (hoje|amanhã|em [1-5] dias?)$/.test(r.status.label))
    .sort((a, b) => order(a.status.label) - order(b.status.label))[0];
  const badge =
    late > 0
      ? { label: late === 1 ? "Vencida" : `${late} vencidas`, tone: RED }
      : soon
        ? { label: soon.status.label, tone: AMBER }
        : { label: total > 0 ? "Em dia" : "Sem fatura", tone: GREEN };

  const half = size === "half";
  /* The cards themselves, stacked at the foot like in a wallet: the one that owes most in front. */
  const faces = [...rows].sort((a, b) => b.owed - a.owed).slice(0, half ? 2 : 3).reverse();
  const FACE = half ? 46 : 58;
  const STEP = half ? 26 : 36;
  const stackH = FACE + STEP * (faces.length - 1);

  return (
    <Surface onPress={() => router.push("/cartoes")} style={{ flex: half ? 1 : undefined, overflow: "hidden", paddingTop: half ? 14 : 18 }}>
      <View style={{ paddingHorizontal: half ? 14 : 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: half ? 14.5 : 16, fontWeight: "600", color: th("#fff") }}>
            {half ? "Cartões" : "Cartões de crédito"}
          </Text>
          <View style={{ paddingHorizontal: half ? 8 : 11, height: half ? 22 : 28, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: th(tint(badge.tone, 0.35), "line"), backgroundColor: th(tint(badge.tone, 0.14), "bg") }}>
            <Text numberOfLines={1} style={{ fontSize: half ? 11 : 13, fontWeight: "700", color: th(badge.tone) }}>{badge.label}</Text>
          </View>
        </View>

        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ marginTop: half ? 10 : 18, fontSize: half ? 25 : 40, fontWeight: "600", letterSpacing: half ? -0.8 : -1.4, color: th("#fff"), fontVariant: ["tabular-nums"] }}>
          {whole(total)}
          <Text style={{ color: th(INK.faint) }}>{cents(total)}</Text>
        </Text>
        <Text numberOfLines={1} style={{ marginTop: 1, fontSize: half ? 12 : 14, fontWeight: late > 0 ? "600" : "400", color: th(late > 0 ? RED : INK.soft) }}>
          {half ? owedLine : `${owedLine} · ${money(free)} livres`}
        </Text>
      </View>

      {/* The stack, its front card's foot on the card's edge. */}
      <View style={{ marginTop: half ? "auto" : 20, height: stackH + (half ? 8 : 12), paddingHorizontal: half ? 8 : 12 }}>
        {faces.map((r, i) => {
          const front = i === faces.length - 1;
          return (
            <View
              key={r.card.id}
              style={{
                position: "absolute",
                left: half ? 8 : 12,
                right: half ? 8 : 12,
                top: i * STEP,
                height: FACE,
                borderRadius: half ? 14 : 18,
                borderCurve: "continuous",
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.22)",
                shadowColor: "#000",
                shadowOpacity: 0.35,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: -2 },
              }}
            >
              <LinearGradient colors={[lift(r.hex, 0.28), r.hex]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
              <View style={{ flex: 1, flexDirection: "row", alignItems: front || !half ? "center" : "flex-start", paddingTop: front || !half ? 0 : 6, paddingHorizontal: half ? 10 : 14, gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: half ? 12.5 : 15, fontWeight: "700", letterSpacing: 0.3, color: "#FFFFFF", fontVariant: ["tabular-nums"] }}>
                  {r.card.lastFour ? `•••• ${r.card.lastFour}` : r.card.name}
                </Text>
                {!half && r.owed > 0 && <Text style={{ fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.9)", fontVariant: ["tabular-nums"] }}>{money(r.owed)}</Text>}
                <BankMark name={r.card.name} hex={shadeHex(r.hex)} size={half ? 20 : 24} />
              </View>
            </View>
          );
        })}
      </View>
    </Surface>
  );
}

/** "R$ 2.039" and ",37": the cents are drawn quieter, as the big apps do. */
const whole = (v: number) => money(v).replace(/,\d{2}$/, "");
const cents = (v: number) => (money(v).match(/,\d{2}$/)?.[0] ?? "");

/** Soonest first: today, tomorrow, then in so many days. */
const order = (label: string) => (label === "Vence hoje" ? 0 : label === "Vence amanhã" ? 1 : Number(label.match(/\d+/)?.[0] ?? 9));

/** A colour at some strength, for fills and borders; #rrggbb or rgb() in. */
function tint(color: string, a: number) {
  const [r, g, b] = rgb(color);
  return `rgba(${r},${g},${b},${a})`;
}

/** A colour lifted toward white, for the top of a card face. */
function lift(color: string, t: number) {
  const [r, g, b] = rgb(color).map((c) => Math.round(c + (255 - c) * t));
  return `rgb(${r},${g},${b})`;
}

/** The face's own colour, a shade deeper, so the bank's mark stands on it. */
function shadeHex(color: string) {
  const [r, g, b] = rgb(color).map((c) => Math.round(c * 0.7));
  return `rgb(${r},${g},${b})`;
}

function rgb(color: string): [number, number, number] {
  const h = /^#([0-9a-f]{6})$/i.exec(color);
  if (h) return [parseInt(h[1].slice(0, 2), 16), parseInt(h[1].slice(2, 4), 16), parseInt(h[1].slice(4, 6), 16)];
  const m = color.match(/\d+(\.\d+)?/g);
  if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])];
  return [139, 92, 246];
}
