import { Pressable, Switch, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import BottomSheet from "~/components/BottomSheet";
import SegmentedTabs from "~/components/SegmentedTabs";
import AgentMark from "~/components/willo/AgentMark";
import { Bell, Check } from "~/components/icons";
import { AGENTS, STYLES } from "~/lib/agents";
import { setWilloPrefs, useWilloPrefs } from "~/lib/willoPrefs";
import { GREEN, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Making Willo yours: how he talks, how much he says, and which of his specialists
 * are at work. Each voice is shown saying the same thing, so the choice is heard
 * rather than described. The voice changes the words — never the numbers.
 */
export default function WilloSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = useWilloPrefs();

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>Personalizar o Willo</Text>
        <Text style={{ marginTop: 4, fontSize: 13.5, lineHeight: 19, color: INK.soft }}>
          O jeito de falar muda. Os números e a seriedade dos alertas, nunca.
        </Text>

        {/* ── Voice ── */}
        <Text style={[T.eyebrow, { marginTop: 24 }]}>Personalidade</Text>
        <View style={{ marginTop: 10, gap: 8 }}>
          {STYLES.map((s) => {
            const on = prefs.style === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setWilloPrefs({ style: s.id })}
                style={({ pressed }) => ({
                  padding: 14,
                  borderRadius: 20,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: on ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.08)",
                  backgroundColor: on ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{s.label}</Text>
                  {on && (
                    <Animated.View entering={FadeIn.duration(200)} style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
                      <Check size={13} color="#0B0B0B" strokeWidth={3.4} />
                    </Animated.View>
                  )}
                </View>
                <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 18, fontStyle: "italic", color: on ? "rgba(255,255,255,0.86)" : INK.soft }}>“{s.sample}”</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Length ── */}
        <Text style={[T.eyebrow, { marginTop: 24 }]}>Respostas</Text>
        <View style={{ marginTop: 10 }}>
          <SegmentedTabs
            value={prefs.length}
            onChange={(v) => setWilloPrefs({ length: v })}
            options={[
              { key: "curtas" as const, label: "Curtas e diretas" },
              { key: "detalhadas" as const, label: "Detalhadas" },
            ]}
          />
        </View>

        {/* ── Specialists ── */}
        <Text style={[T.eyebrow, { marginTop: 24 }]}>Especialistas</Text>
        <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 18, color: INK.soft }}>
          Você conversa só com o Willo. Ele chama quem entende de cada assunto.
        </Text>
        <View style={{ marginTop: 10 }}>
          {AGENTS.map((a, i) => (
            <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
              <AgentMark hex={a.hex} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                  {a.name} <Text style={{ fontSize: 12.5, fontWeight: "500", color: INK.softer }}>· {a.role}</Text>
                </Text>
                <Text style={{ marginTop: 2, fontSize: 12.5, lineHeight: 17, color: INK.soft }}>{a.about}</Text>
              </View>
              {a.optional ? (
                <Switch
                  value={prefs.agents[a.id]}
                  onValueChange={(v) => setWilloPrefs({ agents: { ...prefs.agents, [a.id]: v } })}
                  trackColor={{ true: GREEN, false: "rgba(255,255,255,0.15)" }}
                  thumbColor="#fff"
                />
              ) : (
                <Text style={{ fontSize: 11.5, color: INK.softer }}>sempre ativo</Text>
              )}
            </View>
          ))}
        </View>

        {/* ── Notices ── */}
        <Text style={[T.eyebrow, { marginTop: 24 }]}>Avisos</Text>
        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.04)" }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
            <Bell size={17} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#fff" }}>Avisos do Willo no iPhone</Text>
            <Text style={{ marginTop: 2, fontSize: 12.5, lineHeight: 17, color: INK.soft }}>
              Fatura alta, saldo que não vai dar, limite perto do fim. Chega com a próxima versão do app.
            </Text>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
