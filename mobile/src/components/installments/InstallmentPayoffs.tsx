import { useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import { categoryHex } from "@/lib/categoryData";
import type { ProjectionMonth } from "@/services/activeInstallments";
import type { CustomCategory } from "@/services/categoryService";
import { SURFACE_FILL } from "~/components/Surface";
import CenterModal from "~/components/CenterModal";
import { Check, ChevronRight } from "~/components/icons";
import { chipFill, chipInk } from "~/lib/chip";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";

/**
 * What you finish paying in the month chosen on the chart.
 *
 * One tight block: the purchases that end, their marks overlapping on the left, and
 * two short lines — how many end, and what that frees from the month after. Tapped,
 * it lifts every one of them into the middle of the screen. Under it, the next month
 * something ends, one tap away.
 */

const MARKS = 4;
const RULE = "rgba(255,255,255,0.07)";

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

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
  const ending = endingIn(picked);
  const freed = ending.reduce((s, x) => s + x.amount, 0);
  const after = months[selected + 1];

  const nextIndex = months.findIndex((m, i) => i > selected && endingIn(m).length > 0);
  const next = nextIndex > 0 ? months[nextIndex] : null;
  const nextEnding = next ? endingIn(next) : [];

  return (
    <>
      <View style={{ overflow: "hidden", borderRadius: 22, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: SURFACE_FILL }}>
        <Pressable
          disabled={ending.length === 0}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, opacity: pressed ? 0.75 : 1 })}
        >
          {ending.length > 0 ? (
            <View style={{ flexDirection: "row" }}>
              {ending.slice(0, MARKS).map((part, i) => {
                const Icon = categoryIcon(part.category, customCats);
                const hex = categoryHex(part.category, customCats);
                return (
                  <View
                    key={part.id}
                    style={{
                      marginLeft: i === 0 ? 0 : -10,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: "#121316",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: chipFill(hex),
                    }}
                  >
                    <Icon size={14} color={chipInk(hex)} strokeWidth={2} />
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" }}>
              <Check size={14} color={INK.softer} strokeWidth={2.6} />
            </View>
          )}

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>
              {ending.length === 0 ? "Nenhuma compra termina" : `${ending.length} ${ending.length === 1 ? "compra termina" : "compras terminam"}`}
            </Text>
            <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>
              {ending.length === 0 ? (
                `${selected === 0 ? "Este mês" : name(picked)} segue igual`
              ) : after ? (
                <>
                  <Text style={[nums, { fontWeight: "700", color: GREEN }]}>+{money(freed)}</Text>/mês a partir de {SHORT[after.month]}
                </>
              ) : (
                "É o último mês de parcelas"
              )}
            </Text>
          </View>
          {ending.length > 0 && <ChevronRight size={16} color={INK.softer} />}
        </Pressable>

        {next && (
          <Pressable
            onPress={() => onSelect(nextIndex)}
            style={({ pressed }) => ({ marginHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: RULE, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.6 : 1 })}
          >
            <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK.soft }}>
              Próxima em <Text style={{ fontWeight: "600", color: "#fff" }}>{name(next)}</Text> · {nextEnding[0].name}
              {nextEnding.length > 1 ? ` e mais ${nextEnding.length - 1}` : ""}
            </Text>
            <ChevronRight size={15} color={INK.softer} />
          </Pressable>
        )}
      </View>

      <CenterModal
        open={open}
        onClose={() => setOpen(false)}
        title="Quitações"
        subtitle={`${ending.length} ${ending.length === 1 ? "compra termina" : "compras terminam"} ${selected === 0 ? "este mês" : `em ${name(picked)}`}`}
      >
        {after && freed > 0 && (
          <View style={{ marginBottom: 6, borderRadius: 16, padding: 14, backgroundColor: "rgba(200,243,109,0.08)" }}>
            <Text style={{ fontSize: 12.5, color: INK.soft }}>A partir de {name(after)}</Text>
            <Text style={[nums, { marginTop: 2, fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: GREEN }]}>+{money(freed)} por mês</Text>
          </View>
        )}
        {ending.map((part, i) => {
          const Icon = categoryIcon(part.category, customCats);
          const hex = categoryHex(part.category, customCats);
          return (
            <View key={part.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.06)" }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
                <Icon size={17} color={chipInk(hex)} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>{part.name}</Text>
                <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Check size={11} color={GREEN} strokeWidth={3} />
                  <Text style={{ fontSize: 12, color: INK.softer }}>{part.total} de {part.total} parcelas</Text>
                </View>
              </View>
              <Text style={[nums, { fontSize: 15, fontWeight: "600", color: "#fff" }]}>{money(part.amount)}</Text>
            </View>
          );
        })}
      </CenterModal>
    </>
  );
}
