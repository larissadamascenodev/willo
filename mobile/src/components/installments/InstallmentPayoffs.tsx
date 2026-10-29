import { useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { categoryHex } from "@/lib/categoryData";
import type { ProjectionMonth } from "@/services/activeInstallments";
import type { CustomCategory } from "@/services/categoryService";
import { SURFACE_FILL } from "~/components/Surface";
import { Check, ChevronDown, ChevronRight } from "~/components/icons";
import { chipFill, chipInk } from "~/lib/chip";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";
import { EXPAND } from "~/lib/expand";

/**
 * What you finish paying in the month chosen on the chart.
 *
 * Folded, it is a summary — how many purchases end, their marks side by side, and
 * how much less the month after takes. Tapped, it opens where it is to the
 * purchases themselves. When nothing ends in the chosen month it says so, and in
 * either case the next month something does end is one tap away.
 */

const RULE = "rgba(255,255,255,0.07)";
const MARKS = 3;

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const endingIn = (m: ProjectionMonth) => m.parts.filter((x) => x.number === x.total);

export default function InstallmentPayoffs({
  months,
  selected,
  onSelect,
  customCats,
}: {
  months: ProjectionMonth[];
  selected: number;
  onSelect: (index: number) => void;
  customCats: CustomCategory[];
}) {
  const [open, setOpen] = useState(false);
  const picked = months[selected];
  if (!picked) return null;

  const thisYear = months[0].year;
  const name = (m: ProjectionMonth) => `${MONTHS[m.month]}${m.year !== thisYear ? ` de ${m.year}` : ""}`;
  const when = selected === 0 ? "este mês" : `em ${name(picked)}`;
  const ending = endingIn(picked);
  const freed = ending.reduce((s, x) => s + x.amount, 0);
  const after = months[selected + 1];

  const nextIndex = months.findIndex((m, i) => i > selected && endingIn(m).length > 0);
  const next = nextIndex > 0 ? months[nextIndex] : null;
  const nextEnding = next ? endingIn(next) : [];
  const nextName = next ? name(next) : "";

  return (
    <Animated.View
      layout={EXPAND}
      style={{
        overflow: "hidden",
        borderRadius: 22,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: SURFACE_FILL,
      }}
    >
      {/* ── The summary ── */}
      <Pressable
        disabled={ending.length === 0}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, opacity: pressed ? 0.75 : 1 })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12, color: INK.soft }}>Quitações · {selected === 0 ? "este mês" : name(picked)}</Text>
            <Text style={{ marginTop: 5, fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>
              {ending.length === 0
                ? "Nenhuma compra termina"
                : `${ending.length} ${ending.length === 1 ? "compra termina" : "compras terminam"}`}
            </Text>
          </View>

          {ending.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {/* Their marks side by side, so the summary already shows which. */}
              <View style={{ flexDirection: "row", gap: 4 }}>
                {ending.slice(0, MARKS).map((part) => {
                  const Icon = categoryIcon(part.category, customCats);
                  const hex = categoryHex(part.category, customCats);
                  return (
                    <View
                      key={part.id}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: chipFill(hex),
                      }}
                    >
                      <Icon size={13} color={chipInk(hex)} strokeWidth={2} />
                    </View>
                  );
                })}
                {ending.length > MARKS && (
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>+{ending.length - MARKS}</Text>
                  </View>
                )}
              </View>
              <ChevronDown
                size={16}
                color={INK.softer}
                style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
              />
            </View>
          )}
        </View>

        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 7 }}>
          {ending.length > 0 && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN }} />}
          <Text style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, color: INK.soft }}>
            {ending.length === 0 ? (
              `Nenhuma parcela chega ao fim ${when}.`
            ) : after ? (
              <>
                A partir de {name(after)}, sobram{" "}
                <Text style={[nums, { fontWeight: "700", color: "#fff" }]}>{money(freed)}</Text> por mês.
              </>
            ) : (
              "É o último mês de parcelas."
            )}
          </Text>
        </View>
      </Pressable>

      {/* ── The purchases, once asked for ── */}
      {open && ending.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)} style={{ marginHorizontal: 16, borderTopWidth: 1, borderTopColor: RULE, paddingVertical: 4 }}>
          {ending.map((part, i) => {
            const Icon = categoryIcon(part.category, customCats);
            const hex = categoryHex(part.category, customCats);
            return (
              <View
                key={part.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: "rgba(255,255,255,0.05)",
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: chipFill(hex),
                  }}
                >
                  <Icon size={16} color={chipInk(hex)} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14.5, color: "#fff" }}>
                    {part.name}
                  </Text>
                  <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Check size={11} color={GREEN} strokeWidth={3} />
                    <Text style={{ fontSize: 12, color: INK.softer }}>Última de {part.total} parcelas</Text>
                  </View>
                </View>
                <Text style={[nums, { fontSize: 14.5, fontWeight: "600", color: "#fff" }]}>{money(part.amount)}</Text>
              </View>
            );
          })}
        </Animated.View>
      )}

      {/* ── The next month something ends, one tap away ── */}
      {next && (
        <Pressable
          onPress={() => {
            setOpen(false);
            onSelect(nextIndex);
          }}
          style={({ pressed }) => ({
            marginHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: RULE,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 13, color: INK.soft }}>
            Próxima em{" "}
            <Text style={{ fontWeight: "600", color: "#fff" }}>{nextName}</Text>
            {" · "}
            {nextEnding[0].name}
            {nextEnding.length > 1 ? ` e mais ${nextEnding.length - 1}` : ""}
          </Text>
          <ChevronRight size={16} color={INK.softer} />
        </Pressable>
      )}
    </Animated.View>
  );
}
