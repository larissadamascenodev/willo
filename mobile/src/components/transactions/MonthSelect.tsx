import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import BottomSheet from "~/components/BottomSheet";
import GlassShape from "~/components/GlassShape";
import { ChevronDown, ChevronLeft, ChevronRight } from "~/components/icons";
import { GREEN, INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * The month on show, named in full ("Novembro"), with a small arrow: a touch opens the months
 * to choose from — the year at the top with a step each side, the twelve months in a grid
 * under it, the one on show lit, today's marked with a dot — instead of stepping a month at a
 * time. A month outside this year carries its year.
 */

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function MonthSelect({ month, year, onChange }: { month: number; year: number; onChange: (month: number, year: number) => void }) {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [shownYear, setShownYear] = useState(year);
  useEffect(() => {
    if (open) setShownYear(year);
  }, [open, year]);
  const label = `${MONTHS[month]}${year !== now.getFullYear() ? ` ${year}` : ""}`;
  const pick = (m: number) => {
    void Haptics.selectionAsync().catch(() => undefined);
    onChange(m, shownYear);
    setOpen(false);
  };
  const isNow = month === now.getMonth() && year === now.getFullYear();

  return (
    <>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync().catch(() => undefined);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Escolher o mês`}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <GlassShape radius={22} style={{ height: 44 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 16, paddingRight: 12 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>
              {label}
            </Text>
            <ChevronDown size={17} color={th("rgba(255,255,255,0.75)")} strokeWidth={2.4} />
          </View>
        </GlassShape>
      </Pressable>

      <BottomSheet open={open} onClose={() => setOpen(false)} glass>
        <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 18 }}>
          {/* The year, a step each side. */}
          <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable onPress={() => setShownYear((y) => y - 1)} accessibilityRole="button" accessibilityLabel="Ano anterior" hitSlop={8} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
              <ChevronLeft size={20} color={th("#fff")} strokeWidth={2.4} />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: "700", color: th("#fff") }}>{shownYear}</Text>
            <Pressable onPress={() => setShownYear((y) => y + 1)} accessibilityRole="button" accessibilityLabel="Próximo ano" hitSlop={8} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
              <ChevronRight size={20} color={th("#fff")} strokeWidth={2.4} />
            </Pressable>
          </View>
          {/* The twelve months. */}
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", rowGap: 10, justifyContent: "space-between" }}>
            {SHORT.map((name, m) => {
              const on = m === month && shownYear === year;
              const today = m === now.getMonth() && shownYear === now.getFullYear();
              return (
                <Pressable
                  key={name}
                  onPress={() => pick(m)}
                  accessibilityRole="button"
                  accessibilityLabel={`${MONTHS[m]} de ${shownYear}`}
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    width: "31.5%",
                    height: 52,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: th(on ? "#FFFFFF" : "rgba(255,255,255,0.06)", "bg"),
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 16, fontWeight: on ? "700" : "600", color: th(on ? "#0B0B0B" : "#fff") }}>{name}</Text>
                  {today && !on ? <View style={{ position: "absolute", bottom: 7, width: 5, height: 5, borderRadius: 2.5, backgroundColor: th(GREEN, "bg") }} /> : null}
                </Pressable>
              );
            })}
          </View>
          {!isNow && (
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync().catch(() => undefined);
                onChange(now.getMonth(), now.getFullYear());
                setOpen(false);
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({ marginTop: 16, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: th(INK.soft) }}>Voltar para o mês atual</Text>
            </Pressable>
          )}
        </View>
      </BottomSheet>
    </>
  );
}
