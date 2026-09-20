import { memo, useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { getGoalPreset } from "@/lib/goalIcons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

import { getCurrency } from "@/lib/currency";
export interface GoalRow {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  cover_image: string | null;
  deadline: string | null;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const MetasResumoCard = memo(() => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase
        .from("goals")
        .select("id, name, target_amount, current_amount, cover_image, deadline")
        .eq("user_id", user.id);

      setGoals(data || []);
      setLoading(false);
    };

    load();

    const handler = () => load();
    window.addEventListener("finance-data-changed", handler);
    return () => window.removeEventListener("finance-data-changed", handler);
  }, [user]);

  return <MetasResumoView goals={goals} loading={loading} />;
});

/** The goals summary, fed with data — also drawn by the welcome showcase. */
export function MetasResumoView({ goals, loading = false }: { goals: GoalRow[]; loading?: boolean }) {
  const navigate = useNavigate();
  const totalGuardado = useMemo(() => goals.reduce((s, g) => s + g.current_amount, 0), [goals]);
  const totalObjetivo = useMemo(() => goals.reduce((s, g) => s + g.target_amount, 0), [goals]);

  if (loading) {
    return (
      <div className="h-[220px] animate-pulse rounded-[22px] border border-white/[0.07] bg-[#141414]" />
    );
  }

  // Nothing to celebrate yet — stay out of the way instead of nagging.
  if (goals.length === 0) return null;

  const overall = totalObjetivo > 0 ? Math.min(totalGuardado / totalObjetivo, 1) : 0;
  const sortedGoals = [...goals].sort(
    (a, b) => Math.min(1, b.current_amount / b.target_amount) - Math.min(1, a.current_amount / a.target_amount),
  );
  const visible = sortedGoals.slice(0, 3);

  return (
    <button
      onClick={() => navigate("/metas")}
      className="block w-full rounded-[22px] border border-white/[0.07] bg-[#141414] p-4 text-left active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center justify-between">
        <p className="text-[14px] text-white/50">Metas</p>
        <span className="flex items-center gap-0.5 text-[13px] text-white/50">
          {goals.length} {goals.length === 1 ? "meta" : "metas"} <ChevronRight className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-[26px] font-extrabold tracking-tight text-white tabular-nums">{fmt(totalGuardado)}</p>
        <p className="text-[13px] text-white/45 tabular-nums">de {fmt(totalObjetivo)}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          className="h-full rounded-full bg-white"
          initial={{ width: 0 }}
          animate={{ width: `${overall * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <p className="mt-1.5 text-[12px] text-white/40 tabular-nums">{Math.round(overall * 100)}% do total guardado</p>

      <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-3.5">
        {visible.map((goal, idx) => {
          const progress = Math.min(1, goal.current_amount / goal.target_amount);
          const done = progress >= 1;
          const preset = getGoalPreset(goal);
          const GoalIcon = preset.icon;
          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-3"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px]" style={{ background: `${preset.hex}22` }}>
                {goal.cover_image ? (
                  <img src={goal.cover_image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <GoalIcon className="h-5 w-5" style={{ color: preset.hex }} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[14px] font-medium text-white">{goal.name}</p>
                  <span className={`shrink-0 text-[12px] font-semibold tabular-nums ${done ? "text-willo-green" : "text-white/70"}`}>
                    {Math.round(progress * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <motion.div
                    className={`h-full rounded-full ${done ? "bg-willo-green" : "bg-white/80"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ delay: 0.1 + idx * 0.05, duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <p className="mt-1 truncate text-[11px] text-white/40 tabular-nums">
                  {done ? "Meta alcançada" : `${fmt(goal.current_amount)} de ${fmt(goal.target_amount)}`}
                </p>
              </div>
            </motion.div>
          );
        })}
        {goals.length > visible.length && (
          <p className="text-center text-[12px] text-white/45">+{goals.length - visible.length} {goals.length - visible.length === 1 ? "meta" : "metas"}</p>
        )}
      </div>
    </button>
  );
}

MetasResumoCard.displayName = "MetasResumoCard";
export default MetasResumoCard;
