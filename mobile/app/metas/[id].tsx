import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowDownLeft, ArrowUpRight, MoreVertical, Pencil, Sparkles, Trash2 } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  computeGoalInsights, createGoalDeposit, createGoalWithdraw, deleteGoal, deleteGoalDepositWithRefund, fetchGoalById, fetchGoalTransactions,
  type Goal, type GoalTransaction,
} from "@/services/goalService";
import { useMoney } from "@/components/projecoes/shared";
import { GoalDepositSheet, GoalEditSheet, GoalWithdrawSheet } from "~/features/goals/GoalSheets";
import { BottomSheet, Button, Glass, PageHeader, Screen, Text, colors, toast, white } from "~/ui";

const R = 40;
const C = 2 * Math.PI * R;

/** O progresso numa meta, os depósitos e saques, e as ações: guardar, sacar, editar, excluir. */
export default function MetaDetalhe() {
  const router = useRouter();
  const { user } = useAuth();
  const { fmt } = useMoney();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [txs, setTxs] = useState<GoalTransaction[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [deposit, setDeposit] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const [edit, setEdit] = useState<Goal | null>(null);
  const [menu, setMenu] = useState(false);
  const [all, setAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([fetchGoalById(id), fetchGoalTransactions(id)]);
      setGoal(g); setTxs(t);
      const ids = [...new Set(t.filter((x) => x.account_id).map((x) => x.account_id!))];
      if (ids.length) {
        const { data } = await supabase.from("accounts").select("id, name").in("id", ids);
        setNames(Object.fromEntries((data ?? []).map((a: any) => [a.id, a.name])));
      }
    } catch {
      toast.error("Erro ao carregar meta");
      router.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!goal) return <Screen><PageHeader title="Meta" /></Screen>;

  const target = Number(goal.target_amount);
  const current = Number(goal.current_amount);
  const progress = target > 0 ? Math.min(1, current / target) : 0;
  const remaining = target - current;
  const done = target > 0 && progress >= 1;
  const insight = computeGoalInsights(goal, txs)[0];
  const months = !done && goal.monthly_contribution && Number(goal.monthly_contribution) > 0 ? Math.ceil(remaining / Number(goal.monthly_contribution)) : 0;
  const deposits = txs.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const withdrawals = txs.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const visible = all ? txs : txs.slice(0, 5);

  const onDeposit = async (d: { amount: number; date: string; source?: string; account_id?: string }) => {
    if (!user) return;
    try { await createGoalDeposit({ goal_id: id, ...d }, user.id); toast.success("Dinheiro guardado!"); setDeposit(false); load(); } catch { toast.error("Erro ao depositar"); }
  };
  const onWithdraw = async (d: { amount: number; date: string; account_id?: string; destination?: string }) => {
    if (!user) return;
    try { await createGoalWithdraw({ goal_id: id, ...d }, user.id); toast.success("Saque realizado!"); setWithdraw(false); load(); } catch { toast.error("Erro ao sacar"); }
  };

  const removeGoal = () => {
    setMenu(false);
    Alert.alert("Excluir meta", `Tem certeza que deseja excluir "${goal.name}"? Esta ação não pode ser desfeita.`, [
      { text: "Excluir", style: "destructive", onPress: async () => { try { await deleteGoal(id); toast.success("Meta excluída"); router.back(); } catch { toast.error("Erro ao excluir meta"); } } },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const removeDeposit = (tx: GoalTransaction) => {
    const amt = fmt(Math.abs(Number(tx.amount)));
    const text = tx.account_id && names[tx.account_id] ? `O valor de ${amt} será devolvido para a conta "${names[tx.account_id]}".` : tx.source ? `Este depósito de ${amt} veio de "${tx.source}". O valor será removido da meta.` : `O depósito de ${amt} será removido da meta.`;
    Alert.alert("Remover depósito", text, [
      { text: "Remover", style: "destructive", onPress: async () => { if (!user) return; try { await deleteGoalDepositWithRefund(tx, user.id, goal.name); toast.success("Depósito removido"); load(); } catch { toast.error("Erro ao remover depósito"); } } },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  return (
    <Screen onRefresh={load}>
      <PageHeader
        title={goal.name}
        action={
          <Pressable onPress={() => setMenu(true)} accessibilityLabel="Opções" style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: white(0.06) }}>
            <MoreVertical size={16} color={white(0.82)} />
          </Pressable>
        }
      />

      <Glass radius={26} style={{ marginTop: 20, padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
          <View style={{ width: 96, height: 96, alignItems: "center", justifyContent: "center" }}>
            <Svg width={96} height={96} style={{ transform: [{ rotate: "-90deg" }] }}>
              <Circle cx={48} cy={48} r={R} stroke={white(0.1)} strokeWidth={10} fill="none" />
              <Circle cx={48} cy={48} r={R} stroke={done ? colors.green : "#fff"} strokeWidth={10} strokeLinecap="round" fill="none" strokeDasharray={`${C * progress} ${C}`} />
            </Svg>
            <View style={{ position: "absolute", alignItems: "center" }}>
              <Text weight="extrabold" size={18} tabular>{target > 0 ? `${Math.round(progress * 100)}%` : "—"}</Text>
              <Text size={10} color={white(0.56)}>{done ? "concluída" : "concluído"}</Text>
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={13} color={white(0.62)}>Guardado</Text>
            <Text weight="extrabold" size={26} tabular numberOfLines={1} style={{ letterSpacing: -0.6 }}>{fmt(current)}</Text>
            {target > 0 && <Text size={12} color={white(0.62)} tabular>de {fmt(target)}{remaining > 0 ? ` · faltam ${fmt(remaining)}` : ""}</Text>}
          </View>
        </View>
        {!done && (
          <View style={{ marginTop: 18, flexDirection: "row", gap: 10 }}>
            <Button label="Depósito" height={48} icon={<ArrowDownLeft size={16} color={colors.black} />} style={{ flex: 1 }} onPress={() => setDeposit(true)} />
            <Button label="Saque" variant="glass" height={48} icon={<ArrowUpRight size={16} color="#fff" />} style={{ flex: 1 }} onPress={() => setWithdraw(true)} />
          </View>
        )}
      </Glass>

      <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
        {[
          { label: "Depósitos", value: fmt(deposits), color: colors.green },
          { label: "Saques", value: fmt(withdrawals), color: colors.red },
          { label: months > 0 ? "Previsão" : "Por mês", value: months > 0 ? `${months} ${months === 1 ? "mês" : "meses"}` : goal.monthly_contribution ? `${fmt(Number(goal.monthly_contribution))}` : "—", color: "#fff" },
        ].map((s) => (
          <Glass key={s.label} radius={18} style={{ flex: 1, padding: 12, alignItems: "center" }}>
            <Text size={11} color={white(0.56)}>{s.label}</Text>
            <Text weight="bold" size={13} tabular color={s.color} numberOfLines={1}>{s.value}</Text>
          </Glass>
        ))}
      </View>

      {insight && (
        <Glass radius={18} style={{ marginTop: 12, padding: 14, flexDirection: "row", gap: 10 }}>
          <Sparkles size={16} color="#fff" style={{ marginTop: 2 }} />
          <Text size={13} color={white(0.74)} style={{ flex: 1, lineHeight: 19 }}>{insight}</Text>
        </Glass>
      )}

      <Glass radius={22} style={{ marginTop: 12, padding: 16 }}>
        <Text weight="semibold" size={12} color={white(0.5)} style={{ letterSpacing: 1.2, textTransform: "uppercase" }}>Movimentações</Text>
        {txs.length === 0 ? (
          <Text size={13} color={white(0.56)} align="center" style={{ paddingVertical: 28 }}>Nenhuma movimentação ainda</Text>
        ) : (
          <View style={{ marginTop: 8 }}>
            {visible.map((tx) => {
              const out = Number(tx.amount) < 0;
              const [y, m, d] = tx.date.slice(0, 10).split("-");
              return (
                <Pressable key={tx.id} onLongPress={out ? undefined : () => removeDeposit(tx)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: out ? "rgba(248,113,113,0.12)" : "rgba(200,243,109,0.12)" }}>
                    {out ? <ArrowUpRight size={15} color={colors.red} /> : <ArrowDownLeft size={15} color={colors.green} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="semibold" size={14} color={out ? colors.red : colors.green}>{out ? "Saque" : "Depósito"}</Text>
                    <Text size={11.5} color={white(0.56)} numberOfLines={1}>{`${d}/${m}/${y}`}{tx.source ? ` · ${tx.source}` : ""}{tx.account_id && names[tx.account_id] ? ` · ${names[tx.account_id]}` : ""}</Text>
                  </View>
                  <Text weight="bold" size={14} tabular color={out ? colors.red : colors.green}>{out ? "−" : "+"}{fmt(Math.abs(Number(tx.amount)))}</Text>
                </Pressable>
              );
            })}
            {txs.length > 5 && (
              <Pressable onPress={() => setAll((v) => !v)} style={{ paddingVertical: 10, alignItems: "center" }}>
                <Text size={12} color={white(0.62)}>{all ? "Mostrar menos" : `Ver todas (${txs.length})`}</Text>
              </Pressable>
            )}
            <Text size={11} color={white(0.4)} align="center" style={{ marginTop: 4 }}>Segure um depósito para removê-lo</Text>
          </View>
        )}
      </Glass>

      <GoalDepositSheet open={deposit} onClose={() => setDeposit(false)} goalName={goal.name} onSubmit={onDeposit} />
      <GoalWithdrawSheet open={withdraw} onClose={() => setWithdraw(false)} goalName={goal.name} maxAmount={current} onSubmit={onWithdraw} />
      <GoalEditSheet goal={edit} onClose={() => setEdit(null)} onUpdated={load} />

      <BottomSheet open={menu} onClose={() => setMenu(false)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <Pressable onPress={() => { setMenu(false); setEdit(goal); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}>
            <Pencil size={18} color="#fff" /><Text size={16}>Editar meta</Text>
          </Pressable>
          <Pressable onPress={removeGoal} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: white(0.06) }}>
            <Trash2 size={18} color={colors.red} /><Text size={16} color={colors.red}>Excluir meta</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </Screen>
  );
}
