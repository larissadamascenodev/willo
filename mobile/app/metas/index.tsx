import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight, Clock, Edit2, MoreVertical, Plus, Target, Trash2, Wallet } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { createGoal, createGoalDeposit, deleteGoal, fetchGoals, type Goal } from "@/services/goalService";
import { getGoalPreset } from "@/lib/goalIcons";
import { useMoney } from "@/components/projecoes/shared";
import { GoalCreateSheet, GoalDepositSheet, GoalEditSheet } from "~/features/goals/GoalSheets";
import { BottomSheet, Button, Glass, PageHeader, ProgressBar, Screen, SectionTitle, Text, colors, toast, white } from "~/ui";
import { tint } from "~/lib/color";

/** Metas: o total guardado e cada objetivo, com o botão de guardar dinheiro. */
export default function Metas() {
  const router = useRouter();
  const { user } = useAuth();
  const { fmt } = useMoney();
  const { novo } = useLocalSearchParams<{ novo?: string }>();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [menuGoal, setMenuGoal] = useState<Goal | null>(null);

  const load = useCallback(async () => {
    try { setGoals(await fetchGoals()); } catch { toast.error("Erro ao carregar metas"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // atalho da Carteira: /metas?novo=reserva abre a criação já no objetivo certo
  useEffect(() => { if (novo) setShowCreate(true); }, [novo]);

  const saved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const target = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const overall = target > 0 ? Math.min(saved / target, 1) : 0;

  const create = async (d: { name: string; target_amount: number }) => {
    if (!user) return;
    try { await createGoal(d, user.id); toast.success("Meta criada!"); setShowCreate(false); load(); } catch { toast.error("Erro ao criar meta"); }
  };

  const deposit = async (d: { amount: number; date: string; source?: string; account_id?: string }) => {
    if (!user || !depositGoal) return;
    try { await createGoalDeposit({ goal_id: depositGoal.id, ...d }, user.id); toast.success("Dinheiro guardado!"); setDepositGoal(null); load(); } catch { toast.error("Erro ao depositar"); }
  };

  const remove = (g: Goal) => {
    setMenuGoal(null);
    Alert.alert("Excluir meta", "Tem certeza? Esta ação não pode ser desfeita.", [
      { text: "Excluir", style: "destructive", onPress: async () => { try { await deleteGoal(g.id); toast.success("Meta excluída"); load(); } catch { toast.error("Erro ao excluir meta"); } } },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  return (
    <Screen onRefresh={load}>
      <PageHeader
        title="Metas"
        subtitle="Junte dinheiro para o que importa"
        action={
          <Pressable onPress={() => setShowCreate(true)} accessibilityLabel="Nova meta" style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
            <Plus size={20} color={colors.black} strokeWidth={2.5} />
          </Pressable>
        }
      />

      {goals.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text size={15} color={white(0.66)}>Total guardado</Text>
          <Text weight="extrabold" size={40} tabular style={{ letterSpacing: -1 }}>{fmt(saved)}</Text>
          <Text size={14} color={white(0.62)} tabular>de {fmt(target)} · {Math.round(overall * 100)}%</Text>
          <View style={{ marginTop: 12 }}><ProgressBar ratio={overall} color="#fff" height={10} track={white(0.08)} /></View>
        </View>
      )}

      {goals.length > 0 && <SectionTitle>Suas metas</SectionTitle>}

      {loading ? (
        <View style={{ marginTop: 24, gap: 12 }}>{[1, 2].map((i) => <View key={i} style={{ height: 220, borderRadius: 24, backgroundColor: white(0.06) }} />)}</View>
      ) : goals.length === 0 ? (
        <View style={{ marginTop: 48, alignItems: "center", paddingHorizontal: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: white(0.12), backgroundColor: white(0.05) }}>
            <Target size={32} color={white(0.56)} />
          </View>
          <Text weight="bold" size={18} style={{ marginTop: 20 }}>Nenhuma meta ainda</Text>
          <Text size={14} color={white(0.62)} align="center" style={{ marginTop: 4 }}>Crie sua primeira meta e acompanhe quanto falta para chegar lá.</Text>
          <Button label="Criar meta" height={48} style={{ marginTop: 20 }} onPress={() => setShowCreate(true)} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {goals.map((g) => {
            const targetAmt = Number(g.target_amount);
            const progress = targetAmt > 0 ? Math.min(1, Number(g.current_amount) / targetAmt) : 0;
            const remaining = Math.max(targetAmt - Number(g.current_amount), 0);
            const done = targetAmt > 0 && progress >= 1;
            const preset = getGoalPreset(g);
            const Icon = preset.icon;
            const deadline = g.deadline ? new Date(`${g.deadline}T12:00:00`) : null;
            const details = [
              targetAmt > 0 ? `Faltam ${fmt(remaining)}` : "Sem valor definido",
              g.monthly_contribution ? `${fmt(Number(g.monthly_contribution))}/mês` : null,
              deadline ? `até ${deadline.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}` : null,
            ].filter(Boolean).join(" · ");
            return (
              <Pressable key={g.id} onPress={() => router.push({ pathname: "/metas/[id]", params: { id: g.id } })}>
                <Glass radius={24} style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: tint(preset.hex, 0.13) }}>
                      {g.cover_image ? <Image source={{ uri: g.cover_image }} style={{ width: 44, height: 44 }} contentFit="cover" /> : <Icon size={20} color={preset.hex} />}
                    </View>
                    <Pressable onPress={() => setMenuGoal(g)} accessibilityLabel="Opções" hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: white(0.06) }}>
                      <MoreVertical size={16} color={white(0.74)} />
                    </Pressable>
                  </View>
                  <View style={{ marginTop: 12 }}>
                    {done && <View style={{ alignSelf: "flex-start", borderRadius: 999, backgroundColor: colors.green, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 }}><Text size={10} weight="bold" color={colors.black}>Concluída</Text></View>}
                    <Text weight="semibold" size={17} numberOfLines={1}>{g.name}</Text>
                    <View style={{ marginTop: 4, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                      <Text size={15} tabular><Text weight="bold" size={15}>{fmt(Number(g.current_amount))}</Text>{targetAmt > 0 ? <Text size={15} color={white(0.56)}> de {fmt(targetAmt)}</Text> : null}</Text>
                      {targetAmt > 0 && <Text size={13} weight="semibold" tabular color={done ? colors.green : "#fff"}>{Math.round(progress * 100)}%</Text>}
                    </View>
                    {targetAmt > 0 && <View style={{ marginTop: 8 }}><ProgressBar ratio={progress} color={done ? colors.green : "#fff"} height={8} track={white(0.08)} /></View>}
                    <Text size={12} color={white(0.62)} numberOfLines={1} style={{ marginTop: 8 }}>{done ? "Meta alcançada" : details}</Text>
                    {!done && (
                      <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                        <Button label="Guardar dinheiro" height={44} icon={<Wallet size={16} color={colors.black} />} style={{ flex: 1 }} onPress={() => setDepositGoal(g)} />
                        <Pressable onPress={() => router.push({ pathname: "/metas/[id]", params: { id: g.id } })} accessibilityLabel="Histórico" style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: white(0.08) }}>
                          <Clock size={16} color={white(0.82)} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                </Glass>
              </Pressable>
            );
          })}
        </View>
      )}

      <GoalCreateSheet open={showCreate} onClose={() => setShowCreate(false)} existingNames={goals.map((g) => g.name)} initialPresetId={novo === "reserva" ? "reserva" : undefined} onSubmit={create} />
      <GoalDepositSheet open={!!depositGoal} onClose={() => setDepositGoal(null)} goalName={depositGoal?.name ?? ""} onSubmit={deposit} />
      <GoalEditSheet goal={editGoal} onClose={() => setEditGoal(null)} onUpdated={load} />

      <BottomSheet open={!!menuGoal} onClose={() => setMenuGoal(null)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <Text display weight="bold" size={20} numberOfLines={1}>{menuGoal?.name}</Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            <Pressable onPress={() => { setEditGoal(menuGoal); setMenuGoal(null); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, backgroundColor: white(0.05), padding: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}><Edit2 size={16} color={colors.black} /></View>
              <Text weight="medium" size={15}>Editar meta</Text>
            </Pressable>
            <Pressable onPress={() => menuGoal && remove(menuGoal)} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, backgroundColor: "rgba(239,68,68,0.08)", padding: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(239,68,68,0.15)", alignItems: "center", justifyContent: "center" }}><Trash2 size={16} color={colors.red} /></View>
              <Text weight="medium" size={15} color={colors.red}>Excluir meta</Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}
