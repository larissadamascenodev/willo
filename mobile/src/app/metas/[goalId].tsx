import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { showToast } from "~/lib/toast";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeInDown, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  createGoalDeposit,
  createGoalWithdraw,
  deleteGoal,
  deleteGoalDepositWithRefund,
  fetchGoalById,
  fetchGoalTransactions,
  updateGoal,
  YIELD_SOURCE,
  type Goal,
  type GoalTransaction,
} from "@/services/goalService";
import { getAccounts } from "@/services/transactionService";
import { goalProgress } from "@/lib/goalPresets";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import { BlurView } from "expo-blur";
import ConfirmGlass from "~/components/ConfirmGlass";
import AnchoredMenu, { MenuHeader, MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import GoalFormSheet from "~/components/metas/GoalFormSheet";
import GoalMoveSheet from "~/components/metas/GoalMoveSheet";
import { goalPreset } from "~/lib/goalIcon";
import { pickGoalCover } from "~/lib/goalCover";
import CaixinhaCover from "~/components/accounts/CaixinhaCover";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "~/components/icons";
import { money } from "~/lib/money";
import { monthYear, paceOf } from "~/lib/caixinha";
import { catchUpYields, earns, estimate, latestCdi, yieldEarned } from "~/lib/yields";
import { useAuth } from "~/lib/auth";
import { GREEN, GROUND_LIT, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * One caixinha, up close.
 *
 * It opens on its picture — the one the person chose, or the cover made from the goal
 * itself — and what is held sits right under it, large, with how far that is along. Then
 * the readings a goal is judged by, plain on the page: what is left, what to put in each
 * month, and when it arrives at that pace. One that earns says what it is expected to earn
 * a day, a month and a year. Under them every movement, laid out the way transactions are:
 * what came in green, what went out in red. A caixinha with no amount to reach, like the
 * reserve, has no "how far" and no date; it is just what has been put by.
 */

const PREVIEW = 5;

/** A piece of glass on the page: the readings sit in these rather than loose on the ground. */
const PANEL = {
  borderRadius: 28,
  borderCurve: "continuous",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  backgroundColor: "rgba(255,255,255,0.062)",
  paddingHorizontal: 18,
  paddingVertical: 18,
} as const;

/** The fill of the bar, drawn in once. */
function Progress({ progress, color }: { progress: number; color: string }) {
  const drawn = useSharedValue(0);
  useEffect(() => {
    drawn.set(withDelay(200, withTiming(progress, { duration: 1000, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [progress, drawn]);
  const fill = useAnimatedStyle(() => ({ width: `${drawn.get() * 100}%` }));
  return (
    <View style={{ height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.10)" }}>
      <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: color }, fill]} />
    </View>
  );
}

export default function MetaDetalhe() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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
  const [coverBusy, setCoverBusy] = useState(false);
  /* The day's CDI the estimates are read from, and what has already been credited. */
  const [cdi, setCdi] = useState<number | null>(null);
  const [earned, setEarned] = useState(0);

  const load = useCallback(async () => {
    if (!goalId || !user) {
      setLoading(false);
      return;
    }
    try {
      let [g, txs] = await Promise.all([fetchGoalById(goalId), fetchGoalTransactions(goalId)]);
      /* Days of yield missed while the app was closed are credited before it is shown. */
      if (earns(g) && (await catchUpYields([g]))) {
        [g, txs] = await Promise.all([fetchGoalById(goalId), fetchGoalTransactions(goalId)]);
        window.dispatchEvent(new CustomEvent("finance-data-changed"));
      }
      setGoal(g);
      setMovements(txs);
      if (earns(g)) {
        const [rate, sum] = await Promise.all([latestCdi(), yieldEarned(user.id, goalId)]);
        setCdi(rate?.rate ?? null);
        setEarned(sum);
      } else {
        setCdi(null);
        setEarned(0);
      }

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
      router.replace("/gestao" as never);
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
    showToast(moving === "saque" ? "Retirada registrada" : "Valor guardado");
  };

  const save = async (data: {
    name: string;
    target_amount: number;
    monthly_contribution: number | null;
    deadline: string | null;
    yield_type: "cdi" | null;
    yield_percent: number | null;
  }) => {
    if (!goalId) return;
    /* The yield is only written when it changed, so saving a name or an amount never
       depends on it. */
    const { yield_type, yield_percent, ...rest } = data;
    const yieldChanged = (goal?.yield_type ?? null) !== yield_type || Number(goal?.yield_percent ?? 0) !== Number(yield_percent ?? 0);
    await updateGoal(goalId, yieldChanged ? data : rest);
    setEditing(false);
    await load();
    announce();
    showToast("Caixinha atualizada");
  };

  /* The picture: chosen from the library, or taken away to return to the made one. */
  const changeCover = async () => {
    if (!goalId || !user || coverBusy) return;
    setCoverBusy(true);
    setError(null);
    try {
      const uri = await pickGoalCover(user.id);
      if (!uri) return;
      await updateGoal(goalId, { cover_image: uri });
      await load();
      announce();
      showToast("Imagem atualizada");
    } catch (e) {
      /* Said where it is seen: the page's foot is far from the button that was pressed. */
      showToast(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setCoverBusy(false);
    }
  };

  const clearCover = async () => {
    if (!goalId) return;
    try {
      await updateGoal(goalId, { cover_image: null });
      await load();
      announce();
      showToast("Imagem removida");
    } catch {
      setError("Não foi possível remover a imagem.");
    }
  };

  const removeGoal = async () => {
    if (!goalId) return;
    try {
      await deleteGoal(goalId);
      announce();
      showToast("Caixinha excluída");
      router.replace("/gestao" as never);
    } catch {
      setError("Não foi possível excluir a caixinha.");
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
      showToast("Depósito desfeito");
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
      return `Este depósito de ${value} veio de “${tx.source}”, fora do Willo. O valor sai da caixinha.`;
    }
    return `O depósito de ${value} sai da caixinha.`;
  };

  const openMenu = () => {
    dots.current?.measureInWindow((x, y, w, h) => {
      setMenu({ top: y, bottom: y + h, left: x, width: w });
    });
  };

  if (loading || !goal) {
    return (
      <Room>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
          <View style={{ height: 44, justifyContent: "center" }}>
            <BackButton to="/gestao" />
          </View>
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={{ height: 200, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
            <View style={{ height: 80, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.04)" }} />
          </View>
        </ScrollView>
      </Room>
    );
  }

  const { progress, percent, remaining, isComplete } = goalProgress(goal);
  const preset = goalPreset(goal);
  /* No amount to reach: nothing to be done, left or late for. */
  const hasTarget = Number(goal.target_amount) > 0;

  const deposits = movements.filter((t) => Number(t.amount) > 0);
  const withdrawals = movements.filter((t) => Number(t.amount) < 0);
  const totalIn = deposits.reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = withdrawals.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  const pace = paceOf(goal);
  /* With a date, the month's figure is what it takes to arrive on it. */
  const dueIn = hasTarget && !isComplete && !pace.open && !pace.late;

  const monthsLeft =
    hasTarget && !dueIn && !isComplete && goal.monthly_contribution && goal.monthly_contribution > 0
      ? Math.ceil(remaining / goal.monthly_contribution)
      : 0;

  const perMonth = dueIn ? pace.monthly : goal.monthly_contribution && goal.monthly_contribution > 0 ? goal.monthly_contribution : 0;
  const arrives = isComplete
    ? "Concluída"
    : dueIn
      ? monthYear(goal.deadline as string)
      : pace.late
        ? "Prazo vencido"
        : monthsLeft > 0
          ? `${monthsLeft} ${monthsLeft === 1 ? "mês" : "meses"}`
          : "—";

  const forecast = earns(goal) && cdi !== null ? estimate(Number(goal.current_amount) || 0, cdi, Number(goal.yield_percent)) : null;
  const shown = showAll ? movements : movements.slice(0, PREVIEW);
  const heroH = Math.round(width * 1.15) + insets.top;
  const tileW = (width - 40 - 10) / 2;

  return (
    /* A plain ground, so the picture melts into it with no seam. */
    <View style={{ flex: 1, backgroundColor: GROUND_LIT }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ══ Its picture, edge to edge, melting into the page under what is kept ══ */}
        <View style={{ height: heroH }}>
          <CaixinhaCover goal={goal} height={heroH} glyph={280} glyphTop={insets.top + 50} />
          <LinearGradient
            colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 120 }}
          />
          <LinearGradient
            colors={["rgba(13,14,16,0)", "rgba(13,14,16,0.5)", "rgba(13,14,16,0.9)", GROUND_LIT]}
            locations={[0, 0.38, 0.72, 1]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.round(heroH * 0.66) }}
          />
        </View>

        {/* ══ What it is and what is kept, written on the fade ══ */}
        <Animated.View entering={FadeInDown.duration(460)} style={{ marginTop: -190, paddingHorizontal: 22 }}>
          {(earns(goal) || (hasTarget && !isComplete && goal.deadline) || isComplete || !hasTarget) && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {isComplete ? (
                <GlassPill tone={GREEN} label="Meta concluída" />
              ) : hasTarget && goal.deadline ? (
                <GlassPill label={pace.late ? "Prazo vencido" : `Até ${monthYear(goal.deadline)}`} tone={pace.late ? RED : undefined} />
              ) : !hasTarget ? (
                <GlassPill label="Sem valor definido" />
              ) : null}
              {earns(goal) && <GlassPill tone={GREEN} label={`Rende ${Number(goal.yield_percent)}% do CDI`} />}
            </View>
          )}
          <Text numberOfLines={2} style={{ fontSize: 17, fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>{goal.name}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{ marginTop: 2, fontSize: 52, fontWeight: "800", letterSpacing: -2.4, color: isComplete ? GREEN : "#fff" }}
          >
            {money(goal.current_amount)}
          </Text>
          {hasTarget ? (
            <View style={{ marginTop: 14 }}>
              <Progress progress={progress} color={isComplete ? GREEN : preset.hex} />
              <View style={{ marginTop: 9, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13.5, color: INK.soft }}>
                  <Text style={{ fontWeight: "700", color: isComplete ? GREEN : "#fff" }}>{percent}%</Text> de {money(goal.target_amount)}
                </Text>
                {!isComplete && (
                  <Text style={{ fontSize: 13.5, color: INK.soft }}>
                    faltam <Text style={{ fontWeight: "700", color: "#fff" }}>{money(remaining)}</Text>
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <Text style={{ marginTop: 6, fontSize: 14, color: INK.soft }}>Guardado até agora, no seu ritmo.</Text>
          )}
        </Animated.View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* ══ The two things done to a caixinha; the rest is under the three dots ══ */}
          <Animated.View entering={FadeInDown.delay(80).duration(420)} style={{ marginTop: 24, flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => setMoving("deposito")}
              style={({ pressed }) => ({
                flex: 1,
                height: 56,
                borderRadius: 28,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: "#fff",
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <ArrowDownLeft size={20} color="#0B0B0B" strokeWidth={2.5} />
              <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#0B0B0B" }}>Guardar</Text>
            </Pressable>
            <Pressable
              onPress={() => setMoving("saque")}
              disabled={goal.current_amount <= 0}
              style={({ pressed }) => ({
                flex: 1,
                height: 56,
                borderRadius: 28,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.16)",
                backgroundColor: "rgba(255,255,255,0.08)",
                opacity: goal.current_amount <= 0 ? 0.4 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <ArrowUpRight size={20} color="#fff" strokeWidth={2.3} />
              <Text style={{ fontSize: 16.5, fontWeight: "600", color: "#fff" }}>Retirar</Text>
            </Pressable>
          </Animated.View>

          {/* ══ The numbers a goal is judged by, each in its own small piece of glass ══ */}
          {hasTarget && (
            <Animated.View entering={FadeInDown.delay(120).duration(420)} style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Stat width={tileW} label="Guardado" value={money(goal.current_amount)} />
              <Stat width={tileW} label={isComplete ? "Concluída" : "Falta"} value={isComplete ? "100%" : money(remaining)} tone={isComplete ? GREEN : undefined} />
              <Stat width={tileW} label="Meta" value={money(goal.target_amount)} />
              <Stat width={tileW} label="Guardar por mês" value={perMonth > 0 ? money(perMonth) : "—"} />
              <Stat width={tileW * 2 + 10} label="Previsão de chegada" value={arrives} tone={pace.late && !isComplete ? RED : undefined} />
            </Animated.View>
          )}
          {!hasTarget && Number(goal.monthly_contribution) > 0 && (
            <Animated.View entering={FadeInDown.delay(120).duration(420)} style={{ marginTop: 14 }}>
              <Stat width={tileW * 2 + 10} label="Você guarda por mês" value={money(Number(goal.monthly_contribution))} />
            </Animated.View>
          )}

          {/* ══ What it earns: the rate it follows and what that is expected to come to ══ */}
          {earns(goal) && (
            <Animated.View
              entering={FadeInDown.delay(160).duration(420)}
              style={[PANEL, { marginTop: 14, backgroundColor: "rgba(200,243,109,0.06)", borderColor: "rgba(200,243,109,0.18)" }]}
            >
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                <Text style={T.eyebrow}>Rendimento estimado</Text>
                <Text style={{ fontSize: 12.5, color: INK.softer }}>{Number(goal.yield_percent)}% do CDI</Text>
              </View>
              {forecast ? (
                <View style={{ marginTop: 12, flexDirection: "row" }}>
                  <Reading label="Por dia" value={`+${money(forecast.day)}`} tone={GREEN} />
                  <Reading label="Por mês" value={`+${money(forecast.month)}`} tone={GREEN} />
                  <Reading label="Por ano" value={`+${money(forecast.year)}`} tone={GREEN} />
                </View>
              ) : (
                <Text style={{ marginTop: 10, fontSize: 13.5, color: INK.soft }}>
                  Calculando com o CDI de hoje. Volte em instantes.
                </Text>
              )}
              <Text style={{ marginTop: 12, fontSize: 12, lineHeight: 16, color: INK.softer }}>
                {earned > 0 ? `${money(earned)} já rendidos. ` : ""}Estimativa bruta de imposto, em dias úteis; o rendimento real pode variar.
              </Text>
            </Animated.View>
          )}

          {/* ══ Every movement, as transactions are ══ */}
          <Animated.View entering={FadeInDown.delay(180).duration(420)} style={{ marginTop: 30 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 }}>
              <Text style={T.eyebrow}>Movimentações</Text>
              {movements.length > 0 && (
                <Text style={{ fontSize: 12.5, color: INK.softer }}>
                  <Text style={{ color: GREEN }}>+{money(totalIn)}</Text>
                  {totalOut > 0 ? <Text>  <Text style={{ color: RED }}>−{money(totalOut)}</Text></Text> : null}
                </Text>
              )}
            </View>

            {movements.length === 0 ? (
              <Text style={{ paddingVertical: 32, textAlign: "center", fontSize: 14, color: INK.soft }}>
                Nenhuma movimentação ainda
              </Text>
            ) : (
              <View style={{ marginTop: 6 }}>
                {shown.map((tx, i) => {
                  /* A month's name over the first of its movements, as the transactions do. */
                  const monthOf = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                  const heading = i === 0 || monthOf(shown[i - 1].date) !== monthOf(tx.date) ? monthOf(tx.date) : null;
                  const value = Number(tx.amount);
                  const isWithdraw = value < 0;
                  const isYield = tx.source === YIELD_SOURCE;
                  const tone = isWithdraw ? RED : GREEN;
                  const Glyph = isWithdraw ? ArrowUpRight : ArrowDownLeft;
                  const day = new Date(`${tx.date.slice(0, 10)}T12:00:00`);
                  const sameYear = day.getFullYear() === new Date().getFullYear();
                  const date = day.toLocaleDateString("pt-BR", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
                  const under = [date, isYield ? "estimado" : tx.source || null, tx.account_id ? accountNames[tx.account_id] || null : null]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <View key={tx.id}>
                    {heading && (
                      <Text style={{ marginTop: i === 0 ? 8 : 18, marginBottom: 2, fontSize: 13, fontWeight: "600", color: INK.softer, textTransform: "capitalize" }}>
                        {heading}
                      </Text>
                    )}
                    <Pressable
                      disabled={isWithdraw || isYield}
                      onLongPress={() => setConfirming(tx)}
                      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, opacity: pressed && !isWithdraw && !isYield ? 0.7 : 1 })}
                    >
                      <View
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 23,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isWithdraw ? "rgba(248,113,113,0.13)" : "rgba(200,243,109,0.13)",
                        }}
                      >
                        <Glyph size={20} color={tone} strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>
                          {isWithdraw ? "Retirada" : isYield ? "Rendimento" : "Depósito"}
                        </Text>
                        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>{under}</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: tone }}>
                        {isWithdraw ? "−" : "+"}
                        {money(Math.abs(value))}
                      </Text>
                    </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            {movements.length > PREVIEW && (
              <Pressable
                onPress={() => setShowAll((v) => !v)}
                style={({ pressed }) => ({
                  marginTop: 12,
                  height: 52,
                  borderRadius: 26,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                {showAll ? <ChevronUp size={15} color="#fff" /> : <ChevronDown size={15} color="#fff" />}
                <Text style={{ fontSize: 15.5, fontWeight: "500", color: "#fff" }}>
                  {showAll ? "Mostrar menos" : `Ver todas as movimentações (${movements.length})`}
                </Text>
              </Pressable>
            )}
            {deposits.some((t) => t.source !== YIELD_SOURCE) && (
              <Text style={{ marginTop: 10, paddingHorizontal: 4, fontSize: 11.5, color: INK.softer }}>
                Segure um depósito para desfazê-lo.
              </Text>
            )}
          </Animated.View>

          {error && <Text style={{ marginTop: 14, paddingHorizontal: 4, fontSize: 13, color: RED }}>{error}</Text>}
        </View>
      </ScrollView>

      <View style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <HeroButton label="Voltar" onPress={() => router.replace("/gestao" as never)}>
          <ChevronLeft size={21} color="#fff" strokeWidth={2.4} />
        </HeroButton>
        <HeroButton label="Opções da caixinha" hostRef={dots} onPress={openMenu}>
          <MoreHorizontal size={21} color="#fff" strokeWidth={2.4} />
        </HeroButton>
      </View>

      <AnchoredMenu open={!!menu} anchor={menu} onClose={() => setMenu(null)}>
        <MenuHeader title={goal.name} subtitle={hasTarget ? `${percent}% de ${money(goal.target_amount)}` : "Sem valor definido"} />
        <MenuRow
          icon={Pencil}
          label="Editar caixinha"
          onPress={() => {
            setMenu(null);
            setEditing(true);
          }}
        />
        <MenuRow
          icon={ImageIcon}
          label={goal.cover_image ? "Trocar imagem" : "Adicionar imagem"}
          last={false}
          onPress={() => {
            setMenu(null);
            void changeCover();
          }}
        />
        {goal.cover_image ? (
          <MenuRow
            icon={Trash2}
            label="Remover imagem"
            onPress={() => {
              setMenu(null);
              void clearCover();
            }}
          />
        ) : null}
        <MenuRow
          icon={Trash2}
          label="Excluir caixinha"
          danger
          last
          onPress={() => {
            setMenu(null);
            setConfirming("meta");
          }}
        />
      </AnchoredMenu>

      <ConfirmGlass
        open={!!confirming}
        title={confirming === "meta" ? `Excluir ${goal.name}?` : "Remover depósito"}
        confirmLabel={confirming === "meta" ? "Excluir" : "Remover"}
        onConfirm={() => (confirming === "meta" ? void removeGoal() : confirming ? void removeDeposit(confirming) : undefined)}
        onClose={() => setConfirming(null)}
      >
        {confirming === "meta"
          ? "Esta ação não pode ser desfeita. O dinheiro guardado nela deixa de contar como caixinha."
          : confirming
            ? undoDescription(confirming)
            : ""}
      </ConfirmGlass>

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
        title="Editar caixinha"
        initial={{
          name: goal.name,
          target_amount: goal.target_amount,
          monthly_contribution: goal.monthly_contribution ?? null,
          deadline: goal.deadline ?? null,
          yield_type: goal.yield_type ?? null,
          yield_percent: goal.yield_percent ?? null,
        }}
        saved={goal.current_amount}
      />
    </View>
  );
}

/**
 * A round button over the picture.
 *
 * Light glass rather than dark: a blur with a white wash and a bright rim reads as a
 * lens on any photo, where a dark wash over a dark picture only ever looked muddy.
 */
function HeroButton({
  label,
  onPress,
  hostRef,
  children,
}: {
  label: string;
  onPress: () => void;
  hostRef?: React.Ref<ComponentRef<typeof View>>;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      ref={hostRef}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.34)",
        }}
      >
        <BlurView intensity={32} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22 }} />
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)" }} />
        <View style={{ zIndex: 1 }}>{children}</View>
      </View>
    </Pressable>
  );
}

/** A small label in glass, for the two or three things worth knowing at a glance. */
function GlassPill({ label, tone }: { label: string; tone?: string }) {
  return (
    <View
      style={{
        height: 28,
        paddingHorizontal: 12,
        borderRadius: 14,
        overflow: "hidden",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: tone ? `${tone}66` : "rgba(255,255,255,0.28)",
      }}
    >
      <BlurView intensity={30} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14 }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, backgroundColor: tone ? `${tone}22` : "rgba(255,255,255,0.12)" }} />
      <Text style={{ zIndex: 1, fontSize: 12.5, fontWeight: "700", color: tone ?? "#fff" }}>{label}</Text>
    </View>
  );
}

/** One number in its own small piece of glass: what it is, and the figure. */
function Stat({ width, label, value, tone }: { width: number; label: string; value: string; tone?: string }) {
  return (
    <View
      style={{
        width,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 22,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.09)",
        backgroundColor: "rgba(255,255,255,0.055)",
      }}
    >
      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: INK.softer }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ marginTop: 5, fontSize: 19, fontWeight: "800", letterSpacing: -0.5, color: tone ?? "#fff" }}>
        {value}
      </Text>
    </View>
  );
}

/** One of the readings, side by side. */
function Reading({ label, value, late, tone }: { label: string; value: string; late?: boolean; tone?: string }) {
  return (
    <View style={{ flex: 1, paddingRight: 12 }}>
      <Text numberOfLines={1} style={{ fontSize: 12, color: INK.softer }}>{label}</Text>
      <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 18, fontWeight: "700", letterSpacing: -0.4, color: late ? RED : (tone ?? "#fff") }}>
        {value}
      </Text>
    </View>
  );
}
