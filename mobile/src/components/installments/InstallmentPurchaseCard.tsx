import { useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";
import { categoryHex } from "@/lib/categoryData";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import type { CustomCategory } from "@/services/categoryService";
import { cardHex as hexFor } from "@/hooks/useCardsOverview";
import { chipFill, chipInk } from "~/lib/chip";
import { categoryIcon } from "~/lib/categoryIcon";
import { Check, ChevronDown } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * One parcelled purchase.
 *
 * Its progress is drawn the way it is paid — one tick per instalment, green once
 * paid, white for the one this month, faint for those still to come — so "three of
 * ten" is something you see before you read it. Above the ticks, what it is and
 * what it takes each month; under them, how far along it is and what is left.
 *
 * Read from a month ahead, the white tick moves to the instalment that falls in
 * that month, and the line under the ticks says which one it is — "7ª de 10 em
 * dezembro", or that it is the last.
 *
 * The schedule is the same information written out month by month, and stays
 * folded until it is asked for.
 */

const SCHEDULE_PREVIEW = 4;
/* Past this many, the ticks come out thinner than the gaps between them. */
const MAX_TICKS = 36;

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const shortMonth = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
const dayMonth = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");

export default function InstallmentPurchaseCard({
  item,
  index,
  customCats,
  card,
  focus,
  monthLabel,
  onOpen,
}: {
  item: ActiveInstallmentItem;
  index: number;
  customCats: CustomCategory[];
  card?: { name: string; color: string | null };
  /** The instalment that falls in the month being read; this month's when left out. */
  focus?: number;
  /** That month in words, "dezembro", for the line under the ticks. */
  monthLabel?: string;
  /** Tapping the card opens the purchase; without it, the tap unfolds the schedule. */
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const paidCount = item.installment_current - 1;
  const remaining = item.installments - paidCount;
  const Icon = categoryIcon(item.category, customCats);
  const hex = categoryHex(item.category, customCats);
  const isCard = item.payment_method === "cartao";
  const late = item.isOverdue;
  const at = focus ?? item.installment_current;
  const ahead = at !== item.installment_current;

  const start = new Date(`${item.date.slice(0, 10)}T12:00:00`);
  const next = item.dueDate ? new Date(`${item.dueDate.slice(0, 10)}T12:00:00`) : null;

  const schedule = Array.from({ length: item.installments }, (_, n) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + n);
    return {
      n: n + 1,
      date: d,
      status: n < paidCount ? "paga" : n === paidCount ? "atual" : "futura",
      focused: n + 1 === at,
    } as const;
  });
  const shownSchedule = showAll ? schedule : schedule.slice(paidCount, paidCount + SCHEDULE_PREVIEW);

  const where = isCard ? (card?.name ?? "Cartão") : "Conta";

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(320)}
      layout={LinearTransition.springify().damping(24).stiffness(220)}
      style={{
        overflow: "hidden",
        borderRadius: 20,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: late ? "rgba(248,113,113,0.32)" : "rgba(255,255,255,0.09)",
        backgroundColor: "rgba(255,255,255,0.055)",
      }}
    >
      <Pressable
        onPress={() => (onOpen ? onOpen() : setOpen((v) => !v))}
        style={({ pressed }) => ({ padding: 14, opacity: pressed ? 0.75 : 1 })}
      >
        {/* ── What it is, and what it takes each month ── */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: chipFill(hex),
            }}
          >
            <Icon size={18} color={chipInk(hex)} strokeWidth={2} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>
              {item.name}
            </Text>
            <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 }}>
              {isCard && !late && (
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: hexFor(card?.color ?? null) }} />
              )}
              <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: late ? RED : INK.soft }}>
                {late ? `Em atraso · ${where}` : `${where} · ${item.category}`}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={[nums, { fontSize: 15.5, fontWeight: "700", color: "#fff" }]}>{money(item.amount)}</Text>
            <Text style={{ marginTop: 1, fontSize: 11.5, color: INK.softer }}>por mês</Text>
          </View>
        </View>

        {/* ── One tick per instalment ── */}
        <View style={{ marginTop: 14 }}>
          {item.installments <= MAX_TICKS ? (
            <View style={{ flexDirection: "row", gap: 3 }}>
              {schedule.map((s) => (
                <View
                  key={s.n}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor:
                      s.status === "paga"
                        ? GREEN
                        : s.status === "atual" && late
                          ? RED
                          : s.focused
                            ? "#fff"
                            : "rgba(255,255,255,0.10)",
                  }}
                />
              ))}
            </View>
          ) : (
            <View style={{ height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.10)" }}>
              <View style={{ height: "100%", width: `${(paidCount / item.installments) * 100}%`, backgroundColor: GREEN }} />
            </View>
          )}
        </View>

        {/* ── How far along, and what is left ── */}
        <View style={{ marginTop: 9, flexDirection: "row", alignItems: "center", gap: 10 }}>
          {ahead ? (
            <>
              <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK.soft }}>
                {at === item.installments ? (
                  <>
                    <Text style={{ fontWeight: "700", color: "#fff" }}>Última</Text> parcela em {monthLabel}
                  </>
                ) : (
                  <>
                    <Text style={{ fontWeight: "700", color: "#fff" }}>{at}ª</Text> de {item.installments} em {monthLabel}
                  </>
                )}
              </Text>
              <Text style={[nums, { fontSize: 12.5, color: INK.soft }]}>
                {at === item.installments ? "quita a compra" : `depois, faltam ${item.installments - at}`}
              </Text>
            </>
          ) : (
            <>
              <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK.soft }}>
                <Text style={{ fontWeight: "700", color: "#fff" }}>{paidCount}</Text> de {item.installments} pagas
                {next && !late ? `, próxima ${dayMonth(next)}` : ""}
              </Text>
              <Text style={[nums, { fontSize: 12.5, color: INK.soft }]}>falta {money(item.amount * remaining)}</Text>
            </>
          )}
          <ChevronDown
            size={15}
            color={INK.softer}
            style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
          />
        </View>
      </Pressable>

      {/* ── The same instalments, written out ── */}
      {open && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", paddingHorizontal: 14, paddingVertical: 10 }}
        >
          <View>
            {/* The rail the marks hang off, so the column reads as one run of time. */}
            <View
              style={{
                position: "absolute",
                left: 9,
                top: 14,
                bottom: 14,
                width: 1,
                backgroundColor: "rgba(255,255,255,0.08)",
              }}
            />
            {shownSchedule.map((s) => {
              const isPaid = s.status === "paga";
              const isCurrent = s.status === "atual";
              return (
                <View
                  key={s.n}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}
                >
                  <View
                    style={{
                      width: 19,
                      height: 19,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: isPaid || isCurrent ? 0 : 1,
                      borderColor: "rgba(255,255,255,0.22)",
                      backgroundColor: isPaid ? GREEN : isCurrent ? (late ? RED : "#fff") : "#151618",
                    }}
                  >
                    {isPaid && <Check size={11} color="#0B0B0B" strokeWidth={3} />}
                  </View>
                  <Text style={[nums, { width: 28, fontSize: 12, color: isPaid ? INK.softer : INK.soft }]}>{s.n}ª</Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 14,
                      textTransform: "capitalize",
                      color: isPaid ? INK.softer : "#fff",
                    }}
                  >
                    {shortMonth(s.date)} {s.date.getFullYear()}
                    {isCurrent ? (
                      <Text style={{ textTransform: "none", color: late ? RED : INK.soft }}>
                        {late ? "  em atraso" : "  este mês"}
                      </Text>
                    ) : s.focused ? (
                      <Text style={{ textTransform: "none", color: INK.soft }}>{`  em ${monthLabel}`}</Text>
                    ) : null}
                  </Text>
                  <Text
                    style={[
                      nums,
                      {
                        fontSize: 14,
                        fontWeight: isPaid ? "400" : "500",
                        color: isPaid ? INK.softer : "#fff",
                        textDecorationLine: isPaid ? "line-through" : "none",
                      },
                    ]}
                  >
                    {money(item.amount)}
                  </Text>
                </View>
              );
            })}
          </View>

          {schedule.length > SCHEDULE_PREVIEW && (
            <Pressable
              onPress={() => setShowAll((v) => !v)}
              style={({ pressed }) => ({
                marginTop: 6,
                height: 36,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.05)",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 12.5, fontWeight: "500", color: "rgba(255,255,255,0.82)" }}>
                {showAll ? "Mostrar menos" : `Ver as ${schedule.length} parcelas`}
              </Text>
              <ChevronDown
                size={14}
                color="rgba(255,255,255,0.82)"
                style={{ transform: [{ rotate: showAll ? "180deg" : "0deg" }] }}
              />
            </Pressable>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}
