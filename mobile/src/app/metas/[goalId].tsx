import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeInDown, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import {
  computeGoalInsights,
  createGoalDeposit,
  createGoalWithdraw,
  deleteGoal,
  deleteGoalDepositWithRefund,
  fetchGoalById,
  fetchGoalTransactions,
  updateGoal,
  type Goal,
  type GoalTransaction,
} from "@/services/goalService";
import { getAccounts } from "@/services/transactionService";
import { goalProgress } from "@/lib/goalPresets";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface, { Hairline } from "~/components/Surface";
import BottomSheet from "~/components/BottomSheet";
import AnchoredMenu, { MenuHeader, MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import GoalFormSheet from "~/components/metas/GoalFormSheet";
import GoalMoveSheet from "~/components/metas/GoalMoveSheet";
import { goalPreset } from "~/lib/goalIcon";
import {
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Pencil,
  Sparkles,
  Trash2,
} from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * One goal, up close.
 *
 * The ring is the whole screen in one shape: how much of the promise is kept. Then
 * the three numbers a goal is actually judged by — what went in, what came back
 * out, and when it arrives at this rate — and under them every movement, because a
 * goal that cannot be audited is a goal nobody trusts.
 */

const RING_SIZE = 96;
const RING_R = 38;
const RING_C = 2 * Math.PI * RING_R;
const PREVIEW = 5;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ProgressRing({ progress, color }: { progress: number; color: string }) {
  const drawn = useSharedValue(0);

  useEffect(() => {
    drawn.value = withDelay(
      150,
      withTiming(progress, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, drawn]);

  const animated = useAnimatedProps(() => ({
    strokeDasharray: [drawn.value * RING_C, RING_C],
  }));

  return (
    <Svg
      width={RING_SIZE}
      height={RING_SIZE}
      style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
    >
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_R}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={10}
      />
      <AnimatedCircle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_R}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        animatedProps={animated}
      />
    </Svg>
  );
}

export default function MetaDetalhe() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [movements, setMovements] = useState<GoalTransaction[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const dots = useRef<ComponentRef<typeof View>>(null);
  const [menu, setMenu] = useState<AnchorRect | null>(null);
  const [moving, setMoving] = useState<"deposito" | "saque" | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<"meta" | GoalTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!goalId || !user) {
      setLoading(false);
      return;
    }
    try {
      const [g, txs] = await Promise.all([fetchGoalById(goalId), fetchGoalTransactions(goalId)]);
      setGoal(g);
      setMovements(txs);

      const ids = [...new Set(txs.filter((t) => t.account_id).map((t) => t.account_id!))];
      if (ids.length > 0) {
        const accounts = (await getAccounts()) as unknown as { id: string; name: string }[];
        const names: Record<string, string> = {};
        accounts.forEach((a) => {
          if (ids.includes(a.id)) names[a.id] = a.name;
        });
        setAccountNames(names);
      }
    } catch {
      router.replace("/metas");
    } finally {
      setLoading(false);
    }
  }, [goalId, user, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const announce = () => window.dispatchEvent(new CustomEvent("finance-data-changed"));

  const move = async (data: {
    amount: number;
    date: string;
    account_id?: string;
    source?: string;
    destination?: string;
  }) => {
    if (!user || !goalId) return;
    if (moving === "saque") {
      await createGoalWithdraw(
        { goal_id: goalId, amount: data.amount, date: data.date, account_id: data.account_id, destination: data.destination },
        user.id,
      );
    } else {
      await createGoalDeposit(
        { goal_id: goalId, amount: data.amount, date: data.date, account_id: data.account_id, source: data.source },
        user.id,
      );
    }
    setMoving(null);
    await load();
    announce();
  };

  const save = async (data: {
    name: string;
    target_amount: number;
    monthly_contribution: number | null;
  }) => {
    if (!goalId) return;
    await updateGoal(goalId, data);
    setEditing(false);
    await load();
    announce();
  };

  const removeGoal = async () => {
    if (!goalId) return;
    try {
      await deleteGoal(goalId);
      announce();
      router.replace("/metas");
    } catch {
      setError("Não foi possível excluir a meta.");
      setConfirming(null);
    }
  };

  const removeDeposit = async (tx: GoalTransaction) => {
    if (!user || !goal) return;
    try {
      await deleteGoalDepositWithRefund(tx, user.id, goal.name);
      setConfirming(null);
      await load();
      announce();
    } catch {
      setError("Não foi possível remover o depósito.");
      setConfirming(null);
    }
  };

  /* Where a deposit came from decides where removing it sends the money back to,
     and that is worth saying out loud before it happens. */
  const undoDescription = (tx: GoalTransaction) => {
    const value = money(Math.abs(Number(tx.amount)));
    if (tx.account_id && accountNames[tx.account_id]) {
      return `O valor de ${value} volta para a conta “${accountNames[tx.account_id]}”.`;
    }
    if (tx.source) {
      return `Este depósito de ${value} veio de “${tx.source}”, fora do Willo. O valor sai da meta.`;
    }
    return `O depósito de ${value} sai da meta.`;
  };

  const openMenu = () => {
    dots.current?.measureInWindow((x, y, w, h) => {
      setMenu({ top: y, bottom: y + h, left: x, width: w });
    });
  };

  if (loading || !goal) {
    return (
      <Room lit>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
          <View style={{ height: 44, justifyContent: "center" }}>
            <BackButton to="/metas" />
          </View>
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={{ height: 160, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
            <View style={{ height: 80, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.04)" }} />
          </View>
        </ScrollView>
      </Room>
    );
  }

  const { progress, percent, remaining, isComplete } = goalProgress(goal);
  const preset = goalPreset(goal);
  const Icon = preset.icon;
  const insights = computeGoalInsights(goal, movements);
  const topInsight = insights[0] ?? null;

  const deposits = movements.filter((t) => Number(t.amount) > 0);
  const withdrawals = movements.filter((t) => Number(t.amount) < 0);
  const totalIn = deposits.reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = withdrawals.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  const monthsLeft =
    !isComplete && goal.monthly_contribution && goal.monthly_contribution > 0
      ? Math.ceil(remaining / goal.monthly_contribution)
      : 0;

  const shown = showAll ? movements : movements.slice(0, PREVIEW);

  return (
    <Room lit>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BackButton to="/metas" />
          <Pressable
            ref={dots}
            accessibilityLabel="Opções da meta"
            onPress={openMenu}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <MoreVertical size={20} color={INK.full} />
          </Pressable>
        </View>

        {/* ══ The promise, as one shape ══ */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Surface radius={26} style={{ marginTop: 10, padding: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
              <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" }}>
                <ProgressRing progress={progress} color={isComplete ? GREEN : preset.hex} />
                <Icon size={26} color={preset.hex} strokeWidth={2} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={2} style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
                  {goal.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ marginTop: 4, fontSize: 26, fontWeight: "800", letterSpacing: -0.9, color: isComplete ? GREEN : "#fff" }}
                >
                  {money(goal.current_amount)}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>
                  de {money(goal.target_amount)} · {percent}%
                </Text>
                {!isComplete && remaining > 0 && (
                  <Text style={{ marginTop: 1, fontSize: 12.5, color: INK.softer }}>
                    faltam {money(remaining)}
                  </Text>
                )}
              </View>
            </View>

            <View style={{ marginTop: 16, flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setMoving("deposito")}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 46,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 23,
                  backgroundColor: "#fff",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#0B0B0B" }}>Guardar</Text>
              </Pressable>
              <Pressable
                onPress={() => setMoving("saque")}
                disabled={goal.current_amount <= 0}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 46,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 23,
                  borderWidth: 1,
                  borderColor: "rgba(248,113,113,0.28)",
                  backgroundColor: "rgba(248,113,113,0.12)",
                  opacity: goal.current_amount <= 0 ? 0.4 : pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontSize: 14.5, fontWeight: "700", color: RED }}>Sacar</Text>
              </Pressable>
            </View>
          </Surface>
        </Animated.View>

        {/* ══ The three numbers a goal is judged by ══ */}
        <Animated.View entering={FadeInDown.delay(60).duration(420)} style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
          <Stat label="Depósitos" value={money(totalIn)} tone={GREEN} />
          <Stat label="Saques" value={money(totalOut)} tone={RED} />
          <Stat
            label={monthsLeft > 0 ? "Previsão" : "Por mês"}
            value={
              monthsLeft > 0
                ? `${monthsLeft} ${monthsLeft === 1 ? "mês" : "meses"}`
                : goal.monthly_contribution
                  ? money(goal.monthly_contribution)
                  : "—"
            }
            tone="#fff"
          />
        </Animated.View>

        {topInsight && (
          <Animated.View entering={FadeInDown.delay(110).duration(420)}>
            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "rgba(200,243,109,0.14)",
                backgroundColor: "rgba(200,243,109,0.05)",
                padding: 14,
              }}
            >
              <Sparkles size={15} color={GREEN} />
              <Text style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 18, color: INK.soft }}>
                {topInsight}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ══ Every movement ══ */}
        <Animated.View entering={FadeInDown.delay(150).duration(420)}>
          <Text style={[T.eyebrow, { marginTop: 24, paddingHorizontal: 4 }]}>Movimentações</Text>
          {movements.length === 0 ? (
            <Surface radius={22} style={{ marginTop: 10, paddingVertical: 28, alignItems: "center" }}>
              <Text style={{ fontSize: 14, color: INK.softer }}>Nenhuma movimentação ainda</Text>
            </Surface>
          ) : (
            <Surface radius={22} style={{ marginTop: 10, paddingHorizontal: 14 }}>
              {shown.map((tx, i) => {
                const value = Number(tx.amount);
                const isWithdraw = value < 0;
                const tone = isWithdraw ? RED : GREEN;
                const under = [
                  new Date(`${tx.date.slice(0, 10)}T12:00:00`)
                    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                    .replace(".", ""),
                  tx.source || null,
                  tx.account_id ? accountNames[tx.account_id] || null : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <View key={tx.id}>
                    {i > 0 && <Hairline />}
                    <Pressable
                      disabled={isWithdraw}
                      onLongPress={() => setConfirming(tx)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingVertical: 12,
                        opacity: pressed && !isWithdraw ? 0.7 : 1,
                      })}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isWithdraw ? "rgba(248,113,113,0.12)" : "rgba(200,243,109,0.12)",
                        }}
                      >
                        {isWithdraw ? (
                          <ChevronUp size={15} color={RED} strokeWidth={2.6} />
                        ) : (
                          <ChevronDown size={15} color={GREEN} strokeWidth={2.6} />
                        )}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13.5, fontWeight: "700", color: tone }}>
                          {isWithdraw ? "Saque" : "Depósito"}
                        </Text>
                        <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 11.5, color: INK.softer }}>
                          {under}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: tone }}>
                        {isWithdraw ? "−" : "+"}
                        {money(Math.abs(value))}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}

              {movements.length > PREVIEW && (
                <Pressable
                  onPress={() => setShowAll((v) => !v)}
                  style={({ pressed }) => ({
                    height: 42,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255,255,255,0.06)",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  {showAll ? <ChevronUp size={14} color={INK.soft} /> : <ChevronDown size={14} color={INK.soft} />}
                  <Text style={{ fontSize: 12.5, fontWeight: "600", color: INK.soft }}>
                    {showAll ? "Mostrar menos" : `Ver todas (${movements.length})`}
                  </Text>
                </Pressable>
              )}
            </Surface>
          )}
          {deposits.length > 0 && (
            <Text style={{ marginTop: 8, paddingHorizontal: 4, fontSize: 11.5, color: INK.softer }}>
              Segure um depósito para desfazê-lo.
            </Text>
          )}
        </Animated.View>

        {error && <Text style={{ marginTop: 14, paddingHorizontal: 4, fontSize: 13, color: RED }}>{error}</Text>}
      </ScrollView>

      <AnchoredMenu open={!!menu} anchor={menu} onClose={() => setMenu(null)}>
        <MenuHeader title={goal.name} subtitle={`${percent}% de ${money(goal.target_amount)}`} />
        <MenuRow
          icon={Pencil}
          label="Editar meta"
          onPress={() => {
            setMenu(null);
            setEditing(true);
          }}
        />
        <MenuRow
          icon={Trash2}
          label="Excluir meta"
          danger
          last
          onPress={() => {
            setMenu(null);
            setConfirming("meta");
          }}
        />
      </AnchoredMenu>

      <BottomSheet open={!!confirming} onClose={() => setConfirming(null)}>
        {confirming && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>
              {confirming === "meta" ? "Excluir meta" : "Remover depósito"}
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: INK.soft }}>
              {confirming === "meta"
                ? `Tem certeza que deseja excluir “${goal.name}”? Esta ação não pode ser desfeita.`
                : undoDescription(confirming)}
            </Text>
            <Pressable
              onPress={() => (confirming === "meta" ? void removeGoal() : void removeDeposit(confirming))}
              style={({ pressed }) => ({
                marginTop: 22,
                height: 52,
                borderRadius: 26,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(248,113,113,0.16)",
                borderWidth: 1,
                borderColor: "rgba(248,113,113,0.30)",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: RED }}>
                {confirming === "meta" ? "Excluir" : "Remover"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirming(null)}
              style={({ pressed }) => ({
                marginTop: 10,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: INK.soft }}>Cancelar</Text>
            </Pressable>
          </View>
        )}
      </BottomSheet>

      <GoalMoveSheet
        open={!!moving}
        onClose={() => setMoving(null)}
        onSubmit={move}
        goalName={goal.name}
        mode={moving ?? "deposito"}
        maxAmount={goal.current_amount}
      />

      <GoalFormSheet
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={save}
        title="Editar meta"
        initial={{
          name: goal.name,
          target_amount: goal.target_amount,
          monthly_contribution: goal.monthly_contribution ?? null,
        }}
      />
    </Room>
  );
}

/** One of the three figures under the ring. */
function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Surface radius={18} style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 10, alignItems: "center" }}>
      <Text style={{ fontSize: 9.5, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", color: INK.softer }}>
        {label}
      </Text>
      <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 12.5, fontWeight: "700", color: tone }}>
        {value}
      </Text>
    </Surface>
  );
}
