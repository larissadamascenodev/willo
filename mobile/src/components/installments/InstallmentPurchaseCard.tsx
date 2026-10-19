import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { categoryHex } from "@/lib/categoryData";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import type { CustomCategory } from "@/services/categoryService";
import { cardHex as hexFor } from "@/hooks/useCardsOverview";
import { chipFill, chipInk } from "~/lib/chip";
import { categoryIcon } from "~/lib/categoryIcon";
import { AlertTriangle, Check, ChevronDown, Wallet } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * One parcelled purchase.
 *
 * Three things about it have to be legible at a glance, and they are three different
 * shapes rather than three numbers: a ring around the glyph for how far along the
 * purchase is, one tick per instalment for which ones are behind you, and the money
 * — this month's slice against the whole. The schedule underneath is the same
 * information written out, and stays folded until it is asked for.
 */

const SCHEDULE_PREVIEW = 4;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;

const shortMonth = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

const monthLabel = (d: Date) =>
  d
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "")
    .replace(" de ", "/");

/** The ring that closes as the instalments are paid. */
function ProgressRing({ share, color }: { share: number; color: string }) {
  const drawn = useSharedValue(0);

  useEffect(() => {
    drawn.value = withDelay(
      120,
      withTiming(Math.max(share, 0.04), { duration: 800, easing: Easing.out(Easing.cubic) }),
    );
  }, [share, drawn]);

  const animated = useAnimatedProps(() => ({
    strokeDasharray: [drawn.value * RING_C, RING_C],
  }));

  return (
    <Svg
      viewBox="0 0 48 48"
      width={48}
      height={48}
      style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
    >
      <Circle cx="24" cy="24" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2.5} />
      <AnimatedCircle
        cx="24"
        cy="24"
        r={RING_R}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        animatedProps={animated}
      />
    </Svg>
  );
}

export default function InstallmentPurchaseCard({
  item,
  index,
  customCats,
  card,
  onOpen,
}: {
  item: ActiveInstallmentItem;
  index: number;
  customCats: CustomCategory[];
  card?: { name: string; color: string | null };
  /** Tapping the card opens the purchase; the chevron still unfolds the schedule. */
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const paidCount = item.installment_current - 1;
  const remaining = item.installments - paidCount;
  const total = item.amount * item.installments;
  const Icon = categoryIcon(item.category, customCats);
  const hex = categoryHex(item.category, customCats);
  const isCard = item.payment_method === "cartao";

  const start = new Date(`${item.date.slice(0, 10)}T12:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + (item.installments - 1));
  const next = item.dueDate ? new Date(`${item.dueDate.slice(0, 10)}T12:00:00`) : null;

  /* Past two dozen instalments the ticks come out thinner than the gaps between
     them, and a row of hairlines reads as noise rather than as a count. */
  const denseTrack = item.installments > 24;

  const schedule = Array.from({ length: item.installments }, (_, n) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + n);
    return {
      n: n + 1,
      date: d,
      status: n < paidCount ? "paga" : n === paidCount ? "atual" : "futura",
    } as const;
  });

  const shownSchedule = showAll ? schedule : schedule.slice(paidCount, paidCount + SCHEDULE_PREVIEW);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 30).duration(350)}
      layout={LinearTransition.springify().damping(24).stiffness(220)}
      style={{
        overflow: "hidden",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: item.isOverdue ? "rgba(248,113,113,0.30)" : "rgba(255,255,255,0.10)",
        backgroundColor: "rgba(255,255,255,0.062)",
      }}
    >
      <Pressable
        onPress={() => (onOpen ? onOpen() : setOpen((v) => !v))}
        style={({ pressed }) => ({
          paddingHorizontal: 14,
          paddingVertical: 12,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        {/* ── Who it is, where it is charged, what it costs ── */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
            <ProgressRing share={item.installment_current / item.installments} color={hex} />
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: chipFill(hex),
              }}
            >
              <Icon size={18} color={chipInk(hex)} strokeWidth={2} />
            </View>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
              {item.name}
            </Text>
            <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 }}>
              {item.isOverdue ? (
                <AlertTriangle size={12} color={RED} />
              ) : isCard ? (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: hexFor(card?.color ?? null),
                  }}
                />
              ) : (
                <Wallet size={12} color={INK.soft} />
              )}
              <Text
                numberOfLines={1}
                style={{ flex: 1, minWidth: 0, fontSize: 12, color: item.isOverdue ? RED : INK.soft }}
              >
                {item.isOverdue ? "Em atraso · " : ""}
                {isCard ? (card?.name ?? "Cartão") : "Conta"}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{money(item.amount)}</Text>
            <Text style={{ marginTop: 1, fontSize: 11, color: INK.softer }}>de {money(total)}</Text>
          </View>
        </View>

        {/* ── How far along ── */}
        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 12, color: INK.soft }}>
            Parcela <Text style={{ fontWeight: "700", color: "#fff" }}>{item.installment_current}</Text> de{" "}
            {item.installments}
          </Text>
          <Text style={{ fontSize: 11, color: INK.softer }}>
            {remaining} {remaining === 1 ? "restante" : "restantes"}
          </Text>
        </View>

        {denseTrack ? (
          <View
            style={{
              marginTop: 6,
              height: 6,
              borderRadius: 999,
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            <View
              style={{
                height: "100%",
                borderRadius: 999,
                backgroundColor: GREEN,
                width: `${(paidCount / item.installments) * 100}%`,
              }}
            />
          </View>
        ) : (
          <View style={{ marginTop: 6, flexDirection: "row", gap: 3 }}>
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
                      : s.status === "atual"
                        ? item.isOverdue
                          ? RED
                          : "#fff"
                        : "rgba(255,255,255,0.10)",
                }}
              />
            ))}
          </View>
        )}

        <View
          style={{
            marginTop: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 11, color: INK.soft }}>
            Falta {money(item.amount * remaining)} ·{" "}
            {next
              ? `próxima ${next.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")}`
              : `até ${monthLabel(end)}`}
          </Text>
          <Pressable
            accessibilityLabel={open ? "Recolher parcelas" : "Ver parcelas"}
            hitSlop={10}
            onPress={() => setOpen((v) => !v)}
            style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
          >
            <ChevronDown
              size={16}
              color={INK.soft}
              style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
            />
          </Pressable>
        </View>
      </Pressable>

      {/* ── The same instalments, written out ── */}
      {open && (
        <Animated.View
          entering={FadeIn.duration(220)}
          style={{
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.06)",
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <View>
            {/* The rail the ticks hang off, so the column reads as one run of time. */}
            <View
              style={{
                position: "absolute",
                left: 9,
                top: 12,
                bottom: 12,
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
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderRadius: 14,
                    paddingVertical: 8,
                    paddingRight: 8,
                    backgroundColor: isCurrent ? "rgba(255,255,255,0.05)" : "transparent",
                  }}
                >
                  <View
                    style={{
                      width: 19,
                      height: 19,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: isPaid || isCurrent ? 0 : 1,
                      borderColor: "rgba(255,255,255,0.20)",
                      backgroundColor: isPaid
                        ? GREEN
                        : isCurrent
                          ? item.isOverdue
                            ? RED
                            : "#fff"
                          : "rgba(255,255,255,0.062)",
                    }}
                  >
                    {isPaid && <Check size={12} color="#0B0B0B" strokeWidth={3} />}
                  </View>
                  <Text style={{ width: 30, fontSize: 12, color: isPaid ? INK.softer : INK.soft }}>
                    {s.n}ª
                  </Text>
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
                  </Text>
                  {isCurrent && (
                    <Text
                      style={{
                        overflow: "hidden",
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        fontSize: 10,
                        fontWeight: "700",
                        backgroundColor: item.isOverdue
                          ? "rgba(248,113,113,0.15)"
                          : "rgba(255,255,255,0.15)",
                        color: item.isOverdue ? RED : "#fff",
                      }}
                    >
                      {item.isOverdue ? "Em atraso" : "Este mês"}
                    </Text>
                  )}
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: isPaid ? "400" : "500",
                      color: isPaid ? INK.softer : "#fff",
                      textDecorationLine: isPaid ? "line-through" : "none",
                    }}
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
                marginTop: 8,
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
              <Text style={{ fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.82)" }}>
                {showAll ? "Mostrar menos" : `Ver todas as ${schedule.length} parcelas`}
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
