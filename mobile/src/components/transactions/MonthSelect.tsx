import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import GlassShape from "~/components/GlassShape";
import { Check, ChevronDown } from "~/components/icons";
import { GREEN, INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * The month on show, named in full ("Novembro"), with a small arrow. A touch drops a short
 * column of months right under the button — the one on show lit with a check, today's marked
 * with a green dot — that scrolls back into the months gone and on into the months ahead. A
 * month outside this year carries its year. Used wherever a month is chosen.
 *
 * `trigger` replaces the named pill with another button (a calendar, say) that opens the same
 * column; `back`/`ahead` say how many months the column reaches each way from today.
 */

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ROW = 46;
const VISIBLE = 6.5;
const WIDTH = 210;

export default function MonthSelect({
  month,
  year,
  onChange,
  trigger,
  back = 24,
  ahead = 12,
}: {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
  trigger?: (open: () => void) => ReactNode;
  back?: number;
  ahead?: number;
}) {
  const now = new Date();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ top: number; bottom: number; left: number; width: number } | null>(null);
  const label = `${MONTHS[month]}${year !== now.getFullYear() ? ` ${year}` : ""}`;

  const open = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    ref.current?.measureInWindow((x, y, w, h) => setAt({ top: y, bottom: y + h, left: x, width: w }));
  };
  const close = () => setAt(null);

  /* From `back` months ago to `ahead` months on, oldest first. */
  const list = Array.from({ length: back + ahead + 1 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - back + i, 1));
  const chosen = Math.max(0, list.findIndex((d) => d.getMonth() === month && d.getFullYear() === year));
  const height = Math.min(list.length, VISIBLE) * ROW + 8;

  /* Under the button, its right edge on the button's (they sit in a corner); above it when there is no room below. */
  const left = at ? Math.max(14, Math.min(screenW - WIDTH - 14, at.left + at.width - WIDTH)) : 0;
  const top = at ? (at.bottom + 8 + height + 20 < screenH ? at.bottom + 8 : Math.max(20, at.top - 8 - height)) : 0;

  return (
    <>
      <View ref={ref} collapsable={false}>
        {trigger ? (
          trigger(open)
        ) : (
          <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${label}. Escolher o mês`} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <GlassShape radius={22} style={{ height: 44 }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 16, paddingRight: 12 }}>
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>
                  {label}
                </Text>
                <ChevronDown size={17} color={th("rgba(255,255,255,0.75)")} strokeWidth={2.4} />
              </View>
            </GlassShape>
          </Pressable>
        )}
      </View>

      <Modal visible={!!at} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: th("rgba(0,0,0,0.25)", "bg") }} onPress={close} accessibilityLabel="Fechar" />
        {at && (
          <Animated.View
            entering={FadeIn.duration(140)}
            style={{ position: "absolute", left, top, width: WIDTH, height, borderRadius: 22, borderCurve: "continuous", borderWidth: 1, borderColor: th("rgba(255,255,255,0.16)", "line"), overflow: "hidden" }}
          >
            <BlurView intensity={70} tint={th("dark", "tint")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: th("rgba(18,20,26,0.55)", "bg") }} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 4 }}
              contentOffset={{ x: 0, y: Math.max(0, (chosen - 2) * ROW) }}
            >
              {list.map((d) => {
                const on = d.getMonth() === month && d.getFullYear() === year;
                const today = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                return (
                  <Pressable
                    key={`${d.getFullYear()}-${d.getMonth()}`}
                    onPress={() => {
                      void Haptics.selectionAsync().catch(() => undefined);
                      onChange(d.getMonth(), d.getFullYear());
                      close();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${MONTHS[d.getMonth()]} de ${d.getFullYear()}`}
                    style={({ pressed }) => ({
                      height: ROW,
                      marginHorizontal: 4,
                      paddingHorizontal: 14,
                      borderRadius: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: th(on ? "rgba(255,255,255,0.14)" : pressed ? "rgba(255,255,255,0.07)" : "transparent", "bg"),
                    })}
                  >
                    <Text style={{ fontSize: 16, fontWeight: on ? "700" : "500", color: th("#fff") }}>{MONTHS[d.getMonth()]}</Text>
                    {d.getFullYear() !== now.getFullYear() ? <Text style={{ fontSize: 14, color: th(INK.soft) }}>{d.getFullYear()}</Text> : null}
                    {today ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: th(GREEN, "bg") }} /> : null}
                    {on ? (
                      <View style={{ marginLeft: "auto" }}>
                        <Check size={16} color={th("#fff")} strokeWidth={2.6} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}
      </Modal>
    </>
  );
}
