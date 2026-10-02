import { memo, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { ChevronRight } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getGoalPreset } from "@/lib/goalIcons";
import { useMoney } from "@/components/projecoes/shared";
import { ProgressBar, Surface, Text, colors, white } from "~/ui";
import { tint } from "~/lib/color";

interface GoalRow {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  cover_image: string | null;
  deadline: string | null;
}

/** As metas, resumidas: o total guardado e as três mais adiantadas. Some se não há nenhuma. */
export const GoalsSummary = memo(function GoalsSummary() {
  const router = useRouter();
  const { user } = useAuth();
  const { fmt } = useMoney();
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("goals").select("id, name, target_amount, current_amount, cover_image, deadline").eq("user_id", user.id);
      setGoals((data as GoalRow[]) || []);
      setLoading(false);
    };
    load();
    (window as any).addEventListener("finance-data-changed", load);
    return () => (window as any).removeEventListener("finance-data-changed", load);
  }, [user]);

  const saved = useMemo(() => goals.reduce((s, g) => s + g.current_amount, 0), [goals]);
  const target = useMemo(() => goals.reduce((s, g) => s + g.target_amount, 0), [goals]);

  if (loading) return <View style={{ height: 220, borderRadius: 22, backgroundColor: white(0.06) }} />;
  if (goals.length === 0) return null;

  const overall = target > 0 ? Math.min(saved / target, 1) : 0;
  const ranked = [...goals].sort((a, b) => Math.min(1, b.current_amount / b.target_amount) - Math.min(1, a.current_amount / a.target_amount));
  const visible = ranked.slice(0, 3);

  return (
    <Pressable onPress={() => router.push("/metas")} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <Surface style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text size={14} color={white(0.66)}>Metas</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text size={13} color={white(0.66)}>{goals.length} {goals.length === 1 ? "meta" : "metas"}</Text>
            <ChevronRight size={16} color={white(0.66)} />
          </View>
        </View>

        <View style={{ marginTop: 4, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <Text weight="extrabold" size={26} tabular style={{ letterSpacing: -0.5 }}>{fmt(saved)}</Text>
          <Text size={13} color={white(0.62)} tabular>de {fmt(target)}</Text>
        </View>
        <View style={{ marginTop: 8 }}>
          <ProgressBar ratio={overall} color="#fff" height={8} track={white(0.08)} />
        </View>
        <Text size={12} color={white(0.56)} tabular style={{ marginTop: 6 }}>{Math.round(overall * 100)}% do total guardado</Text>

        <View style={{ marginTop: 16, gap: 12, borderTopWidth: 1, borderTopColor: white(0.06), paddingTop: 14 }}>
          {visible.map((goal, idx) => {
            const progress = Math.min(1, goal.current_amount / goal.target_amount);
            const done = progress >= 1;
            const preset = getGoalPreset(goal);
            const GoalIcon: any = preset.icon;
            return (
              <View key={goal.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: tint(preset.hex, 0.13) }}>
                  {goal.cover_image ? <Image source={{ uri: goal.cover_image }} style={{ width: 44, height: 44 }} contentFit="cover" /> : <GoalIcon size={20} color={preset.hex} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                    <Text weight="medium" size={14} numberOfLines={1} style={{ flexShrink: 1 }}>{goal.name}</Text>
                    <Text weight="semibold" size={12} tabular color={done ? colors.green : white(0.82)}>{Math.round(progress * 100)}%</Text>
                  </View>
                  <View style={{ marginTop: 6 }}>
                    <ProgressBar ratio={progress} color={done ? colors.green : white(0.8)} height={6} track={white(0.08)} delay={100 + idx * 50} />
                  </View>
                  <Text size={11} color={white(0.56)} tabular numberOfLines={1} style={{ marginTop: 4 }}>
                    {done ? "Meta alcançada" : `${fmt(goal.current_amount)} de ${fmt(goal.target_amount)}`}
                  </Text>
                </View>
              </View>
            );
          })}
          {goals.length > visible.length && (
            <Text size={12} color={white(0.62)} align="center">+{goals.length - visible.length} {goals.length - visible.length === 1 ? "meta" : "metas"}</Text>
          )}
        </View>
      </Surface>
    </Pressable>
  );
});
