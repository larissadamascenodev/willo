import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { fetchGoals, type Goal } from "@/services/goalService";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import RoundButton from "~/components/RoundButton";
import Bar from "~/components/Bar";
import CofrinhoSheet from "~/components/accounts/CofrinhoSheet";
import CofrinhoTile, { NewCofrinhoTile } from "~/components/accounts/CofrinhoTile";
import { paceOf } from "~/lib/cofrinho";
import { Plus, Target } from "~/components/icons";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { useAuth } from "~/lib/auth";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What you are saving for.
 *
 * The total leads — everything put aside against everything promised — because a
 * page of separate goals makes it hard to see that you are, in fact, saving. Then
 * each goal as the picture card it is on the accounts screen, two to a row: the same
 * thing looks the same wherever it is. What can be done to one — put money in, take it
 * out, change it, delete it — is on its own page.
 */

const GAP = 12;
const SIDE = 16;

export default function Metas() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setGoals([]);
      return;
    }
    try {
      setGoals(await fetchGoals());
    } catch {
      setGoals([]);
    }
  }, [user]);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [load]);

  const list = goals ?? [];
  const guardado = list.reduce((s, g) => s + (Number(g.current_amount) || 0), 0);
  const objetivo = list.reduce((s, g) => s + (Number(g.target_amount) || 0), 0);
  const overall = objetivo > 0 ? Math.min(guardado / objetivo, 1) : 0;
  const porMes = list.reduce((s, g) => {
    const pace = paceOf(g);
    return s + (pace.open || pace.late ? 0 : pace.monthly);
  }, 0);

  const tileW = Math.floor((width - SIDE * 2 - GAP) / 2);
  const tileH = Math.round(tileW * 1.32);

  return (
    <Room lit sky>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: SIDE,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BackButton to="/" />
          <RoundButton label="Novo cofrinho" onPress={() => setCreating(true)}>
            <Plus size={18} color="rgba(255,255,255,0.9)" strokeWidth={2.4} />
          </RoundButton>
        </View>

        {goals === null ? (
          <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
            {[0, 1].map((i) => (
              <View key={i} style={{ width: tileW, height: tileH, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.04)" }} />
            ))}
          </View>
        ) : list.length === 0 ? (
          <>
            <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Metas</Text>
            <View style={{ marginTop: 44, alignItems: "center", paddingHorizontal: 32 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: INK.edge,
                  backgroundColor: "rgba(255,255,255,0.05)",
                }}
              >
                <Target size={32} color={INK.soft} strokeWidth={1.8} />
              </View>
              <Text style={{ marginTop: 20, fontSize: 18, fontWeight: "700", color: "#fff" }}>Nenhuma meta ainda</Text>
              <Text style={{ marginTop: 4, textAlign: "center", fontSize: 14, lineHeight: 19, color: INK.soft }}>
                Crie seu primeiro cofrinho e acompanhe quanto falta para chegar lá.
              </Text>
              <Pressable
                onPress={() => setCreating(true)}
                style={({ pressed }) => ({
                  marginTop: 20,
                  height: 48,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#fff",
                  paddingHorizontal: 24,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#0B0B0B" }}>Criar cofrinho</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {/* ══ Everything put aside, against everything promised ══ */}
            <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 4, paddingTop: 10 }}>
              <Text style={{ fontSize: 13.5, color: "rgba(255,255,255,0.62)" }}>Total guardado</Text>
              <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 40, fontWeight: "800", letterSpacing: -1.6, color: "#fff" }}>
                {money(guardado)}
              </Text>
              <View style={{ marginTop: 14, flexDirection: "row", gap: 26 }}>
                <View style={{ flexShrink: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: INK.softer }}>Meta total</Text>
                  <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 16, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }}>
                    {money(objetivo)}
                  </Text>
                </View>
                <View style={{ flexShrink: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: INK.softer }}>Conquistado</Text>
                  <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 16, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }}>
                    {Math.round(overall * 100)}%
                  </Text>
                </View>
                {porMes > 0 && (
                  <View style={{ flexShrink: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: INK.softer }}>Guardar por mês</Text>
                    <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 16, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }}>
                      {money(porMes)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ marginTop: 16, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.09)" }}>
                <Bar share={overall} color="#fff" delay={0.1} />
              </View>
            </Animated.View>

            <Text style={[T.eyebrow, { marginTop: 28, marginBottom: 12, paddingHorizontal: 4 }]}>Suas metas</Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
              {list.map((goal, i) => (
                <Animated.View key={goal.id} entering={FadeInDown.delay(60 + i * 50).duration(400)}>
                  <CofrinhoTile
                    goal={goal}
                    delay={0.05 * i}
                    width={tileW}
                    height={tileH}
                    onPress={() => router.push(`/metas/${goal.id}` as never)}
                  />
                </Animated.View>
              ))}
              <Animated.View entering={FadeInDown.delay(60 + list.length * 50).duration(400)}>
                <NewCofrinhoTile width={tileW} height={tileH} onPress={() => setCreating(true)} />
              </Animated.View>
            </View>
          </>
        )}
      </ScrollView>

      <CofrinhoSheet
        open={creating}
        onClose={() => setCreating(false)}
        existingNames={list.map((g) => g.name)}
        onCreated={() => {
          setCreating(false);
          void load();
          window.dispatchEvent(new CustomEvent("finance-data-changed"));
          showToast("Cofrinho criado");
        }}
      />
    </Room>
  );
}
