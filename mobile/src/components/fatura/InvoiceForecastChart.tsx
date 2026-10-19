import { useMemo, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import MaskedViewFallback from "react-native";
import { shade } from "@/lib/tone";
import type { Invoice } from "@/services/invoiceService";
import { Check } from "~/components/icons";
import { money } from "~/lib/money";
import { INK } from "~/theme/tokens";

/**
 * What this card is about to ask for.
 *
 * A credit card's history is settled; what you can still act on is what has not been
 * billed yet, and that is already known, because every instalment of every plan is
 * already written into a future invoice. So the strip opens on the invoice that is
 * open — always, on every visit — and runs forward from there.
 *
 * The months before it are still there, to the left, for when you want them. You
 * reach them by pulling the strip back, and the next time you arrive it has returned
 * to where it starts. That way the past is available without ever being the first
 * thing you see.
 */

const MONTH_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

type Status = "paga" | "aberta" | "futura";

/** How far back the strip can be pulled. */
const PAST_MONTHS = 12;
const BAR_W = 46;
const GAP = 8;
const TRACK = 96;

/** R$ 1.743,20 is unreadable at 46px wide; "1,7k" is the same number you can see. */
function short(v: number) {
  if (v <= 0) return "—";
  if (v >= 1000) {
    const k = v / 1000;
    return `${(k >= 10 ? Math.round(k) : Number(k.toFixed(1))).toLocaleString("pt-BR")}k`;
  }
  return Math.round(v).toLocaleString("pt-BR");
}

export default function InvoiceForecastChart({
  invoices,
  selectedMonth,
  selectedYear,
  onSelect,
  closingDay,
  hex,
}: {
  invoices: Invoice[];
  selectedMonth: number;
  selectedYear: number;
  onSelect: (month: number, year: number) => void;
  /** Closing day, so "open" follows the billing cycle and not the calendar. */
  closingDay?: number | null;
  /** The card's own colour: this strip is about one card, so it wears it. */
  hex: string;
}) {
  const scroller = useRef<ScrollView>(null);
  const parked = useRef(false);

  const { bars, openPeriod, committed, lastLabel } = useMemo(() => {
    const now = new Date();
    const currentPeriod = now.getFullYear() * 12 + now.getMonth();
    /* Past the closing day, this month's invoice is shut and the open one is the
       next: with a closing day of 6, October is already open on 26 September. */
    const open = currentPeriod + (closingDay && now.getDate() >= closingDay ? 1 : 0);

    const at = (period: number) => {
      const y = Math.floor(period / 12);
      const m = (period % 12) + 1;
      const inv = invoices.find((i) => i.month === m && i.year === y);
      if (!inv) return { amount: 0, isPaid: false };
      const raw = Number(inv.total_amount);
      const paid = Number((inv as any).paid_amount ?? 0);
      const isPaid = inv.is_paid ?? false;
      return { amount: !isPaid && paid > 0 ? Math.max(raw - paid, 0) : raw, isPaid };
    };

    const lastWithData = invoices.reduce(
      (acc, inv) => Math.max(acc, inv.year * 12 + (inv.month - 1)),
      open,
    );
    const end = Math.max(lastWithData, open + 3);

    const list: { period: number; month: number; year: number; amount: number; status: Status }[] = [];
    let total = 0;
    for (let p = open - PAST_MONTHS; p <= end; p++) {
      const { amount, isPaid } = at(p);
      if (p >= open) total += amount;
      list.push({
        period: p,
        month: (p % 12) + 1,
        year: Math.floor(p / 12),
        amount,
        status: isPaid ? "paga" : p > open ? "futura" : "aberta",
      });
    }

    /* The past only goes back as far as the app was there for. A run of empty months
       is not history, it is the time before you started, and pulling the strip into
       it says the card spent nothing when in truth nobody was looking. */
    while (list.length > 1 && list[0].period < open && list[0].amount <= 0) list.shift();

    /* The horizon is where the plans actually end, not where the window does. */
    const lastPaying = [...list].reverse().find((b) => b.amount > 0);
    return {
      bars: list,
      openPeriod: open,
      committed: total,
      lastLabel: lastPaying
        ? `${MONTH_SHORT[lastPaying.month - 1]}/${String(lastPaying.year).slice(2)}`
        : null,
    };
  }, [invoices, closingDay]);

  const max = useMemo(() => Math.max(...bars.map((b) => b.amount), 1), [bars]);

  /* The one scroll this strip performs: on arrival, the open invoice is put at the
     left edge. Selecting a month never moves it — that would pull the strip out from
     under the finger dragging it. */
  const parkAtOpen = () => {
    if (parked.current || bars.length === 0) return;
    const index = bars.findIndex((b) => b.period === openPeriod);
    if (index < 0) return;
    scroller.current?.scrollTo({ x: index * (BAR_W + GAP), animated: false });
    parked.current = true;
  };

  return (
    <View style={{ paddingHorizontal: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <View>
          <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase", color: INK.soft }}>
            Próximas faturas
          </Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: "#fff" }}>
            {money(committed)}
          </Text>
        </View>
        {lastLabel && (
          <Text style={{ textAlign: "right", fontSize: 11.5, lineHeight: 14, color: INK.faint }}>
            comprometido{"\n"}até {lastLabel}
          </Text>
        )}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={parkAtOpen}
        contentContainerStyle={{ gap: GAP, alignItems: "flex-end", paddingBottom: 4, paddingRight: 18 }}
        style={{ marginTop: 20 }}
      >
        {bars.map((bar) => {
          const selected = bar.month === selectedMonth && bar.year === selectedYear;
          const past = bar.period < openPeriod;
          const height = bar.amount > 0 ? Math.max(16, (bar.amount / max) * TRACK) : 5;
          return (
            <Pressable
              key={bar.period}
              onPress={() => onSelect(bar.month, bar.year)}
              style={{ width: BAR_W, alignItems: "center", gap: 6 }}
            >
              {/* The figure above its own bar: reading a chart should not need a tap. */}
              <Text style={{ fontSize: 10.5, fontWeight: "600", color: selected ? "#fff" : INK.faint }}>
                {short(bar.amount)}
              </Text>

              <View style={{ height: TRACK, width: "100%", justifyContent: "flex-end" }}>
                <View
                  style={{
                    height,
                    width: "100%",
                    borderRadius: 9,
                    /* Settled and open invoices are the card's colour at full
                       strength; the ones still to come are the same colour, lighter.
                       One hue, so any bank's card reads the same way. */
                    backgroundColor: bar.status === "futura" ? shade(hex, 0.55) : hex,
                    opacity: selected ? 1 : past ? 0.45 : 0.72,
                  }}
                />
                {/* A settled month wears its tick, so paid and open are never the
                    same thing drawn in the same colour. */}
                {bar.status === "paga" && bar.amount > 0 && (
                  <View style={{ position: "absolute", left: 0, right: 0, bottom: 6, alignItems: "center" }}>
                    <View
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: 9,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(0,0,0,0.35)",
                      }}
                    >
                      <Check size={11} color="#fff" strokeWidth={3.4} />
                    </View>
                  </View>
                )}
              </View>

              <Text
                style={{
                  fontSize: 11,
                  fontWeight: selected ? "700" : "400",
                  color: selected ? "#fff" : past ? INK.faint : INK.soft,
                }}
              >
                {MONTH_SHORT[bar.month - 1]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Legend hex={hex} label="Paga" tick />
        <Legend hex={hex} label="Em aberto" />
        <Legend hex={shade(hex, 0.55)} label="A vencer" />
      </View>
    </View>
  );
}

function Legend({ hex, label, tick }: { hex: string; label: string; tick?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: tick ? 12 : 10,
          height: tick ? 12 : 10,
          borderRadius: 3,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: hex,
        }}
      >
        {tick && <Check size={8} color="#fff" strokeWidth={4} />}
      </View>
      <Text style={{ fontSize: 11, color: INK.softer }}>{label}</Text>
    </View>
  );
}
