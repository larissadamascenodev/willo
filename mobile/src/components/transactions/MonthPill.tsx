import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import GlassShape from "~/components/GlassShape";
import { ChevronLeft, ChevronRight } from "~/components/icons";
import { th } from "~/theme/theme";

/**
 * The month on show, as one pill of glass — the same glass as the home's eye-and-bell capsule:
 * a step back on the left, the month in the middle, a step on to the right. Touching the month
 * brings back the current one. A month outside this year carries its year.
 */

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default function MonthPill({ month, year, onChange, compact }: { month: number; year: number; onChange: (month: number, year: number) => void; /** Small, for a page's top corner: the month short, a step each side. */ compact?: boolean }) {
  const now = new Date();
  const current = month === now.getMonth() && year === now.getFullYear();
  const go = (offset: number) => {
    void Haptics.selectionAsync().catch(() => undefined);
    const d = new Date(year, month + offset, 1);
    onChange(d.getMonth(), d.getFullYear());
  };
  const label = `${MONTHS[month]}${year !== now.getFullYear() ? ` ${year}` : ""}`;
  if (compact) {
    const short = `${SHORT[month]}${year !== now.getFullYear() ? ` ${String(year).slice(2)}` : ""}`;
    return (
      <GlassShape radius={22} style={{ height: 44 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 2 }}>
          <Pressable onPress={() => go(-1)} accessibilityRole="button" accessibilityLabel="Mês anterior" hitSlop={4} style={({ pressed }) => ({ width: 30, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
            <ChevronLeft size={17} color={th("#fff")} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            onPress={() => {
              if (current) return;
              void Haptics.selectionAsync().catch(() => undefined);
              onChange(now.getMonth(), now.getFullYear());
            }}
            accessibilityRole="button"
            accessibilityLabel={current ? label : `${label}. Toque para voltar ao mês atual`}
            style={{ minWidth: 40, alignItems: "center" }}
          >
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>
              {short}
            </Text>
          </Pressable>
          <Pressable onPress={() => go(1)} accessibilityRole="button" accessibilityLabel="Próximo mês" hitSlop={4} style={({ pressed }) => ({ width: 30, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
            <ChevronRight size={17} color={th("#fff")} strokeWidth={2.4} />
          </Pressable>
        </View>
      </GlassShape>
    );
  }
  return (
    <GlassShape radius={24} style={{ height: 48, alignSelf: "center" }}>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 3 }}>
        <Pressable onPress={() => go(-1)} accessibilityRole="button" accessibilityLabel="Mês anterior" hitSlop={6} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
          <ChevronLeft size={20} color={th("#fff")} strokeWidth={2.4} />
        </Pressable>
        <Pressable
          onPress={() => {
            if (current) return;
            void Haptics.selectionAsync().catch(() => undefined);
            onChange(now.getMonth(), now.getFullYear());
          }}
          accessibilityRole="button"
          accessibilityLabel={current ? label : `${label}. Toque para voltar ao mês atual`}
          style={{ minWidth: 128, alignItems: "center", paddingHorizontal: 6 }}
        >
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>
            {label}
          </Text>
          {!current && <Text style={{ marginTop: 1, fontSize: 10.5, fontWeight: "600", color: th("rgba(255,255,255,0.55)") }}>voltar para hoje</Text>}
        </Pressable>
        <Pressable onPress={() => go(1)} accessibilityRole="button" accessibilityLabel="Próximo mês" hitSlop={6} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
          <ChevronRight size={20} color={th("#fff")} strokeWidth={2.4} />
        </Pressable>
      </View>
    </GlassShape>
  );
}
