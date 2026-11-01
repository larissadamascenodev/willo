import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import BottomSheet from "~/components/BottomSheet";
import SegmentedTabs from "~/components/SegmentedTabs";
import { Bell, Check } from "~/components/icons";
import { STYLES } from "~/lib/agents";
import { face } from "~/lib/chatFont";
import { setWilloPrefs, useWilloPrefs } from "~/lib/willoPrefs";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Making Willo yours: how he talks and how much he says. The voice chosen is heard, in
 * the words under its name; the others stay one line each, so it all fits on the screen.
 * The voice changes the words, never the numbers.
 */
export default function WilloSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = useWilloPrefs();

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22, letterSpacing: -0.5, ...face(800), color: "#fff" }}>Personalizar o Willo</Text>

        {/* ── Voice ── */}
        <Text style={[T.eyebrow, { marginTop: 20 }]}>Personalidade</Text>
        <View style={{ marginTop: 8, borderRadius: 20, borderCurve: "continuous", paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.05)" }}>
          {STYLES.map((s, i) => {
            const on = prefs.style === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setWilloPrefs({ style: s.id })}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => ({
                  paddingVertical: 13,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: "rgba(255,255,255,0.06)",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 22 }}>
                  <Text style={{ fontSize: 15.5, ...face(on ? 700 : 500), color: on ? "#fff" : "rgba(255,255,255,0.78)" }}>{s.label}</Text>
                  {on && (
                    <Animated.View entering={FadeIn.duration(200)} style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
                      <Check size={13} color="#0B0B0B" strokeWidth={3.4} />
                    </Animated.View>
                  )}
                </View>
                {on && <Text style={{ marginTop: 5, fontSize: 13, lineHeight: 18, ...face(500), color: INK.soft }}>“{s.sample}”</Text>}
              </Pressable>
            );
          })}
        </View>

        {/* ── Length ── */}
        <Text style={[T.eyebrow, { marginTop: 20 }]}>Respostas</Text>
        <View style={{ marginTop: 8 }}>
          <SegmentedTabs
            value={prefs.length}
            onChange={(v) => setWilloPrefs({ length: v })}
            options={[
              { key: "curtas" as const, label: "Curtas e diretas" },
              { key: "detalhadas" as const, label: "Detalhadas" },
            ]}
          />
        </View>

        {/* ── Notices ── */}
        <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Bell size={16} color={INK.softer} />
          <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 17, ...face(500), color: INK.softer }}>Avisos do Willo no iPhone chegam com a próxima versão do app.</Text>
        </View>
      </View>
    </BottomSheet>
  );
}
