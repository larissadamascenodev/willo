import { useMemo, useRef, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import MaskedViewFallback from "react-native";
import { shade } from "@/lib/tone";
import type { Invoice } from "@/services/invoiceService";
import { Check } from "~/components/icons";
import { money } from "~/lib/money";
import { AMBER, INK, RED } from "~/theme/tokens";

import { th } from "~/theme/theme";
/**
 * What this card is about to ask for.
 *
 * A credit card's history is settled; what you can still act on is what has not been
 * billed yet, and that is already known, because every instalment of every plan is
 * already written into a future invoice. So the strip opens on the invoice that is
 * open — always, on every visit — and runs forward from there.
 *
 * Except when an invoice before it is still unpaid: then the strip opens on that one,
 * because it is still owed. It wears its own colour — amber once closed, red once past
 * its due day — until it is paid, and the open invoice keeps the card's colour.
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

type Status = "paga" | "aberta" | "futura" | "fechada" | "vencida";

/** How far back the strip can be pulled. */
const PAST_MONTHS = 12;
const BAR_W = 46;
const GAP = 8;
const TRACK = 96;

export default function InvoiceForecastChart({
  invoices,
  selectedMonth,
  selectedYear,
  onSelect,
  closingDay,
  dueDay,
  hex,
}: {
  invoices: Invoice[];
  selectedMonth: number;
  selectedYear: number;
  onSelect: (month: number, year: number) => void;
  /** Closing day, so "open" follows the billing cycle and not the calendar. */
  closingDay?: number | null;
  /** Due day, so a closed invoice left unpaid past it shows as overdue. */
  dueDay?: number | null;
  /** The card's own colour: this strip is about one card, so it wears it. */
  hex: string;
}) {
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const parked = useRef(false);

  const { bars, openPeriod, startPeriod, committed, lastLabel } = useMemo(() => {
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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    /* Closed and still owed: due on its due day, in its own month. */
    const owedStatus = (p: number): Status => {
      const y = Math.floor(p / 12);
      const m = p % 12;
      const last = new Date(y, m + 1, 0).getDate();
      const due = new Date(y, m, Math.min(dueDay ?? last, last));
      return today > due ? "vencida" : "fechada";
    };

    /* The strip opens on the oldest invoice still owed, or on the open one. */
    let start = open;
    for (let p = open - PAST_MONTHS; p < open; p++) {
      const { amount, isPaid } = at(p);
      if (!isPaid && amount > 0) {
        start = p;
        break;
      }
    }

    for (let p = open - PAST_MONTHS; p <= end; p++) {
      const { amount, isPaid } = at(p);
      if (p >= start && !isPaid) total += amount;
      list.push({
        period: p,
        month: (p % 12) + 1,
        year: Math.floor(p / 12),
        amount,
        status: isPaid ? "paga" : p > open ? "futura" : p === open ? "aberta" : amount > 0 ? owedStatus(p) : "aberta",
      });
    }

    /* The past only goes back as far as the app was there for. A run of empty months
       is not history, it is the time before you started, and pulling the strip into
       it says the card spent nothing when in truth nobody was looking. */
    while (list.length > 1 && list[0].period < start && list[0].amount <= 0) list.shift();

    /* The horizon is where the plans actually end, not where the window does. */
    const lastPaying = [...list].reverse().find((b) => b.amount > 0);
    return {
      bars: list,
      openPeriod: open,
      startPeriod: start,
      committed: total,
      lastLabel: lastPaying
        ? `${MONTH_SHORT[lastPaying.month - 1]}/${String(lastPaying.year).slice(2)}`
        : null,
    };
  }, [invoices, closingDay, dueDay]);

  const max = useMemo(() => Math.max(...bars.map((b) => b.amount), 1), [bars]);

  /* The one scroll this strip performs: on arrival, the open invoice is put at the
     left edge. Selecting a month never moves it — that would pull the strip out from
     under the finger dragging it. */
  const parkAtOpen = () => {
    if (parked.current || bars.length === 0) return;
    const index = bars.findIndex((b) => b.period === startPeriod);
    if (index < 0) return;
    scroller.current?.scrollTo({ x: index * (BAR_W + GAP), animated: false });
    parked.current = true;
  };

  return (
    <View style={{ paddingHorizontal: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <View>
          <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase", color: th(INK.soft) }}>
            Próximas faturas
          </Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: th("#fff") }}>
            {money(committed)}
          </Text>
        </View>
        {lastLabel && (
          <Text style={{ textAlign: "right", fontSize: 11.5, lineHeight: 14, color: th(INK.faint) }}>
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
          const owed = bar.status === "fechada" || bar.status === "vencida";
          const past = bar.period < openPeriod && !owed;
          const height = bar.amount > 0 ? Math.max(16, (bar.amount / max) * TRACK) : 5;
          return (
            <Pressable
              key={bar.period}
              onPress={() => onSelect(bar.month, bar.year)}
              style={{ width: BAR_W, alignItems: "center", gap: 6 }}
            >
              <View style={{ height: TRACK, width: "100%", justifyContent: "flex-end" }}>
                <View
                  style={{
                    height,
                    width: "100%",
                    borderRadius: 9,
                    /* Settled and open invoices are the card's colour at full
                       strength; the ones still to come are the same colour, lighter.
                       One hue, so any bank's card reads the same way. */
                    backgroundColor: th(
                      bar.status === "vencida" ? RED : bar.status === "fechada" ? AMBER : bar.status === "futura" ? shade(hex, 0.55) : hex,
                      "bg",
                    ),
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
                        backgroundColor: th("rgba(0,0,0,0.35)", "bg"),
                      }}
                    >
                      <Check size={11} color={th("#fff")} strokeWidth={3.4} />
                    </View>
                  </View>
                )}
              </View>

              <Text
                style={{
                  fontSize: 11,
                  fontWeight: selected ? "700" : "400",
                  color: th(selected ? "#fff" : past ? INK.faint : INK.soft),
                }}
              >
                {MONTH_SHORT[bar.month - 1]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 16, rowGap: 8 }}>
        {bars.some((b) => b.status === "vencida") && <Legend hex={RED} label="Vencida" />}
        {bars.some((b) => b.status === "fechada") && <Legend hex={AMBER} label="Fechada" />}
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
          backgroundColor: th(hex, "bg"),
        }}
      >
        {tick && <Check size={8} color={th("#fff")} strokeWidth={4} />}
      </View>
      <Text style={{ fontSize: 11, color: th(INK.softer) }}>{label}</Text>
    </View>
  );
}
