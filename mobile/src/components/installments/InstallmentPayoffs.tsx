import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import { categoryHex } from "@/lib/categoryData";
import type { ProjectionMonth } from "@/services/activeInstallments";
import type { CustomCategory } from "@/services/categoryService";
import Surface from "~/components/Surface";
import { Check, ChevronRight } from "~/components/icons";
import { chipFill, chipInk } from "~/lib/chip";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";

/**
 * What you finish paying in the month chosen on the chart.
 *
 * The chart says the monthly figure falls; this says why, in the words a person
 * would use — "em novembro você quita as passagens e o curso" — and how much less
 * the month after takes. When nothing ends in the chosen month it says so, and
 * points to the next month that does, one tap away.
 */

const RULE = "rgba(255,255,255,0.07)";

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
  const picked = months[selected];
  if (!picked) return null;

  const thisYear = months[0].year;
  const name = (m: ProjectionMonth) => `${MONTHS[m.month]}${m.year !== thisYear ? ` de ${m.year}` : ""}`;
  const ending = endingIn(picked);
  const freed = ending.reduce((s, x) => s + x.amount, 0);
  const after = months[selected + 1];

  const nextIndex = months.findIndex((m, i) => i > selected && endingIn(m).length > 0);
  const next = nextIndex > 0 ? months[nextIndex] : null;
  const nextEnding = next ? endingIn(next) : [];

  return (
    <Surface>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: ending.length > 0 ? 4 : 14 }}>
        <Text style={{ fontSize: 16, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>Quitações</Text>
        <Text style={{ marginTop: 3, fontSize: 13.5, lineHeight: 19, color: INK.soft }}>
          {ending.length === 0 ? (
            `Nenhuma compra termina ${selected === 0 ? "este mês" : `em ${name(picked)}`}.`
          ) : (
            <>
              {selected === 0 ? "Este mês" : `Em ${name(picked)}`} você quita{" "}
              <Text style={{ fontWeight: "700", color: "#fff" }}>
                {ending.length} {ending.length === 1 ? "compra" : "compras"}
              </Text>
              .
            </>
          )}
        </Text>

        {ending.length > 0 && (
          <View style={{ marginTop: 6 }}>
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
                    borderTopColor: RULE,
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
                      <Text style={{ fontSize: 12, color: INK.softer }}>
                        Última de {part.total} parcelas
                      </Text>
                    </View>
                  </View>
                  <Text style={[nums, { fontSize: 14.5, fontWeight: "600", color: "#fff" }]}>{money(part.amount)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* What the month after gets back. */}
      {ending.length > 0 && after && (
        <View
          style={{
            marginHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: RULE,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN }} />
          <Text style={{ flex: 1, minWidth: 0, fontSize: 13, color: INK.soft }}>
            A partir de {name(after)}, sobram{" "}
            <Text style={[nums, { fontWeight: "700", color: "#fff" }]}>{money(freed)}</Text> por mês.
          </Text>
        </View>
      )}

      {/* The next month something ends, one tap away. */}
      {next && (
        <Pressable
          onPress={() => onSelect(nextIndex)}
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
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12, color: INK.softer }}>Próxima quitação</Text>
            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 13.5, color: "#fff" }}>
              <Text style={{ fontWeight: "600" }}>{name(next)[0].toUpperCase() + name(next).slice(1)}</Text>
              <Text style={{ color: INK.soft }}>
                {" · "}
                {nextEnding[0].name}
                {nextEnding.length > 1 ? ` e mais ${nextEnding.length - 1}` : ""}
              </Text>
            </Text>
          </View>
          <ChevronRight size={16} color={INK.softer} />
        </Pressable>
      )}
    </Surface>
  );
}
