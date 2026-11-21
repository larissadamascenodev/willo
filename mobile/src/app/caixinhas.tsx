import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { fetchGoals, type Goal } from "@/services/goalService";
import { setHiddenValues, useHiddenValues } from "@/hooks/useHiddenValues";
import { ensureReserve } from "~/lib/ensureReserve";
import { catchUpYields, earns, estimate, latestCdi, yieldEarned } from "~/lib/yields";
import CaixinhaSheet from "~/components/accounts/CaixinhaSheet";
import CaixinhaTile, { NewCaixinhaTile, TILE_H, TILE_W } from "~/components/accounts/CaixinhaTile";
import Room from "~/components/Room";
import RaisedButton from "~/components/RaisedButton";
import { ChevronLeft, Eye, EyeOff, PiggyBank, Plus } from "~/components/icons";
import { showToast } from "~/lib/toast";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK } from "~/theme/tokens";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * Caixinhas: money set aside for something, still the person's — on a page of its own.
 *
 * Drawn as every detail page is, in the app's quiet colours. What is kept in all of them,
 * large, with the eye beside its name; what they have earned (in green) and what they should
 * earn in a month. Then every caixinha as its picture, two to a row, and one more to start a new
 * one. A touch opens a caixinha's own page.
 *
 * The reserve is made the first time, and any days of yield missed while the app was closed
 * are credited before the figures are shown.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;

export default function Caixinhas() {
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const hidden = useHiddenValues();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [earned, setEarned] = useState(0);
  const [cdi, setCdi] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const show = (v: number) => (hidden ? "R$ •••" : money(v));

  const load = useCallback(async () => {
    if (!user) {
      setGoals([]);
      return;
    }
    try {
      let list = await fetchGoals();
      const made = await ensureReserve(user.id, list);
      const credited = await catchUpYields(list);
      if (made || credited) list = await fetchGoals();
      setGoals(list);
      if (list.some(earns)) {
        const [sum, rate] = await Promise.all([yieldEarned(user.id), latestCdi()]);
        setEarned(sum);
        setCdi(rate?.rate ?? null);
      } else {
        setEarned(0);
      }
      if (made || credited) window.dispatchEvent(new CustomEvent("finance-data-changed"));
    } catch {
      setGoals((had) => had ?? []);
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
  const rendem = list.some(earns);
  const noMes = cdi === null ? 0 : list.filter(earns).reduce((s, g) => s + estimate(Number(g.current_amount) || 0, cdi, Number(g.yield_percent)).month, 0);

  /* Two to a row, each the picture's own shape. */
  const tileW = Math.floor((width - 32 - 12) / 2) - 1;
  const tileH = Math.round(tileW * (TILE_H / TILE_W));

  return (
    <Room lit sky>
      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 74, paddingBottom: insets.bottom + 60, paddingHorizontal: 16 }}>
        {/* What is kept in all of them. */}
        <View style={{ paddingHorizontal: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <Text style={{ fontSize: 17, color: th(INK.soft) }}>Total em caixinhas</Text>
            <Pressable onPress={() => setHiddenValues(!hidden)} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? "Mostrar valores" : "Esconder valores"} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              {hidden ? <EyeOff size={19} color={th(INK.soft)} strokeWidth={2} /> : <Eye size={19} color={th(INK.soft)} strokeWidth={2} />}
            </Pressable>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 4, fontSize: 44, fontWeight: "700", letterSpacing: -1.6, color: th("#fff"), opacity: goals ? 1 : 0.4 }]}>
            {show(guardado)}
          </Text>
          {rendem && (
            <View style={{ marginTop: 10, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: th(GREEN, "bg") }} />
                <Text style={[nums, { fontSize: 15.5, color: th(INK.soft) }]}>
                  Rendimentos <Text style={{ fontWeight: "700", color: th(GREEN) }}>{hidden ? "R$ •••" : `+${money(earned)}`}</Text>
                </Text>
              </View>
              {noMes > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: th("rgba(255,255,255,0.5)", "bg") }} />
                  <Text style={[nums, { fontSize: 15.5, color: th(INK.soft) }]}>
                    Estimado em um mês <Text style={{ fontWeight: "700", color: th("#fff") }}>{show(noMes)}</Text>
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Every caixinha, two to a row, and one more to start a new one. */}
        {goals && list.length === 0 ? (
          <Pressable
            onPress={() => setAdding(true)}
            style={({ pressed }) => ({
              marginTop: 24,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: th("rgba(255,255,255,0.08)", "line"),
              backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
              padding: 16,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
              <PiggyBank size={21} color={th("#fff")} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: th("#fff") }}>Crie sua primeira caixinha</Text>
              <Text style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>Para a viagem, a reserva, o carro. O dinheiro sai da conta, mas continua seu.</Text>
            </View>
          </Pressable>
        ) : (
          <View style={{ marginTop: 24, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {list.map((g, i) => (
              <Animated.View key={g.id} entering={FadeInDown.delay(40 + i * 60).duration(380)}>
                <CaixinhaTile goal={g} width={tileW} height={tileH} delay={0.05 * i} onPress={() => router.push(`/metas/${g.id}` as never)} />
              </Animated.View>
            ))}
            {goals && (
              <Animated.View entering={FadeInDown.delay(40 + list.length * 60).duration(380)}>
                <NewCaixinhaTile width={tileW} height={tileH} onPress={() => setAdding(true)} />
              </Animated.View>
            )}
          </View>
        )}
      </Animated.ScrollView>

      {/* The top row: back, the page's name, and a new caixinha. */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <RaisedButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))} size={50}>
          <ChevronLeft size={24} color={th("#fff")} strokeWidth={2.4} />
        </RaisedButton>
        <Text numberOfLines={1} style={{ flex: 1, marginHorizontal: 10, textAlign: "center", fontSize: 19, fontWeight: "700", letterSpacing: -0.3, color: th("#fff") }}>
          Caixinhas
        </Text>
        <RaisedButton label="Criar caixinha" onPress={() => setAdding(true)} size={50}>
          <Plus size={22} color={th("#fff")} strokeWidth={2.4} />
        </RaisedButton>
      </View>

      <CaixinhaSheet
        open={adding}
        onClose={() => setAdding(false)}
        existingNames={list.map((g) => g.name)}
        onCreated={() => {
          setAdding(false);
          void load();
          window.dispatchEvent(new CustomEvent("finance-data-changed"));
          showToast("Caixinha criada");
        }}
      />
    </Room>
  );
}
