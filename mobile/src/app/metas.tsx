import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  createGoal,
  createGoalDeposit,
  deleteGoal,
  fetchGoals,
  updateGoal,
  type Goal,
} from "@/services/goalService";
import { goalProgress } from "@/lib/goalPresets";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import BottomSheet from "~/components/BottomSheet";
import AnchoredMenu, { MenuHeader, MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import GoalFormSheet from "~/components/metas/GoalFormSheet";
import { paceOf } from "~/lib/cofrinho";
import GoalMoveSheet from "~/components/metas/GoalMoveSheet";
import { goalPreset } from "~/lib/goalIcon";
import { Clock, MoreVertical, Pencil, Plus, Target, Trash2, Wallet } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What you are saving for.
 *
 * The total leads — everything put aside against everything promised — because a
 * page of separate goals makes it hard to see that you are, in fact, saving. Then
 * one card per goal: how far along, what is left, and the only button a goal really
 * needs, which is the one that puts money into it.
 */
export default function Metas() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [depositing, setDepositing] = useState<Goal | null>(null);
  const [confirming, setConfirming] = useState<Goal | null>(null);
  const [menu, setMenu] = useState<{ goal: Goal; rect: AnchorRect } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dots = useRef<Record<string, ComponentRef<typeof View> | null>>({});

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
  const guardado = list.reduce((s, g) => s + g.current_amount, 0);
  const objetivo = list.reduce((s, g) => s + g.target_amount, 0);
  const overall = objetivo > 0 ? Math.min(guardado / objetivo, 1) : 0;

  const announce = () => window.dispatchEvent(new CustomEvent("finance-data-changed"));

  const create = async (data: {
    name: string;
    target_amount: number;
    monthly_contribution: number | null;
    deadline: string | null;
  }) => {
    if (!user) return;
    await createGoal(data, user.id);
    setCreating(false);
    await load();
    announce();
  };

  const update = async (data: {
    name: string;
    target_amount: number;
    monthly_contribution: number | null;
    deadline: string | null;
  }) => {
    if (!editing) return;
    await updateGoal(editing.id, data);
    setEditing(null);
    await load();
    announce();
  };

  const deposit = async (data: {
    amount: number;
    date: string;
    account_id?: string;
    source?: string;
  }) => {
    if (!user || !depositing) return;
    await createGoalDeposit({ goal_id: depositing.id, ...data }, user.id);
    setDepositing(null);
    await load();
    announce();
  };

  const remove = async (goal: Goal) => {
    try {
      await deleteGoal(goal.id);
      setConfirming(null);
      await load();
      announce();
    } catch {
      setError("Não foi possível excluir a meta.");
    }
  };

  const openMenu = (goal: Goal) => {
    dots.current[goal.id]?.measureInWindow((x, y, w, h) => {
      setMenu({ goal, rect: { top: y, bottom: y + h, left: x, width: w } });
    });
  };

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
          <BackButton to="/" />
          <Pressable
            accessibilityLabel="Nova meta"
            onPress={() => setCreating(true)}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <Plus size={20} color="#0B0B0B" strokeWidth={2.6} />
          </Pressable>
        </View>

        {goals === null ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            {[0, 1].map((i) => (
              <View key={i} style={{ height: 180, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
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
              <Text style={{ marginTop: 20, fontSize: 18, fontWeight: "700", color: "#fff" }}>
                Nenhuma meta ainda
              </Text>
              <Text style={{ marginTop: 4, textAlign: "center", fontSize: 14, lineHeight: 19, color: INK.soft }}>
                Crie sua primeira meta e acompanhe quanto falta para chegar lá.
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
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#0B0B0B" }}>Criar meta</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {/* ══ Everything put aside, against everything promised ══ */}
            <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 4, paddingTop: 10 }}>
              <Text style={{ fontSize: 15, color: INK.soft }}>Total guardado</Text>
              <Text numberOfLines={1} style={[T.figureBig, { marginTop: 2, fontSize: 40 }]}>
                {money(guardado)}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 14, color: INK.soft }}>
                de {money(objetivo)} · {Math.round(overall * 100)}%
              </Text>
              <View
                style={{
                  marginTop: 12,
                  height: 10,
                  borderRadius: 999,
                  overflow: "hidden",
                  backgroundColor: "rgba(255,255,255,0.08)",
                }}
              >
                <Bar share={overall} color="#fff" delay={0.1} />
              </View>
            </Animated.View>

            <Text style={[T.eyebrow, { marginTop: 26, marginBottom: 10, paddingHorizontal: 4 }]}>
              Suas metas
            </Text>

            <View style={{ gap: 12 }}>
              {list.map((goal, i) => {
                const { progress, percent, remaining, isComplete } = goalProgress(goal);
                const preset = goalPreset(goal);
                const Icon = preset.icon;
                const deadline = goal.deadline ? new Date(`${goal.deadline}T12:00:00`) : null;
                const pace = paceOf(goal);
                const details = [
                  `Faltam ${money(remaining)}`,
                  /* With a date, the month's figure is what it takes to arrive on it. */
                  !isComplete && !pace.open && !pace.late
                    ? `guarde ${money(pace.monthly)}/mês`
                    : goal.monthly_contribution
                      ? `${money(goal.monthly_contribution)}/mês`
                      : null,
                  deadline
                    ? `até ${deadline
                        .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
                        .replace(".", "")}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <Animated.View key={goal.id} entering={FadeInDown.delay(60 + i * 50).duration(400)}>
                    <Surface radius={24} onPress={() => router.push(`/metas/${goal.id}` as never)} style={{ padding: 16 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: `${preset.hex}22`,
                          }}
                        >
                          <Icon size={20} color={preset.hex} strokeWidth={2} />
                        </View>

                        {isComplete && (
                          <Text
                            style={{
                              overflow: "hidden",
                              borderRadius: 999,
                              backgroundColor: GREEN,
                              paddingHorizontal: 9,
                              paddingVertical: 3,
                              fontSize: 10,
                              fontWeight: "700",
                              color: "#0B0B0B",
                            }}
                          >
                            Concluída
                          </Text>
                        )}

                        <View style={{ flex: isComplete ? 0 : 1 }} />

                        <Pressable
                          ref={(node) => {
                            dots.current[goal.id] = node;
                          }}
                          accessibilityLabel="Opções da meta"
                          hitSlop={8}
                          onPress={() => openMenu(goal)}
                          style={({ pressed }) => ({
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "rgba(255,255,255,0.06)",
                            opacity: pressed ? 0.6 : 1,
                          })}
                        >
                          <MoreVertical size={16} color="rgba(255,255,255,0.74)" />
                        </Pressable>
                      </View>

                      <Text numberOfLines={1} style={{ marginTop: 12, fontSize: 17, fontWeight: "600", color: "#fff" }}>
                        {goal.name}
                      </Text>

                      <View
                        style={{
                          marginTop: 4,
                          flexDirection: "row",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 15, color: INK.soft }}>
                          <Text style={{ fontWeight: "700", color: "#fff" }}>{money(goal.current_amount)}</Text> de{" "}
                          {money(goal.target_amount)}
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: isComplete ? GREEN : "#fff" }}>
                          {percent}%
                        </Text>
                      </View>

                      <View
                        style={{
                          marginTop: 8,
                          height: 8,
                          borderRadius: 999,
                          overflow: "hidden",
                          backgroundColor: "rgba(255,255,255,0.08)",
                        }}
                      >
                        <Bar share={progress} color={isComplete ? GREEN : "#fff"} delay={0.1 + i * 0.06} />
                      </View>

                      <Text numberOfLines={1} style={{ marginTop: 8, fontSize: 12, color: INK.soft }}>
                        {isComplete ? "Meta alcançada" : details}
                      </Text>

                      {!isComplete && (
                        <View style={{ marginTop: 14, flexDirection: "row", gap: 8 }}>
                          <Pressable
                            onPress={() => setDepositing(goal)}
                            style={({ pressed }) => ({
                              flex: 1,
                              height: 44,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              borderRadius: 22,
                              backgroundColor: "#fff",
                              opacity: pressed ? 0.85 : 1,
                            })}
                          >
                            <Wallet size={16} color="#0B0B0B" />
                            <Text style={{ fontSize: 14, fontWeight: "700", color: "#0B0B0B" }}>
                              Guardar dinheiro
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityLabel="Histórico"
                            onPress={() => router.push(`/metas/${goal.id}` as never)}
                            style={({ pressed }) => ({
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "rgba(255,255,255,0.08)",
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Clock size={16} color="rgba(255,255,255,0.82)" />
                          </Pressable>
                        </View>
                      )}
                    </Surface>
                  </Animated.View>
                );
              })}
            </View>

            {error && (
              <Text style={{ marginTop: 14, paddingHorizontal: 4, fontSize: 13, color: RED }}>{error}</Text>
            )}
          </>
        )}
      </ScrollView>

      <AnchoredMenu open={!!menu} anchor={menu?.rect} onClose={() => setMenu(null)}>
        <MenuHeader title={menu?.goal.name ?? "Meta"} subtitle={menu ? money(menu.goal.current_amount) : undefined} />
        <MenuRow
          icon={Pencil}
          label="Editar meta"
          onPress={() => {
            const goal = menu?.goal ?? null;
            setMenu(null);
            setEditing(goal);
          }}
        />
        <MenuRow
          icon={Trash2}
          label="Excluir meta"
          danger
          last
          onPress={() => {
            const goal = menu?.goal ?? null;
            setMenu(null);
            setConfirming(goal);
          }}
        />
      </AnchoredMenu>

      <BottomSheet open={!!confirming} onClose={() => setConfirming(null)}>
        {confirming && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>Excluir meta</Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: INK.soft }}>
              Tem certeza que deseja excluir “{confirming.name}”? Esta ação não pode ser desfeita.
            </Text>
            <Pressable
              onPress={() => void remove(confirming)}
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
              <Text style={{ fontSize: 16, fontWeight: "700", color: RED }}>Excluir</Text>
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

      <GoalFormSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={create}
        title="Nova meta"
        existingNames={list.map((g) => g.name)}
      />

      <GoalFormSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={update}
        title="Editar meta"
        initial={
          editing
            ? {
                name: editing.name,
                target_amount: editing.target_amount,
                monthly_contribution: editing.monthly_contribution ?? null,
                deadline: editing.deadline ?? null,
              }
            : undefined
        }
        saved={editing?.current_amount ?? 0}
        existingNames={list.filter((g) => g.id !== editing?.id).map((g) => g.name)}
      />

      <GoalMoveSheet
        open={!!depositing}
        onClose={() => setDepositing(null)}
        onSubmit={deposit}
        goalName={depositing?.name ?? ""}
        mode="deposito"
      />
    </Room>
  );
}
